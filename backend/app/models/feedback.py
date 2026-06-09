import uuid
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class FeedbackTarget(str, enum.Enum):
    agent_response = "agent_response"
    property_match = "property_match"
    lead_score = "lead_score"
    rag_document = "rag_document"


class FeedbackSentiment(str, enum.Enum):
    positive = "positive"
    negative = "negative"
    neutral = "neutral"


class FeedbackRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "objection_feedback"

    target: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[uuid.UUID | None] = mapped_column()
    sentiment: Mapped[str] = mapped_column(String(20))
    comment: Mapped[str | None] = mapped_column(Text)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
