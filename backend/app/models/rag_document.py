import uuid
from sqlalchemy import String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.models.base import Base, TimestampMixin, UUIDMixin


class RAGDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rag_documents"
    __table_args__ = (
        Index("ix_rag_documents_embedding", "embedding", postgresql_using="ivfflat",
              postgresql_with={"lists": 100}, postgresql_ops={"embedding": "vector_cosine_ops"}),
    )

    title: Mapped[str | None] = mapped_column(String(300))
    source: Mapped[str | None] = mapped_column(String(200))
    chunk_index: Mapped[int] = mapped_column(default=0)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list | None] = mapped_column(Vector(768))
