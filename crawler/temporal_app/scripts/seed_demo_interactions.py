"""Seed synthetic user interactions so compute_item_similarity has data and the
item-CF recaller can be demonstrated.

gold.user_interactions.user_id is a UUID column, so synthetic users get real
uuid4 ids; demo rows are tagged with session_id='demo-seed' for easy cleanup.

Usage (env WAREHOUSE_DSN must point at the target DB):
    python -m temporal_app.scripts.seed_demo_interactions --users 30 --per-user 15
    python -m temporal_app.scripts.seed_demo_interactions --clear   # remove demo rows
"""
from __future__ import annotations

import argparse
import os
import random
import uuid

import psycopg2

DEMO_SESSION = "demo-seed"


def _dsn() -> str:
    dsn = os.environ.get("WAREHOUSE_DSN")
    if not dsn:
        raise SystemExit("WAREHOUSE_DSN env var is required")
    return dsn


def clear(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM gold.user_interactions WHERE session_id = %s",
                    (DEMO_SESSION,))
        n = cur.rowcount
    conn.commit()
    return n


def seed(conn, n_users: int, per_user: int) -> int:
    # Pull vehicles grouped by brand so synthetic users co-view within a brand
    # (realistic: a shopper looks at several cars of the same make/segment).
    with conn.cursor() as cur:
        cur.execute("""
            SELECT vehicle_id, brand FROM gold.vehicles
            WHERE brand IS NOT NULL AND title IS NOT NULL
        """)
        rows = cur.fetchall()
    by_brand: dict[str, list[str]] = {}
    for vid, brand in rows:
        by_brand.setdefault(brand, []).append(vid)
    brands = [b for b, v in by_brand.items() if len(v) >= per_user]
    if not brands:
        raise SystemExit("not enough vehicles per brand to seed")

    actions = ["view", "view", "view", "click", "click", "compare", "save", "favorite"]
    scores = {"view": 1.0, "click": 2.0, "compare": 3.0, "save": 4.0, "favorite": 4.0}
    inserted = 0
    with conn.cursor() as cur:
        for _ in range(n_users):
            uid = str(uuid.uuid4())
            brand = random.choice(brands)
            picks = random.sample(by_brand[brand], min(per_user, len(by_brand[brand])))
            for vid in picks:
                action = random.choice(actions)
                cur.execute(
                    """
                    INSERT INTO gold.user_interactions
                        (user_id, vehicle_id, interaction_type, session_id,
                         interaction_score, created_at)
                    VALUES (%s, %s, %s, %s, %s, now() - (random() * interval '30 days'))
                    """,
                    (uid, vid, action, DEMO_SESSION, scores.get(action, 1.0)),
                )
                inserted += 1
    conn.commit()
    return inserted


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=30)
    ap.add_argument("--per-user", type=int, default=15)
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()

    conn = psycopg2.connect(_dsn())
    try:
        if args.clear:
            print(f"deleted demo interactions: {clear(conn)}")
            return
        print(f"inserted demo interactions: {seed(conn, args.users, args.per_user)}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
