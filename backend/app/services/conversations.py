"""Conversation persistence + rolling LLM summaries.

ES: Persiste cada turno de WhatsApp en ``messages`` y, cada ciertos turnos, genera un
    resumen de la conversación del cliente con el LLM activo (respeta el selector
    local/anthropic). El resumen se re-embebe para alimentar el matching por texto libre.
EN: Persists each WhatsApp turn into ``messages`` and, every few turns, generates a
    client conversation summary with the active LLM (honors the local/anthropic switch).
    The summary is re-embedded to feed free-text matching.
"""
from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.message import Message

# Summarize every N inbound messages to bound LLM cost (local model is free, but the
# admin may switch to a paid provider).
SUMMARIZE_EVERY = 4
_TRANSCRIPT_LIMIT = 30


def _as_text(llm_result) -> str:
    """Normalize output across chat models (.content) and string LLMs (str)."""
    content = getattr(llm_result, "content", llm_result)
    return content if isinstance(content, str) else str(content)


async def _find_client(db: AsyncSession, wa_contact_id: str) -> Client | None:
    res = await db.execute(select(Client).where(Client.wa_contact_id == wa_contact_id))
    return res.scalar_one_or_none()


async def record_conversation(db: AsyncSession, wa_contact_id: str, inbound: str, reply: str) -> None:
    """Persist an inbound+outbound turn; periodically refresh the client summary.

    Best-effort: never raises into the agent path — a logging failure must not break
    the reply that was already produced.
    """
    try:
        client = await _find_client(db, wa_contact_id)
        client_id = client.id if client else None
        agent_id = client.assigned_agent_id if client else None

        db.add(Message(wa_contact_id=wa_contact_id, client_id=client_id, agent_id=agent_id,
                        direction="in", body=inbound))
        db.add(Message(wa_contact_id=wa_contact_id, client_id=client_id, agent_id=agent_id,
                        direction="out", body=reply))
        await db.commit()

        if client is None:
            return
        count = (await db.execute(
            select(func.count()).select_from(Message)
            .where(Message.wa_contact_id == wa_contact_id, Message.direction == "in")
        )).scalar_one()
        if count and count % SUMMARIZE_EVERY == 0:
            await summarize_client(db, client)
    except Exception:
        await db.rollback()


async def summarize_client(db: AsyncSession, client: Client) -> str | None:
    """Summarize the client's recent conversation and re-embed for matching."""
    rows = (await db.execute(
        select(Message).where(Message.wa_contact_id == client.wa_contact_id)
        .order_by(Message.created_at.desc()).limit(_TRANSCRIPT_LIMIT)
    )).scalars().all()
    if not rows:
        return None

    rows = list(reversed(rows))
    transcript = "\n".join(
        f"{'Cliente' if m.direction == 'in' else 'Agente'}: {m.body or ''}" for m in rows
    )
    prompt = (
        "Resumí en 3-4 oraciones la siguiente conversación inmobiliaria, destacando qué "
        "busca el cliente (tipo de propiedad, zona, presupuesto, urgencia) para poder "
        "encontrar coincidencias. Respondé solo con el resumen.\n\n" + transcript
    )

    from app.core.llm import get_llm
    summary = _as_text(await get_llm().ainvoke(prompt)).strip()
    if not summary:
        return None

    client.conversation_summary = summary
    # Re-embed preferences+summary (build_preference_text folds the summary in).
    from app.matching.preference_embedder import update_client_preference_embedding
    await update_client_preference_embedding(client, db)
    return summary
