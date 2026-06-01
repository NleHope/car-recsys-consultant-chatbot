# CLAUDE.md

Guidance for Claude Code working in this repo. Detailed runbooks live in `docs/`:
[architecture](docs/architecture/diagrams.md) · [cloud-sql](docs/cloud-sql.md) ·
[vm-worker](docs/vm-worker.md).

## Project Layout

```
crawler/                      # cars.com scraper + Temporal orchestration
├── crawler/                  # scraper package
│   ├── config.py             # env-driven config (bucket, page, browser mode)
│   ├── browser.py            # SeleniumBase UC nav + Cloudflare Turnstile solve
│   ├── link_crawler.py · detail_scraper.py · gcs_uploader.py
│   └── parsers/              # post / seller / car HTML → dict
├── temporal_app/             # Temporal workflows/activities/workers
│   ├── workflows.py          # WeeklyCrawl · Transform · ML · WeeklyPipeline (chain)
│   ├── activities.py         # crawl/scrape/upload + load_bronze/dbt/embed/...
│   ├── client.py             # connect: localhost / Temporal Cloud (API key | mTLS)
│   ├── worker.py (crawl, host) · pipeline_worker.py (transform+ml, Docker)
│   ├── pipeline/             # bronze loader · similarity · embeddings (pure fns)
│   └── scripts/              # trigger_once.py · create_schedule.py · backfill_initial.py
├── run_local.sh              # run one crawl stage standalone (debug)
├── run_worker.sh             # run a Temporal worker (reads temporal_app/.env)
└── Dockerfile.pipeline       # pipeline-worker image (no Chrome)

car-recsys-system/
├── backend/                  # FastAPI (app/api/v1, app/services/reco, app/services/chatbot)
├── frontend/                 # Vite + React + Zustand + shadcn/ui
├── dbt/                      # dbt medallion project (staging→silver→gold)
├── database/init/            # 01-init-bytebase.sql · 02-create-schema.sql
└── docker-compose.yml        # postgres·qdrant·redis·postgrest·temporal·temporal-ui·backend·pipeline-worker
```

## Running the Stack

**Backend stack (1 command — everything except frontend/bytebase):**
```bash
cd car-recsys-system && docker compose up -d
```
Frontend runs on the host (`cd frontend && npm run dev`, :3000). Bytebase is
opt-in: `docker compose --profile tools up -d bytebase`.

**Backend dev (hot-reload):** `cd backend && uvicorn app.main:app --reload`
**dbt parse (via image, no local dbt):**
```bash
docker run --rm -v "$PWD/car-recsys-system/dbt:/app/dbt" \
  -e DBT_PG_HOST=x -e DBT_PG_USER=admin -e DBT_PG_PASSWORD=admin123 -e DBT_PG_DBNAME=car_recsys \
  car-pipeline-worker:latest dbt parse --profiles-dir /app/dbt --project-dir /app/dbt
```

## Service Ports

| Frontend 3000 | Backend 8000 | Postgres 5432 | PostgREST 3001 |
| Qdrant 6333 | Redis 6379 | Temporal 7233 | Temporal UI 8233 | Bytebase 8080 |

DB creds `admin`/`admin123`, database `car_recsys`. Backend `.env`:
`OPENAI_API_KEY`, `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL`, `SECRET_KEY`, etc.

## Architecture

**Data pipeline (Temporal, replaces Airflow).** Crawler runs on the **host**
(`./run_worker.sh` — needs Chrome + Xvfb; verified that Docker can't solve
cars.com Turnstile). Transform + ML run in the Dockerized `pipeline-worker`.
Three workflows chained by `WeeklyPipeline` (fail-stop): `WeeklyCrawl` →
`Transform` → `ML`. One weekly schedule (`create_schedule.py`).

**Incremental, idempotent.** Each run uses a `crawl_date`; GCS stores
`dt=YYYY-MM-DD/`, `load_bronze` reads only that day's slice. Bronze dedup by
`file_hash`; `gold.vehicles` merge by VIN; Qdrant upsert by `point_id=uuid5(vin)`.

**dbt medallion** (`car-recsys-system/dbt/`):
```
bronze.raw_listings (JSONB) → staging stg_raw_latest (DISTINCT ON vin) → stg_listings
  → silver: fct_listing (incremental delete+insert) · dim_*/bridge
  → gold:   vehicles (merge by VIN) · vehicle_price_history (partition by day)
            car_models · sellers · reviews · vehicle_features/images · matviews
```
silver/gold tables are dbt-created; init SQL only creates schemas + bronze + the
app-domain gold tables (users, interactions, chat_*, item_similarity).

**Recommendation** (`backend/app/services/reco/`): 4 recallers
(Collaborative=gold.item_similarity, Content, Vector=Qdrant, Popularity=matview)
→ WeightedLinearRanker → MMRReranker → top-K. Config in `reco_config.yaml`.

**Chatbot** (`backend/app/services/chatbot/`): hybrid RAG — query_parser →
(SQL filter gold.vehicles ∥ Qdrant vector w/ payload filter) → RRF fusion →
gpt-4o-mini grounded (cite VIN). No LangChain. History in `gold.chat_*`.

**Backend (FastAPI)**: `app/main.py`; routes `app/api/v1/` (auth JWT, search,
listings, recommendations, chat, feedback, reviews, interactions). Reads `gold.*`.

## Cloud (GCP)

- **AlloyDB** (`free-trial-cluster`/`primary`, PG17, public IP `104.155.166.86`)
  holds prod data (migrated from Cloud SQL 2026-06-01; gold.vehicles=5337). Public
  IP + `0.0.0.0/0` + SSL (`sslmode=require`). Backend connects by IP (no
  `--add-cloudsql-instances`). Use `.env.cloud` / Secret `database-url`. See
  [docs/alloydb.md](docs/alloydb.md). (Cloud SQL deleted; [cloud-sql.md] is history.)
- **GCE VM** `temporal-worker` runs the pipeline-worker → **Temporal Cloud**
  (namespace `car-recsys.islko`, API-key auth). See [docs/vm-worker.md](docs/vm-worker.md).
- Image: `us-central1-docker.pkg.dev/cobalt-bond-494609-a6/car-recsys/pipeline-worker`.

## Gotchas

- **Crawler is host-only** — never expect it to run in Docker (Turnstile).
- **pipeline-worker bakes the dbt project** — after editing a dbt model, rebuild
  the image (`docker build -f crawler/Dockerfile.pipeline ...`) or mount the live
  `dbt/` dir for `dbt parse`. The Docker worker won't see edits otherwise.
- **dbt model edits affect both local + cloud** — run `dbt parse` to validate; a
  large dataset can expose dedup bugs absent on small local data (e.g. add
  `DISTINCT ON` in staging).
- **DB ownership (AlloyDB/Cloud SQL)**: `ensure_partition` (run as `admin`) needs
  table OWNERSHIP, not just GRANT — re-own objects to admin (`DO $reown$` block).
  On AlloyDB `postgres` isn't superuser: `GRANT admin TO postgres` first; schema
  `public` is locked (create funcs as `postgres`). See [docs/alloydb.md](docs/alloydb.md).
- **Cloud SQL connect timeout** usually = your public IP changed; re-add to
  authorized networks (`gcloud sql instances patch ... --authorized-networks`).
- **`workflow.now()` not `datetime.now()`** inside @workflow.run (determinism).
- **`OPENAI_API_KEY` / `QDRANT_URL` unset** → embed_vehicles skips gracefully.
- **Secrets**: never commit. `.env*`, `crawler/certs/`, `worker.env` are gitignored;
  docs use placeholders. Verify with `grep -rE 'sk-proj|admin123' <file>` before commit.
- **Verify, don't assume**: render Mermaid via `mermaid-cli`, run sandbox check
  (`WorkflowEnvironment.start_time_skipping`) for workflow edits, `dbt build` to
  confirm transforms.

## Skills

| Area | Skill |
|------|-------|
| Debugging | `superpowers:systematic-debugging` |
| New feature / behavior | `superpowers:brainstorming` then `superpowers:writing-plans` |
| Plan execution | `superpowers:subagent-driven-development` |
| Before claiming done | `superpowers:verification-before-completion` |
| Code review | `superpowers:requesting-code-review` |
