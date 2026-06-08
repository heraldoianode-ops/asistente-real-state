from pydantic import BaseModel
from typing import Optional, List
import uuid


class PropertyCreate(BaseModel):
    title: Optional[str] = None
    address: str
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    property_type: str
    operation_type: str
    price: float
    currency: str = "USD"
    sqm_total: Optional[float] = None
    sqm_covered: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    parking: Optional[int] = None
    amenities: Optional[List[str]] = None
    description: Optional[str] = None
    source_url: Optional[str] = None


class PropertyOut(PropertyCreate):
    id: uuid.UUID
    status: str

    class Config:
        from_attributes = True
