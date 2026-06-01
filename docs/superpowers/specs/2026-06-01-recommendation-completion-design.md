# Recommendation Completion — Design

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation

## Problem

The recommendation system must "work, and work smoothly." The 4-recaller hybrid is
already built (`backend/app/services/reco/`: CollaborativeRecaller, ContentRecaller,
VectorRecaller, PopularityRecaller → WeightedLinearRanker → MMRReranker). But against
**real prod data on AlloyDB** it underdelivers because of a **data reality**, not broken code:

| Table | Rows |
|---|---|
| `gold.user_interactions` | 14 (1 distinct user) |
| `gold.item_similarity` | **0** |
| `gold.vehicles` | 5337 |
| Qdrant vectors | 5337 (just backfilled) |
| `gold.mv_popular_vehicles` | 5337 |

`compute_item_similarity` correctly leaves `item_similarity` empty when interactions are
sparse (`if not rows: left empty`; needs `n_items >= 2`). So **Collaborative (item-CF) returns
nothing**, and **user-based CF / ALS would be meaningless with 1 user** (no collaborative
signal to learn). Adding ALS now is building on sand.

## Decisions (locked with user)

| Topic | Decision |
|---|---|
| Core strategy | **Content + Vector as the pillars** (run with zero interactions on 5337 vehicles/vectors); item-CF auto-activates when interaction data exists. |
| ALS / user-based CF | **Out of scope** — meaningless with 1 user; revisit when many real users exist. (Documented as future work to honor the user's broader hybrid vision.) |
| item_similarity empty | Confirmed correct behavior (sparse data). Verify it auto-fills when data arrives; ensure CollaborativeRecaller fail-soft on empty. |
| Demo CF | Include a **seed script** (synthetic multi-user interactions) so `compute_item_similarity` produces data and the full hybrid (incl. item-CF) can be demoed — kept separate from real data. |
| Offline eval | Include an **eval script** (Coverage, Diversity, Precision@K/NDCG with documented limits given sparse ground truth) for the thesis report. |
| **Dynamic CF weighting** | Ranker scales the collaborative weight by the seed user's interaction count (0 interactions → CF α=0; grows with history) instead of a purely static YAML weight. No redeploy when moving cold-start → has-data. |
| **Vector ≠ Content (de-overlap)** | `embed_vehicles._build_document` currently embeds only STRUCTURED fields (brand/model/price/specs) — nearly identical to ContentRecaller's SQL. Enrich the document with **unstructured consumer-review text** (`gold.reviews.review_text`/`review_title`, 9938 rows, joined by `car_model`) so Vector captures soft semantics (owner sentiment/experience) that SQL can't, while Content owns hard specs. |
| **Granular popularity** | PopularityRecaller falls back to **popularity-by-brand** when a brand context is known, before global popularity (avoids recommending a popular sedan to a truck shopper). By-segment deferred (no clean segment column in gold). |

## Architecture / Components

Three parts, each independently verifiable. No new recaller types (no ALS); we harden what
exists and make it provably run on AlloyDB + the new Qdrant.

### Part A — Pillars: Content + Vector + Popularity (must run with no interactions)
1. **Verify each recaller end-to-end on prod data** (AlloyDB + Qdrant 5337):
   - `VectorRecaller` — fetch a seed's stored Qdrant vector, search neighbors. With 5337
     vectors now present, `/reco/similar/{vin}` must return semantically similar vehicles.
   - `ContentRecaller` — same brand/segment, price band ±%, fuel match. Verify the SQL uses
     real `gold.vehicles` columns (post raw→gold drift fix). Example to confirm: a sedan seed
     returns same-segment sedans in a nearby price band.
   - `PopularityRecaller` — reads `mv_popular_vehicles` (5337); cold-start fallback works.
2. **Dynamic CF weighting in the ranker** (`ranker.py` + `reco_config.yaml`): instead of a
   purely static collaborative weight, scale it by the seed user's interaction count —
   `effective_cf_weight = base_cf_weight * min(1, n_user_interactions / cf_warmup_threshold)`
   (`cf_warmup_threshold` configurable, e.g. 20). At 0 interactions CF contributes 0; it ramps
   up as history accrues. Content/vector/popularity keep their base weights. This means no
   config edit or redeploy when the system transitions cold-start → has-data. The base weights
   still live in YAML; only the CF scaling is computed at request time from the seed count.
3. **Vector document de-overlap (embed enrichment)** — `crawler/temporal_app/pipeline/
   embeddings.py::_build_document` today concatenates only structured fields, so VectorRecaller
   largely duplicates ContentRecaller. Enrich the embedded document with **consumer-review
   text**: join `gold.reviews` (`review_text`, `review_title`) on `car_model`, take up to N
   recent/representative reviews per vehicle's model, and append a trimmed "What owners say:
   ..." section. Keep length bounded (e.g. cap appended review chars ~600 to control token
   cost — backfill re-embed of 5337 stays cheap). After this change, re-run the embed backfill
   so vectors carry the soft signal. Content stays specs-only (hard signal); Vector adds
   semantics. Document this split.
4. **Fail-soft everywhere** — a recaller that returns empty (CF today) is skipped without
   breaking the pipeline. Verify `recommend_for_user` cold-start path → popular, and that an
   empty `item_similarity` query does not raise.
5. **Granular popularity** — `PopularityRecaller` accepts an optional brand context; when
   present (e.g. the seed vehicle's brand, or a brand filter), it returns top-popular **within
   that brand** first, then backfills with global popularity. Avoids recommending a popular
   sedan to a truck shopper. Implement via a brand-filtered query over `mv_popular_vehicles`
   (or `gold.vehicles` ordered by the popularity signal) — by-segment is deferred (gold lacks a
   clean segment column; brand is available now).
6. **MMR diversity** confirmed (no 10 near-identical results) — cap per brand/segment.

### Part B — item-CF auto-activates with data
7. Confirm `compute_item_similarity` writes `gold.item_similarity` when interactions are
   sufficient (n_items ≥ 2). CollaborativeRecaller reads it; verify it fail-soft when empty.
8. **No code change needed** if the above holds — this part is verification + a guard if a
   gap is found.

### Part C — Demo seed + offline eval (for the report)
9. **`scripts/seed_demo_interactions.py`** (new, backend or crawler scripts dir): inserts
   synthetic interactions for N synthetic users across realistic vehicle co-views (e.g. users
   who view a Camry also view Accord/Sonata) into `gold.user_interactions`, clearly marked
   (e.g. `user_id` prefix `demo-`) so it's distinguishable/removable. Running the ML
   `compute_item_similarity` after this populates `item_similarity` → item-CF demonstrable.
10. **`scripts/eval_reco.py`** (new): offline metrics on the engine's output —
   **Coverage** (% of catalog recommendable), **Diversity** (intra-list brand/segment
   spread), and **Precision@K / NDCG@K** using a held-out slice of (seeded or real)
   interactions as ground truth. The script PRINTS the numbers AND a prominent caveat (also to
   be repeated in the thesis report): **P@K/NDCG measured on synthetic seeded interactions
   reflect how well the engine recovers the SEED SCRIPT's co-view logic — not real-world
   recommendation quality.** Only **Coverage and Diversity are trustworthy at this stage**
   (they don't depend on ground-truth labels). Real P@K/NDCG require real user interaction
   volume. Output is report-ready with this disclaimer baked in.

## Data flow (unchanged, verified)
```
gold.user_interactions ──(ML: compute_item_similarity)──► gold.item_similarity ──┐
gold.vehicles ──(ML: embed_vehicles)──► Qdrant (5337) ───────────────────────────┤
                                                                                  ▼
  /reco/* → RecommendationEngine: [Collab|Content|Vector|Popularity] → WeightedLinearRanker → MMRReranker → top-K
```

## Out of scope (YAGNI)
- ALS / matrix factorization, user-based (user-user) CF — no collaborative signal with 1
  user. Listed as future work in the spec for the report's "next steps."
- Redis caching of reco results — the system is small; add only if latency is a problem.
- Real-time interaction streaming / online learning.
- Re-architecting the recaller framework — we harden the existing one.
- Frontend changes (this spec is backend reco; compare-car is a separate later spec).

## Verification
1. On AlloyDB + Qdrant: `/api/v1/reco/similar/{vin}` returns relevant similar vehicles
   (vector + content), not empty, not duplicates.
2. `/api/v1/reco/popular` and `/api/v1/reco/hybrid` return sensible results for a guest.
3. `/api/v1/reco/personalized` for the 1 real user falls back gracefully (cold-start →
   content/popular), no error.
4. With empty `item_similarity`, no endpoint errors (fail-soft proven).
5. After `seed_demo_interactions.py` + ML `compute_item_similarity`, `gold.item_similarity`
   is non-empty and `/reco/similar` for a seeded vehicle reflects collaborative neighbors.
6. `eval_reco.py` prints Coverage / Diversity / P@K / NDCG with the documented caveat
   (synthetic-data disclaimer present in output).
7. MMR caps verified — results are diverse across brand/segment.
8. **Dynamic CF weight:** with the real 1-user/14-interaction account, CF contributes ~0; a
   seeded user past `cf_warmup_threshold` gets non-zero CF influence — confirmed without a
   config edit/redeploy.
9. **Vector de-overlap:** an embedded vehicle's stored document contains a "What owners say"
   section from `gold.reviews`; after re-embed, `/reco/similar/{vin}` differs from pure
   content SQL (vector surfaces semantically-related vehicles, not just same-spec ones).
10. **Granular popularity:** popularity fallback with a brand context returns that brand's
    popular vehicles first (truck shopper doesn't get a popular sedan).
