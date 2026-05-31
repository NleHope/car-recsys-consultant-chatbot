"""
Vehicle schemas - Matches database schema for used_vehicles
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime


class VehicleBase(BaseModel):
    """Base vehicle schema with common fields"""
    vehicle_id: str
    title: Optional[str] = None
    brand: Optional[str] = None
    car_model: Optional[str] = None
    car_name: Optional[str] = None
    price: Optional[float] = None
    monthly_payment: Optional[float] = None
    mileage: Optional[float] = None
    mileage_str: Optional[str] = None
    exterior_color: Optional[str] = None
    interior_color: Optional[str] = None
    drivetrain: Optional[str] = None
    mpg: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    engine: Optional[str] = None
    condition: Optional[str] = None
    
    # Ratings
    car_rating: Optional[float] = None
    percentage_recommend: Optional[float] = None
    comfort_rating: Optional[float] = None
    interior_rating: Optional[float] = None
    performance_rating: Optional[float] = None
    value_rating: Optional[float] = None
    exterior_rating: Optional[float] = None
    reliability_rating: Optional[float] = None
    
    # URLs
    vehicle_url: Optional[str] = None
    
    # Additional — sourced from gold.vehicles has_accidents/is_one_owner/image_count
    accidents_damage: Optional[bool] = None
    one_owner: Optional[bool] = None
    total_images: Optional[int] = None
    
    class Config:
        from_attributes = True


class VehicleResponse(VehicleBase):
    """Response schema for vehicle listing"""
    image_url: Optional[str] = None
    images: Optional[List[str]] = []
    features: Optional[List[str]] = []
    
    @field_validator('price', 'mileage', 'car_rating', mode='before')
    @classmethod
    def convert_decimal(cls, v):
        if v is not None:
            return float(v)
        return v


class VehicleListItem(BaseModel):
    """Simplified vehicle for list views"""
    vehicle_id: str
    title: Optional[str] = None
    brand: Optional[str] = None
    car_model: Optional[str] = None
    price: Optional[float] = None
    mileage_str: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    exterior_color: Optional[str] = None
    car_rating: Optional[float] = None
    image_url: Optional[str] = None
    vehicle_url: Optional[str] = None
    condition: Optional[str] = None
    
    @field_validator('price', 'car_rating', mode='before')
    @classmethod
    def convert_decimal(cls, v):
        if v is not None:
            return float(v)
        return v
    
    class Config:
        from_attributes = True


class VehicleSearchRequest(BaseModel):
    """Search request parameters"""
    query: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    condition: Optional[str] = None  # used, new
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    mileage_max: Optional[float] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    drivetrain: Optional[str] = None
    exterior_color: Optional[str] = None
    min_rating: Optional[float] = None
    sort_by: Optional[str] = "created_at"  # price, mileage, rating, created_at
    sort_order: Optional[str] = "desc"  # asc, desc
    page: int = 1
    page_size: int = 20


class VehicleSearchResponse(BaseModel):
    """Search response with pagination"""
    results: List[VehicleListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class VehicleFilters(BaseModel):
    """Available filter options"""
    brands: List[str] = []
    fuel_types: List[str] = []
    transmissions: List[str] = []
    drivetrains: List[str] = []
    colors: List[str] = []
    conditions: List[str] = []
    price_range: dict = {"min": 0, "max": 0}
    mileage_range: dict = {"min": 0, "max": 0}


# Recommendation-specific schemas
class RecommendationItem(BaseModel):
    """Single recommendation result"""
    vehicle: VehicleListItem
    score: float = 0.0
    reason: Optional[str] = None


class RecommendationResponse(BaseModel):
    """Recommendation response"""
    recommendations: List[RecommendationItem]
    total: int
    algorithm: str = "item-based-cf"
