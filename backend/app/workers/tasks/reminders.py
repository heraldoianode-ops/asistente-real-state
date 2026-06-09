from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.event import Event, EventStatus, EventType
from app.models.client import Client
from sqlalchemy import select
from datetime import datetime, timedelta
import httpx
import asyncio


async def _send_reminders():
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        window_start = now + timedelta(hours=23)
        window_end = now + timedelta(hours=25)
        result = await db.execute(
            select(Event).where(
                Event.status == EventStatus.scheduled,
                Event.scheduled_at >= window_start,
                Event.scheduled_at <= window_end,
            )
        )
        events = result.scalars().all()
        for event in events:
            client_result = await db.execute(select(Client).where(Client.id == event.client_id))
            client = client_result.scalar_one_or_none()
            if client and client.wa_contact_id:
                async with httpx.AsyncClient() as http:
                    await http.post("http://gateway:3000/send/reminder", json={
                        "to": client.wa_contact_id,
                        "event_type": event.event_type,
                        "scheduled_at": str(event.scheduled_at),
                    })


@celery_app.task(name="app.workers.tasks.reminders.send_appointment_reminders")
def send_appointment_reminders():
    asyncio.get_event_loop().run_until_complete(_send_reminders())
