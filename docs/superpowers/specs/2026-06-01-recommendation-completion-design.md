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
2. **Ranker weights tuned for the no-CF regime** (`reco_config.yaml`): when CF contributes
   nothing, content + vector + popularity must still produce a good ranking; raise their
   weights, and document that CF weight only matters once `item_similarity` is populated.
3. **Fail-soft everywhere** — a recaller that returns empty (CF today) is skipped without
   breaking the pipeline. Verify `recommend_for_user` cold-start path → popular, and that an
   empty `item_similarity` query does not raise.
4. **MMR diversity** confirmed (no 10 near-identical results) — cap per brand/segment.

### Part B — item-CF auto-activates with data
5. Confirm `compute_item_similarity` writes `gold.item_similarity` when interactions are
   sufficient (n_items ≥ 2). CollaborativeRecaller reads it; verify it fail-soft when empty.
6. **No code change needed** if the above holds — this part is verification + a guard if a
   gap is found.

### Part C — Demo seed + offline eval (for the report)
7. **`scripts/seed_demo_interactions.py`** (new, backend or crawler scripts dir): inserts
   synthetic interactions for N synthetic users across realistic vehicle co-views (e.g. users
   who view a Camry also view Accord/Sonata) into `gold.user_interactions`, clearly marked
   (e.g. `user_id` prefix `demo-`) so it's distinguishable/removable. Running the ML
   `compute_item_similarity` after this populates `item_similarity` → item-CF demonstrable.
8. **`scripts/eval_reco.py`** (new): offline metrics on the engine's output —
   **Coverage** (% of catalog recommendable), **Diversity** (intra-list brand/segment
   spread), and **Precision@K / NDCG@K** using a held-out slice of (seeded or real)
   interactions as ground truth. The script PRINTS the numbers and a one-line caveat that
   P@K/NDCG are only meaningful once real interaction volume exists; Coverage/Diversity are
   valid now. Output is report-ready.

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
6. `eval_reco.py` prints Coverage / Diversity / P@K / NDCG with the documented caveat.
7. MMR caps verified — results are diverse across brand/segment.
