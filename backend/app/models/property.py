import uuid
from sqlalchemy import String, Numeric, Integer, Text, ARRAY, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.models.base import Base, TimestampMixin, UUIDMixin
import enum


class PropertyType(str, enum.Enum):
    apartment = "apartment"
    house = "house"
    office = "office"
    local = "local"
    land = "land"
    other = "other"


class OperationType(str, enum.Enum):
    sale = "sale"
    rent = "rent"


class PropertyStatus(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    sold = "sold"
    rented = "rented"


class Property(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "properties"

    title: Mapped[str | None] = mapped_column(String(300))
    address: Mapped[str] = mapped_column(String(300))
    neighborhood: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    property_type: Mapped[str] = mapped_column(String(30))
    operation_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default=PropertyStatus.available)
    price: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(5), default="USD")
    sqm_total: Mapped[float | None] = mapped_column(Numeric(10, 2))
    sqm_covered: Mapped[float | None] = mapped_column(Numeric(10, 2))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[int | None] = mapped_column(Integer)
    parking: Mapped[int | None] = mapped_column(Integer)
    floor: Mapped[int | None] = mapped_column(Integer)
    amenities: Mapped[list | None] = mapped_column(ARRAY(String))
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(500))
    source_id: Mapped[str | None] = mapped_column(String(100))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding: Mapped[list | None] = mapped_column(Vector(768))
