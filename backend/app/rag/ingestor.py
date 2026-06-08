from sqlalchemy import select, delete
from app.models.rag_document import RAGDocument
from app.rag.chunker import chunk_text
from app.rag.embedder import embed_batch
import uuid


async def ingest_document(title: str, source: str, content: str, db) -> int:
    """Delete existing chunks for source, rechunk, embed, and insert. Returns chunk count."""
    await db.execute(delete(RAGDocument).where(RAGDocument.source == source))
    await db.flush()

    chunks = chunk_text(content)
    vectors = await embed_batch(chunks)

    docs = [
        RAGDocument(
            id=uuid.uuid4(),
            title=title,
            source=source,
            chunk_index=i,
            content=chunk,
            embedding=vector,
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    db.add_all(docs)
    await db.commit()
    return len(docs)


async def list_documents(db) -> list:
    result = await db.execute(
        select(RAGDocument.source, RAGDocument.title)
        .distinct(RAGDocument.source)
    )
    return [{"source": r.source, "title": r.title} for r in result.all()]
