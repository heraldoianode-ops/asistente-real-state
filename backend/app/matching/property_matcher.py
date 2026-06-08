from sqlalchemy import select, text
from app.models.property import Property, PropertyStatus
from app.models.client import Client
from app.core.llm import get_embeddings
from typing import List
import json


def build_property_text(p: Property) -> str:
    parts = [
        p.title or "",
        f"{p.property_type} en {p.neighborhood or p.city or ''}",
        f"{p.operation_type} {p.currency} {p.price}",
        f"{p.sqm_covered or '?'} m2 cubiertos",
        f"{p.bedrooms or '?'} dormitorios, {p.bathrooms or '?'} baños",
    ]
    if p.amenities:
        parts.append(", ".join(p.amenities[:6]))
    if p.description:
        parts.append(p.description[:300])
    return " | ".join(filter(None, parts))


async def _ann_search(db, query_vector: list, limit: int = 10) -> List[Property]:
    result = await db.execute(
        text("""
            SELECT id FROM properties
            WHERE status = 'available'
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :limit
        """),
        {"vec": json.dumps(query_vector), "limit": limit}
    )
    ids = [row[0] for row in result.all()]
    props = await db.execute(select(Property).where(Property.id.in_(ids)))
    return props.scalars().all()


async def match_for_client(client: Client, db, limit: int = 10) -> List[Property]:
    if client.preference_embedding is None:
        return []
    return await _ann_search(db, client.preference_embedding, limit)


async def match_by_query(query_text: str, db, limit: int = 10) -> List[Property]:
    embeddings = get_embeddings()
    vector = await embeddings.aembed_query(query_text)
    return await _ann_search(db, vector, limit)
