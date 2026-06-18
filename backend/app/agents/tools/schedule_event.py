from langchain_core.tools import tool
from app.models.event import Event, EventType, EventStatus
from app.models.client import Client
from sqlalchemy import select
import uuid
from datetime import datetime, timedelta


async def _sync_to_calendar(client, etype, start_dt, notes):
    """Best-effort push to the agent's Google Calendar. Never raises — calendar sync
    must not break local scheduling. Returns the Google event id or None."""
    try:
        from app.core.feature_flags import is_enabled
        if not client.assigned_agent_id or not is_enabled("calendar", default=True):
            return None
        from app.integrations.calendar import CalendarEvent
        from app.integrations.calendar_google import GoogleCalendarProvider
        cal_event = CalendarEvent(
            title=f"{etype.value} — {client.full_name}",
            start=start_dt,
            end=start_dt + timedelta(hours=1),
            description=notes or "",
        )
        return await GoogleCalendarProvider().create_event(str(client.assigned_agent_id), cal_event)
    except Exception:
        return None


@tool
async def schedule_event_tool(wa_contact_id: str, event_type: str, scheduled_at: str, notes: str = "") -> str:
    """Schedule an event (visit, call, follow_up) for a client. scheduled_at in ISO format.
    If the client's agent has Google Calendar connected, the event is also created there."""
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

        start_dt = datetime.fromisoformat(scheduled_at)
        event = Event(
            id=uuid.uuid4(),
            client_id=client.id,
            agent_id=client.assigned_agent_id,
            event_type=etype,
            status=EventStatus.scheduled,
            scheduled_at=start_dt,
            notes=notes,
        )
        db.add(event)
        await db.commit()

        gcal_id = await _sync_to_calendar(client, etype, start_dt, notes)
        if gcal_id:
            event.google_event_id = gcal_id
            await db.commit()
            return f"Event {etype.value} scheduled for {scheduled_at} (added to Google Calendar)."
        return f"Event {etype.value} scheduled for {scheduled_at}."
