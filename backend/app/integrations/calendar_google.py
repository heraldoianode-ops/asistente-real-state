"""Google Calendar provider (implements the CalendarProvider port).

ES: Crea/actualiza/cancela eventos en el Google Calendar de cada agente usando el
    refresh_token guardado por el flujo OAuth (Edge Functions). Las llamadas síncronas
    de google-api-python-client se ejecutan en un thread para no bloquear el event loop.
EN: Creates/updates/cancels events in each agent's Google Calendar using the refresh_token
    stored by the OAuth flow (Edge Functions). Sync google-api-python-client calls run in a
    thread so they don't block the event loop.
"""
from __future__ import annotations

import asyncio
import os

from app.core.supabase import get_supabase
from app.integrations.calendar import CalendarEvent, CalendarProvider, calendar_registry

_SCHEMA = "asistente_real_state"
_TOKEN_URI = "https://oauth2.googleapis.com/token"
_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


@calendar_registry.register("google", default=True)
class GoogleCalendarProvider(CalendarProvider):
    def _creds_row(self, agent_id: str) -> dict | None:
        sb = get_supabase()
        res = (
            sb.schema(_SCHEMA)
            .table("agent_google_credentials")
            .select("refresh_token,calendar_id")
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def _service(self, refresh_token: str):
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=_TOKEN_URI,
            client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
            scopes=_SCOPES,
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    @staticmethod
    def _body(event: CalendarEvent) -> dict:
        return {
            "summary": event.title,
            "description": event.description,
            "location": event.location,
            "start": {"dateTime": event.start.isoformat()},
            "end": {"dateTime": event.end.isoformat()},
        }

    # --- sync internals (run in a thread) ---
    def _insert(self, agent_id: str, event: CalendarEvent) -> str | None:
        row = self._creds_row(agent_id)
        if not row:
            return None
        service = self._service(row["refresh_token"])
        cal_id = row.get("calendar_id") or "primary"
        created = service.events().insert(calendarId=cal_id, body=self._body(event)).execute()
        return created.get("id")

    def _update(self, agent_id: str, external_id: str, event: CalendarEvent) -> None:
        row = self._creds_row(agent_id)
        if not row:
            return
        service = self._service(row["refresh_token"])
        cal_id = row.get("calendar_id") or "primary"
        service.events().update(calendarId=cal_id, eventId=external_id, body=self._body(event)).execute()

    def _delete(self, agent_id: str, external_id: str) -> None:
        row = self._creds_row(agent_id)
        if not row:
            return
        service = self._service(row["refresh_token"])
        cal_id = row.get("calendar_id") or "primary"
        service.events().delete(calendarId=cal_id, eventId=external_id).execute()

    # --- async port ---
    async def create_event(self, agent_id: str, event: CalendarEvent) -> str:
        return await asyncio.to_thread(self._insert, agent_id, event)

    async def update_event(self, agent_id: str, external_id: str, event: CalendarEvent) -> None:
        await asyncio.to_thread(self._update, agent_id, external_id, event)

    async def cancel_event(self, agent_id: str, external_id: str) -> None:
        await asyncio.to_thread(self._delete, agent_id, external_id)
