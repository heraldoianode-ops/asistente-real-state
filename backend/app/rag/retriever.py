from sqlalchemy import text
from app.rag.embedder import embed_text
from typing import List
import json

MIN_SIMILARITY = 0.25


async def retrieve(query: str, db, top_k: int = 5) -> list:
    vector = await embed_text(query)
    result = await db.execute(
        text("""
            SELECT content, title, source,
                   1 - (embedding <=> CAST(:vec AS vector)) AS similarity
            FROM rag_documents
            WHERE 1 - (embedding <=> CAST(:vec AS vector)) >= :min_sim
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :top_k
        """),
        {"vec": json.dumps(vector), "min_sim": MIN_SIMILARITY, "top_k": top_k}
    )
    return [{"content": r.content, "title": r.title, "source": r.source, "similarity": float(r.similarity)}
            for r in result.all()]


def format_context(docs: list) -> str:
    if not docs:
        return "No relevant context found."
    parts = []
    for d in docs:
        parts.append(f"[{d['title'] or d['source']}]\n{d['content']}")
    return "\n\n---\n\n".join(parts)
