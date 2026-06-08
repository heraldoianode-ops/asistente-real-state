import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class EventType(str, enum.Enum):
    visit = "visit"
    call = "call"
    follow_up = "follow_up"
    closing = "closing"
    other = "other"


class EventStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class Event(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "events"

    client_id: Mapped[uuid.UUID] = mapped_column(index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    property_id: Mapped[uuid.UUID | None] = mapped_column()
    event_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default=EventStatus.scheduled)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
