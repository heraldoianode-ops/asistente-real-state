from langchain_core.tools import tool
from sqlalchemy import select
from app.models.client import Client
from app.models.event import Event
from app.core.redis import get_session
import json


@tool
async def get_client_history_tool(wa_contact_id: str) -> str:
    """Get the interaction history and profile for a WhatsApp contact."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Client).where(Client.wa_contact_id == wa_contact_id))
        client = result.scalar_one_or_none()
        if not client:
            return "No client record found for this contact."

        events_result = await db.execute(
            select(Event).where(Event.client_id == client.id).order_by(Event.scheduled_at.desc()).limit(5)
        )
        events = events_result.scalars().all()

        session_raw = await get_session(wa_contact_id)
        session = json.loads(session_raw) if session_raw else []

        return json.dumps({
            "client": {"name": client.full_name, "stage": client.lead_stage, "budget": str(client.budget)},
            "recent_events": [{"type": e.event_type, "status": e.status, "at": str(e.scheduled_at)} for e in events],
            "session_turns": len(session),
        })
