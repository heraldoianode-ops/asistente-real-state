import uuid
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin
from sqlalchemy import DateTime, func
from datetime import datetime


class Message(Base, UUIDMixin):
    """A single persisted WhatsApp message (inbound or outbound).

    ES: Mensaje de WhatsApp persistido. Antes solo vivían en Redis de forma efímera.
    EN: Persisted WhatsApp message. Previously these only lived ephemerally in Redis.
    """

    __tablename__ = "messages"

    wa_contact_id: Mapped[str] = mapped_column(String(50), index=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column()
    agent_id: Mapped[uuid.UUID | None] = mapped_column()
    direction: Mapped[str] = mapped_column(String(10))  # 'in' | 'out'
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
