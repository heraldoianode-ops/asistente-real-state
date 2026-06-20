import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class ActionType(str, enum.Enum):
    follow_up = "follow_up"
    search = "search"
    schedule_visit = "schedule_visit"


class ActionStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    done = "done"
    dismissed = "dismissed"


class SuggestedAction(Base, UUIDMixin, TimestampMixin):
    """A next-step suggestion for a client (work planner / autonomous mode).

    ES: Próximo paso sugerido para un cliente. El planificador lo crea; en modo autónomo
        el agente lo ejecuta (ej. enviar seguimiento por WhatsApp).
    EN: Suggested next step for a client. Created by the planner; in autonomous mode the
        agent executes it (e.g. sending a WhatsApp follow-up).
    """

    __tablename__ = "suggested_actions"

    client_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    action_type: Mapped[str] = mapped_column(String(30))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default=ActionStatus.pending)
    rationale: Mapped[str | None] = mapped_column(Text)
