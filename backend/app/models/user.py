from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    agent = "agent"
    viewer = "viewer"


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.agent)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    wa_contact_id: Mapped[str | None] = mapped_column(String(50))
    # When true, the work planner executes follow-ups automatically (added by migration 10)
    autonomous_mode: Mapped[bool] = mapped_column(Boolean, default=False)
