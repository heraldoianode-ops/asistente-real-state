from langchain_core.tools import tool
from app.models.event import Event, EventType, EventStatus
from app.models.client import Client
from sqlalchemy import select
import uuid
from datetime import datetime


@tool
async def schedule_event_tool(wa_contact_id: str, event_type: str, scheduled_at: str, notes: str = "") -> str:
    """Schedule an event (visit, call, follow_up) for a client. scheduled_at in ISO format."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Client).where(Client.wa_contact_id == wa_contact_id))
        client = result.scalar_one_or_none()
        if not client:
            return "Client not found. Cannot schedule event."

        try:
            etype = EventType(event_type.lower())
        except ValueError:
            etype = EventType.follow_up

        event = Event(
            id=uuid.uuid4(),
            client_id=client.id,
            event_type=etype,
            status=EventStatus.scheduled,
            scheduled_at=datetime.fromisoformat(scheduled_at),
            notes=notes,
        )
        db.add(event)
        await db.commit()
        return f"Event {etype.value} scheduled for {scheduled_at}."
