from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class EventCreate(BaseModel):
    client_id: uuid.UUID
    agent_id: Optional[uuid.UUID] = None
    property_id: Optional[uuid.UUID] = None
    event_type: str
    scheduled_at: datetime
    notes: Optional[str] = None


class EventOut(EventCreate):
    id: uuid.UUID
    status: str

    class Config:
        from_attributes = True
