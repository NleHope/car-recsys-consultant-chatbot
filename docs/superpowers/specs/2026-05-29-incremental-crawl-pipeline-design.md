# Incremental Crawl → Transform → Inference Pipeline — Design

**Date:** 2026-05-29
**Status:** Approved (design), pending implementation

## Problem

The project has two distinct data-loading regimes that must never collide:

1. **Initial load** — a one-time, manual bulk crawl done in a Colab notebook,
   manually transformed into Postgres. This is the baseline dataset.
2. **Incremental load** — a weekly automated Temporal pipeline that crawls
   page 1, transforms only the new data, and re-runs model inference.

The current crawler writes to `gs://bronze-car-recsys/raw_data/<page>/`, which
**overwrites** prior crawl output. We need the weekly job to land in a separate
location, transform only the new slice, dedup by VIN on insert, keep a
day-partitioned price/mileage history, and re-embed/re-rank only what changed.

## Decisions (locked with user)

| Topic | Decision |
|---|---|
| Dedup key | **VIN** — one vehicle = one VIN |
| Update strategy | **Upsert** `gold.vehicles` by VIN (current state) + append change-events to history |
| Image storage | **GCS**; Postgres stores **URL only** (no BYTEA) |
| Init vs incremental tables | **Shared** `gold.vehicles`, distinguished by a `source` column |
| Current vs history split | `gold.vehicles` (upsert by VIN, **no partition**) + `gold.vehicle_price_history` (**range-partitioned on `crawl_date`**, monthly partitions) |
| Incremental bucket layout | `gs://incremental_raw/dt=YYYY-MM-DD/<page>/*.json` |
| History write rule | Only when `(price, mileage, status)` changes vs the latest history row |
| Parse + dedup engine | **dbt** does all parse/dedup/history (medallion) |
| ML re-inference scope | embed new vehicles + recompute item-similarity + refresh matviews |
| Initial DB state | **Empty** — incremental pipeline is the first data source |

## Architecture

```
INITIAL (manual, one-time — Colab)
  gs://bronze-car-recsys/...           ← baseline, READ-ONLY, never overwritten
  → manual transform → Postgres (loaded later, same schema, source='initial')

INCREMENTAL (weekly, automated — Temporal)
  WeeklyCrawl workflow (host worker, Chrome+Xvfb)
    crawl_links → scrape_details → upload_gcs
      └─► gs://incremental_raw/dt=YYYY-MM-DD/<page>/<idx>.json
          gs://incremental_raw/dt=YYYY-MM-DD/images/<vin>/<n>.jpg

  Transform workflow (Docker pipeline-worker)
    load_bronze(dt)         GCS dt=today prefix → bronze.raw_listings (ON CONFLICT file_hash)
    dbt_build               parse + dedup-by-VIN + upsert gold.vehicles + append history
    refresh_matviews        + ensure next-day partition exists

  ML workflow (Docker pipeline-worker)
    compute_item_similarity   interactions → gold.item_similarity
    embed_vehicles            only VINs with last_updated_date = today → Qdrant
    (matviews already refreshed by Transform)
```

Two task queues remain: `car-crawler-tq` (host) and `car-pipeline-tq` (Docker).

## Dedup — two tiers

**Tier 1 — Bronze idempotency (`file_hash`).** `bronze.raw_listings` is
append-only with a UNIQUE constraint on `file_hash` (sha256 of the JSON bytes).
`INSERT ... ON CONFLICT (file_hash) DO NOTHING`. Re-running `load_bronze` for the
same day never duplicates rows. This is idempotency, not business dedup.

**Tier 2 — Gold business dedup (VIN), done in dbt.** From the new bronze slice,
`stg_raw_latest` already keeps `DISTINCT ON (vin)` latest by `ingested_at`.
`gold.vehicles` becomes a dbt **incremental** model (`unique_key='vin'`,
`incremental_strategy='merge'`) so a re-crawled VIN merges (upserts) in place.

## Schema changes

### `bronze.raw_listings` (modify existing)

- Rename `dag_run_id` → `run_id` (Temporal workflow run id). Update comment.
- Add `source TEXT NOT NULL DEFAULT 'incremental'` (`'initial'` | `'incremental'`).
- Add `crawl_date DATE` — lifted from the GCS path `dt=YYYY-MM-DD` (the partition key
  downstream). Index it.
- Keep `file_hash` UNIQUE, GIN on payload, btree on vin/model/ingested_at.

### `gold.vehicles` (dbt incremental — modify existing model)

- Materialization → `incremental`, `unique_key='vin'`, `incremental_strategy='merge'`.
- `is_incremental()` filter: only process bronze rows where `crawl_date` is the
  current run's date (full-refresh processes everything).
- Add columns: `source TEXT`, `first_seen_date DATE` (preserved on merge — use
  `coalesce(existing, new)` via merge), `last_updated_date DATE` (= crawl_date).
- No partitioning (merge-by-VIN needs in-place update; Postgres can't update a
  partition key cheaply).

### `gold.vehicle_price_history` (NEW — partitioned, created in init SQL)

Postgres has no native dbt-managed partitioning, so the **parent table is
declared in `database/init/02-create-schema.sql`**:

```sql
CREATE TABLE gold.vehicle_price_history (
    vin           TEXT        NOT NULL,
    price         NUMERIC,
    mileage       INTEGER,
    status        TEXT,                       -- new_used / availability
    crawl_date    DATE        NOT NULL,
    inserted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (crawl_date);
CREATE INDEX ON gold.vehicle_price_history (vin, crawl_date);
```

- A dbt **incremental** model (`incremental_strategy='append'`) inserts into the
  parent; Postgres routes to the right partition.
- Write rule: insert a row only when `(price, mileage, status)` differs from the
  VIN's most recent history row (handled in the model's `is_incremental()` SQL via
  a `NOT EXISTS` / `DISTINCT` comparison against the existing latest row).
- **Partition management:** a SQL helper
  `gold.ensure_price_history_partition(date)` ensures the partition covering the
  current `crawl_date` exists *before* dbt inserts. It creates a monthly
  partition `vehicle_price_history_YYYY_MM` if missing — monthly physical
  partitions keep the partition count low while the range key stays
  day-granular. It is idempotent (`CREATE TABLE IF NOT EXISTS ... PARTITION OF`).
  Exposed as the `ensure_partition` activity, scheduled before `dbt_build` so the
  partition exists when the history model appends (see Workflow changes).

### `gold.vehicle_images` (modify existing)

- Already URL-based (`image_url`). Add `image_gcs_path TEXT` for the canonical
  GCS object path. No binary in Postgres.

## Crawler / GCS changes

- `crawler/config.py`: default `GCS_BUCKET=incremental_raw`; add `CRAWL_DATE`
  (defaults to today UTC) and a `GCS_DATE_PARTITION=true` flag.
- `crawler/gcs_uploader.py`: object key becomes
  `dt=<CRAWL_DATE>/<page>/<file>.json` and `dt=<CRAWL_DATE>/images/<rel>` instead
  of `raw_data/<page>/...`. Each weekly run lands in a fresh `dt=` prefix → never
  overwrites.
- `temporal_app/activities.py`:
  - `upload_gcs_activity` passes `crawl_date`.
  - `load_bronze_activity` accepts `dt` and lists only `dt=<date>/` prefixes;
    lifts `crawl_date` + `source='incremental'` into bronze rows.
- `temporal_app/pipeline/bronze.py`: `BronzeLoaderConfig` gains `crawl_date`;
  prefix construction filters to the day; row dict includes `crawl_date`,
  `source`, `run_id`.

## Workflow changes

- `WeeklyCrawlWorkflow` → pass a `crawl_date` (workflow start date, deterministic
  via `workflow.now()`) through all three activities so crawl + upload + the
  later transform all agree on the same `dt`.
- `TransformWorkflow` → `load_bronze(dt)` → `ensure_partition(dt)` → `dbt_build`
  → `refresh_matviews`. `ensure_partition` runs before `dbt_build` so the
  history partition exists when the history model appends. `dt` defaults to
  today but is settable for backfills.
- `MLWorkflow` → unchanged shape; `embed_vehicles` reads an incremental watermark
  (`last_updated_date = dt`) instead of re-embedding everything.

## Image handling — explicit answer

Storing images as Postgres `BYTEA` is technically possible but **rejected**: with
thousands of images the DB bloats, backup/restore slows, and every wide query
drags binary. Decision: images live in GCS under the same `dt=` prefix; Postgres
holds only the URL + GCS path. Frontend serves images straight from GCS.

## Out of scope (YAGNI)

- SCD-2 full history (chose lightweight change-event history instead).
- Init-data loader (separate task, same schema, `source='initial'`).
- Cross-bucket migration of the existing `bronze-car-recsys` data.
- Image thumbnails in DB.

## Verification

1. **Bucket isolation** — a weekly run writes only under
   `gs://incremental_raw/dt=YYYY-MM-DD/`; `gs://bronze-car-recsys/` is untouched.
2. **Bronze idempotency** — run `load_bronze(dt)` twice; `bronze.raw_listings`
   count unchanged the second time.
3. **VIN upsert** — crawl a VIN, change its price in a second crawl-date; after
   transform `gold.vehicles` has ONE row for that VIN with the new price, and
   `gold.vehicle_price_history` has TWO rows (the change event).
4. **No-change → no history row** — re-crawl identical data; history count
   unchanged.
5. **Partition routing** — insert spanning two dates lands in two partitions;
   `gold.ensure_price_history_partition` is idempotent.
6. **Incremental embed** — `embed_vehicles` upserts only the day's changed VINs
   to Qdrant (count matches `last_updated_date = dt`).
7. **End-to-end** — WeeklyCrawl → Transform → ML on the host+Docker split, all
   green in the Temporal UI.
