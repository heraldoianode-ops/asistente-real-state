import uuid
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class InteractionType(str, enum.Enum):
    whatsapp = "whatsapp"
    call = "call"
    email = "email"
    visit = "visit"
    note = "note"


class Interaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "interactions"

    client_id: Mapped[uuid.UUID] = mapped_column(index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column()
    interaction_type: Mapped[str] = mapped_column(String(30))
    content: Mapped[str | None] = mapped_column(Text)
    direction: Mapped[str | None] = mapped_column(String(10))  # in / out
