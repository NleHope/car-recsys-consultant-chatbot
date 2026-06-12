"""Reviews & seller API endpoints.

Repointed to the gold marts:
  * gold.reviews — keyed by car_model (reviews are per car MODEL on cars.com);
    a vehicle's reviews are found via gold.vehicles.car_model.
  * gold.sellers — joined to a vehicle via gold.vehicles.seller_key.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id

router = APIRouter()


class ReviewResponse(BaseModel):
    vehicle_id: str
    title: Optional[str] = None
    overall_rating: Optional[float] = None
    review_time: Optional[str] = None
    user_name: Optional[str] = None
    user_location: Optional[str] = None
    review_text: Optional[str] = None
    comfort_rating: Optional[float] = None
    interior_rating: Optional[float] = None
    performance_rating: Optional[float] = None
    value_rating: Optional[float] = None
    exterior_rating: Optional[float] = None
    reliability_rating: Optional[float] = None

    class Config:
        from_attributes = True


class UserReviewInput(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    review_text: Optional[str] = None


class UserReview(BaseModel):
    id: int
    vehicle_id: str
    user_id: str
    user_name: Optional[str] = None
    rating: int
    title: Optional[str] = None
    review_text: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


def _row_to_user_review(r) -> UserReview:
    return UserReview(
        id=r[0], vehicle_id=r[1], user_id=str(r[2]), user_name=r[3],
        rating=r[4], title=r[5], review_text=r[6],
        created_at=r[7], updated_at=r[8],
    )


class ReviewCard(BaseModel):
    user_name: Optional[str] = None
    reviewer_from: Optional[str] = None
    overall_rating: Optional[float] = None
    review_date: Optional[str] = None
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    car_name: Optional[str] = None
    brand: Optional[str] = None
    model_image_url: Optional[str] = None


class ReviewsListResponse(BaseModel):
    items: List[ReviewCard]
    total: int
    avg_rating: Optional[float] = None
    page: int
    page_size: int


@router.get("/reviews/user/{vehicle_id}", response_model=List[UserReview])
async def get_user_reviews(
    vehicle_id: str,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Reviews written by the site's own users for a vehicle (newest first)."""
    rows = db.execute(text("""
        SELECT ur.id, ur.vehicle_id, ur.user_id, u.username,
               ur.rating, ur.title, ur.review_text, ur.created_at, ur.updated_at
        FROM gold.user_reviews ur
        JOIN gold.users u ON u.id = ur.user_id
        WHERE ur.vehicle_id = :vid
        ORDER BY COALESCE(ur.updated_at, ur.created_at) DESC
        LIMIT :limit
    """), {"vid": vehicle_id, "limit": limit}).fetchall()
    return [_row_to_user_review(r) for r in rows]


@router.get("/reviews/user/{vehicle_id}/me", response_model=Optional[UserReview])
async def get_my_review(
    vehicle_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """The current user's own review for this vehicle (null if none)."""
    r = db.execute(text("""
        SELECT ur.id, ur.vehicle_id, ur.user_id, u.username,
               ur.rating, ur.title, ur.review_text, ur.created_at, ur.updated_at
        FROM gold.user_reviews ur
        JOIN gold.users u ON u.id = ur.user_id
        WHERE ur.vehicle_id = :vid AND ur.user_id = :uid
    """), {"vid": vehicle_id, "uid": user_id}).fetchone()
    return _row_to_user_review(r) if r else None


@router.post("/reviews/user/{vehicle_id}", response_model=UserReview)
async def upsert_user_review(
    vehicle_id: str,
    payload: UserReviewInput,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create or update (upsert) the current user's review for this vehicle."""
    r = db.execute(text("""
        INSERT INTO gold.user_reviews (user_id, vehicle_id, rating, title, review_text)
        VALUES (:uid, :vid, :rating, :title, :text)
        ON CONFLICT (user_id, vehicle_id) DO UPDATE
          SET rating = EXCLUDED.rating,
              title = EXCLUDED.title,
              review_text = EXCLUDED.review_text,
              updated_at = now()
        RETURNING id, vehicle_id, user_id, rating, title, review_text, created_at, updated_at
    """), {
        "uid": user_id, "vid": vehicle_id, "rating": payload.rating,
        "title": payload.title, "text": payload.review_text,
    }).fetchone()
    db.commit()
    name = db.execute(
        text("SELECT username FROM gold.users WHERE id = :uid"), {"uid": user_id}
    ).scalar()
    return UserReview(
        id=r[0], vehicle_id=r[1], user_id=str(r[2]), user_name=name,
        rating=r[3], title=r[4], review_text=r[5], created_at=r[6], updated_at=r[7],
    )


@router.delete("/reviews/user/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_review(
    vehicle_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete the current user's own review for this vehicle."""
    res = db.execute(text("""
        DELETE FROM gold.user_reviews
        WHERE vehicle_id = :vid AND user_id = :uid
    """), {"vid": vehicle_id, "uid": user_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")


class SellerResponse(BaseModel):
    seller_key: str
    seller_name: Optional[str] = None
    seller_address: Optional[str] = None
    seller_city: Optional[str] = None
    seller_state: Optional[str] = None
    seller_zip: Optional[str] = None
    seller_phone: Optional[str] = None
    seller_website: Optional[str] = None
    seller_rating: Optional[float] = None
    seller_rating_count: Optional[int] = None
    description: Optional[str] = None
    hours_sales: Optional[str] = None
    hours_service: Optional[str] = None
    highlights: Optional[List[str]] = None

    class Config:
        from_attributes = True


@router.get("/reviews/brands", response_model=List[str])
async def get_review_brands(db: Session = Depends(get_db)):
    """Distinct brands that have reviews, most-reviewed first (for the filter dropdown)."""
    rows = db.execute(text("""
        SELECT brand FROM gold.reviews
        WHERE brand IS NOT NULL AND review_text IS NOT NULL
        GROUP BY brand
        ORDER BY COUNT(*) DESC
    """)).fetchall()
    return [r[0] for r in rows]


@router.get("/reviews", response_model=ReviewsListResponse)
async def list_reviews(
    brand: Optional[str] = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    """Global review feed for the /reviews page: header aggregate + paginated cards."""
    order_map = {
        "recent": "r.review_date DESC NULLS LAST",
        "rating_high": "r.overall_rating DESC NULLS LAST, r.review_date DESC NULLS LAST",
        "rating_low": "r.overall_rating ASC NULLS LAST, r.review_date DESC NULLS LAST",
    }
    order_by = order_map.get(sort, order_map["recent"])
    where = "r.review_text IS NOT NULL"
    params: dict = {}
    if brand:
        where += " AND r.brand = :brand"
        params["brand"] = brand

    agg = db.execute(
        text(f"SELECT COUNT(*), ROUND(AVG(r.overall_rating), 2) FROM gold.reviews r WHERE {where}"),
        params,
    ).fetchone()
    total = int(agg[0]) if agg and agg[0] is not None else 0
    avg_rating = float(agg[1]) if agg and agg[1] is not None else None

    params_page = dict(params, limit=page_size, offset=(page - 1) * page_size)
    rows = db.execute(
        text(f"""
            SELECT r.user_name, r.reviewer_from, r.overall_rating, r.review_date,
                   r.review_title, r.review_text, r.car_name, r.brand,
                   (SELECT v.primary_image_url FROM gold.vehicles v
                    WHERE v.car_model = r.car_model AND v.primary_image_url IS NOT NULL
                    LIMIT 1) AS model_image_url
            FROM gold.reviews r
            WHERE {where}
            ORDER BY {order_by}
            LIMIT :limit OFFSET :offset
        """),
        params_page,
    ).fetchall()

    items = [
        ReviewCard(
            user_name=row[0], reviewer_from=row[1],
            overall_rating=float(row[2]) if row[2] is not None else None,
            review_date=str(row[3]) if row[3] is not None else None,
            review_title=row[4], review_text=row[5], car_name=row[6],
            brand=row[7], model_image_url=row[8],
        )
        for row in rows
    ]
    return ReviewsListResponse(items=items, total=total, avg_rating=avg_rating,
                               page=page, page_size=page_size)


@router.get("/reviews/{vehicle_id}", response_model=List[ReviewResponse])
async def get_vehicle_reviews(
    vehicle_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Consumer reviews for a vehicle's car model (reviews are model-level)."""
    query = text("""
        SELECT r.overall_rating, r.review_title, r.review_time_raw,
               r.user_name, r.reviewer_from, r.review_text,
               r.rb_comfort, r.rb_interior, r.rb_performance,
               r.rb_value, r.rb_exterior, r.rb_reliability
        FROM gold.vehicles v
        JOIN gold.reviews r ON r.car_model = v.car_model
        WHERE v.vehicle_id = :vehicle_id
        ORDER BY r.review_date DESC NULLS LAST
        LIMIT :limit
    """)
    rows = db.execute(query, {"vehicle_id": vehicle_id, "limit": limit}).fetchall()

    def _f(x):
        return float(x) if x is not None else None

    return [
        ReviewResponse(
            vehicle_id=vehicle_id,
            title=r[1],
            overall_rating=_f(r[0]),
            review_time=r[2],
            user_name=r[3],
            user_location=r[4],
            review_text=r[5],
            comfort_rating=_f(r[6]),
            interior_rating=_f(r[7]),
            performance_rating=_f(r[8]),
            value_rating=_f(r[9]),
            exterior_rating=_f(r[10]),
            reliability_rating=_f(r[11]),
        )
        for r in rows
    ]


@router.get("/seller/{vehicle_id}", response_model=Optional[SellerResponse])
async def get_vehicle_seller(
    vehicle_id: str,
    db: Session = Depends(get_db),
):
    """Seller of a given vehicle (gold.vehicles.seller_key -> gold.sellers)."""
    query = text("""
        SELECT s.seller_key, s.seller_name, s.destination, s.seller_website,
               s.seller_rating, s.seller_rating_count, s.description,
               s.phone_new, s.phone_used, s.hours, s.highlights
        FROM gold.vehicles v
        JOIN gold.sellers s ON s.seller_key = v.seller_key
        WHERE v.vehicle_id = :vehicle_id
        LIMIT 1
    """)
    row = db.execute(query, {"vehicle_id": vehicle_id}).fetchone()
    if not row:
        return None

    hours = row[9] or {}
    highlights = row[10]
    sales_hours = hours.get("Sales hours") if isinstance(hours, dict) else None
    service_hours = hours.get("Service hours") if isinstance(hours, dict) else None

    return SellerResponse(
        seller_key=row[0],
        seller_name=row[1],
        seller_address=row[2],          # `destination` is a single address string
        seller_phone=row[7] or row[8],  # prefer New, fall back to Used
        seller_website=row[3],
        seller_rating=float(row[4]) if row[4] is not None else None,
        seller_rating_count=int(row[5]) if row[5] is not None else None,
        description=row[6],
        hours_sales=sales_hours,
        hours_service=service_hours,
        highlights=highlights if isinstance(highlights, list) else None,
    )
