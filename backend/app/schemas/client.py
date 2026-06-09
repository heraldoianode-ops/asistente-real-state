from pydantic import BaseModel
from typing import Optional, List
import uuid


class ClientCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    wa_contact_id: Optional[str] = None
    budget: Optional[float] = None
    currency: Optional[str] = "USD"
    preferred_operation: Optional[str] = None
    preferred_property_type: Optional[str] = None
    preferred_neighborhoods: Optional[List[str]] = None
    min_bedrooms: Optional[int] = None
    notes: Optional[str] = None


class ClientOut(ClientCreate):
    id: uuid.UUID
    lead_stage: str

    class Config:
        from_attributes = True
