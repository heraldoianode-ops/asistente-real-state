import uuid
from sqlalchemy import String, Numeric, Integer, Text, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class LeadStage(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    visit_scheduled = "visit_scheduled"
    negotiating = "negotiating"
    closing = "closing"
    closed_won = "closed_won"
    closed_lost = "closed_lost"


class Client(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "clients"

    full_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    wa_contact_id: Mapped[str | None] = mapped_column(String(50), index=True)
    lead_stage: Mapped[str] = mapped_column(String(30), default=LeadStage.new)
    budget: Mapped[float | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str | None] = mapped_column(String(5), default="USD")
    preferred_operation: Mapped[str | None] = mapped_column(String(20))
    preferred_property_type: Mapped[str | None] = mapped_column(String(50))
    preferred_neighborhoods: Mapped[list | None] = mapped_column(ARRAY(String))
    min_bedrooms: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column()
    # Rolling LLM summary of the client's WhatsApp conversation (added by migration 09)
    conversation_summary: Mapped[str | None] = mapped_column(Text)
    preference_embedding: Mapped[list | None] = mapped_column(Vector(768))
