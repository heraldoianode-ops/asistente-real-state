from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin, UUIDMixin
from datetime import datetime
import enum


class SourceType(str, enum.Enum):
    website = "website"
    google_drive = "google_drive"
    manual = "manual"


class ScrapingSource(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scraping_sources"

    name: Mapped[str] = mapped_column(String(100))
    source_type: Mapped[str] = mapped_column(String(30))
    url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
