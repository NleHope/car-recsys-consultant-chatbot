"""Offline evaluation of the recommendation engine.

Coverage + Diversity are computed from the live reco API output and are
trustworthy now. Precision@K / NDCG@K use held-out interactions as ground
truth and are ONLY meaningful with real interaction volume — on synthetic
seeded data they measure how well the engine recovers the seed script's
co-view logic, NOT real recommendation quality. This caveat is printed.

Usage (BACKEND_URL points at the deployed API):
    BACKEND_URL=https://car-backend-...run.app \
        python -m temporal_app.scripts.eval_reco --k 20 --sample 50
"""
from __future__ import annotations

import argparse
import os

import requests


def _backend() -> str:
    b = os.environ.get("BACKEND_URL")
    if not b:
        raise SystemExit("BACKEND_URL env var is required")
    return b.rstrip("/")


def _similar(backend: str, vid: str, k: int) -> list[str]:
    try:
        r = requests.get(f"{backend}/api/v1/reco/similar/{vid}",
                         params={"limit": k}, timeout=30)
        r.raise_for_status()
        items = r.json().get("recommendations", [])
        return [it["vehicle"]["vehicle_id"] for it in items if it.get("vehicle")]
    except Exception as exc:  # noqa: BLE001
        print(f"  warn: similar({vid}) failed: {exc}")
        return []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=20)
    ap.add_argument("--sample", type=int, default=50, help="seed vehicles to evaluate")
    args = ap.parse_args()
    backend = _backend()

    listing = requests.get(f"{backend}/api/v1/listings",
                           params={"limit": args.sample}, timeout=30)
    listing.raise_for_status()
    seeds = [v["vehicle_id"] for v in listing.json()][: args.sample]
    if not seeds:
        raise SystemExit("no seed vehicles from /api/v1/listings")

    all_recommended: set[str] = set()
    diversity_scores: list[float] = []
    brand_lookup: dict[str, str] = {}

    for vid in seeds:
        recs = _similar(backend, vid, args.k)
        all_recommended.update(recs)
        brands = []
        for rid in recs:
            if rid not in brand_lookup:
                d = requests.get(f"{backend}/api/v1/listing/{rid}", timeout=30)
                brand_lookup[rid] = (d.json().get("brand") if d.ok else None) or "?"
            brands.append(brand_lookup[rid])
        if recs:
            diversity_scores.append(len(set(brands)) / len(recs))

    coverage = len(all_recommended)
    diversity = sum(diversity_scores) / len(diversity_scores) if diversity_scores else 0.0

    print("=" * 60)
    print("RECO OFFLINE EVAL")
    print("=" * 60)
    print(f"seeds evaluated      : {len(seeds)}")
    print(f"Coverage (distinct recommended vehicles): {coverage}")
    print(f"Diversity (avg distinct-brand ratio @K={args.k}): {diversity:.3f}")
    print("-" * 60)
    print("NOTE: Coverage & Diversity are valid now (label-free).")
    print("Precision@K / NDCG@K require REAL interaction volume as ground")
    print("truth. On synthetic seeded data they measure how well the engine")
    print("reproduces the SEED SCRIPT's co-view logic — NOT real-world")
    print("recommendation quality. Report them only with that disclaimer.")
    print("=" * 60)


if __name__ == "__main__":
    main()
