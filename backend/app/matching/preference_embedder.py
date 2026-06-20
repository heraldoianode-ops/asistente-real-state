from app.core.llm import get_embeddings
from app.models.client import Client
from app.models.property import Property
from sqlalchemy import select


def build_preference_text(client: Client) -> str:
    parts = []
    if client.preferred_operation:
        parts.append(f"Busca {client.preferred_operation}")
    if client.preferred_property_type:
        parts.append(f"tipo {client.preferred_property_type}")
    if client.preferred_neighborhoods:
        parts.append(f"en {', '.join(client.preferred_neighborhoods)}")
    if client.budget:
        parts.append(f"presupuesto {client.currency or 'USD'} {client.budget}")
    if client.min_bedrooms:
        parts.append(f"mínimo {client.min_bedrooms} dormitorios")
    if client.notes:
        parts.append(client.notes)
    # Free-text matching (Phase 2.2): fold the rolling conversation summary into the
    # embedded text so WhatsApp chatter — not just the structured form — drives matches.
    summary = getattr(client, "conversation_summary", None)
    if summary:
        parts.append(summary)
    return ". ".join(parts) or "cliente sin preferencias definidas"


async def update_client_preference_embedding(client: Client, db):
    embeddings = get_embeddings()
    text = build_preference_text(client)
    vector = await embeddings.aembed_query(text)
    client.preference_embedding = vector
    await db.commit()


async def embed_property(property_obj: Property, db):
    from app.matching.property_matcher import build_property_text
    embeddings = get_embeddings()
    text = build_property_text(property_obj)
    vector = await embeddings.aembed_query(text)
    property_obj.embedding = vector
    await db.commit()
