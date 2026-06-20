"""Work planner — suggest (and optionally auto-execute) next steps per client.

ES: Reglas determinísticas que proponen el próximo paso por cliente según su etapa y la
    antigüedad de la última interacción. En modo asistido quedan como sugerencias; en modo
    autónomo (por agente) el planificador envía el seguimiento por WhatsApp.
EN: Deterministic rules proposing each client's next step from their lead stage and the
    age of the last interaction. In assisted mode they remain suggestions; in autonomous
    mode (per agent) the planner sends the follow-up over WhatsApp.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client, LeadStage
from app.models.user import User
from app.models.message import Message
from app.models.suggested_action import SuggestedAction, ActionType, ActionStatus

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:3000")
STALE_DAYS = 3

# Lead stages still worth nudging (closed deals are left alone).
_ACTIONABLE_STAGES = {
    LeadStage.new, LeadStage.contacted, LeadStage.qualified,
    LeadStage.visit_scheduled, LeadStage.negotiating,
}


async def _last_activity(db: AsyncSession, client: Client) -> datetime | None:
    if not client.wa_contact_id:
        return None
    return (await db.execute(
        select(func.max(Message.created_at)).where(Message.wa_contact_id == client.wa_contact_id)
    )).scalar_one_or_none()


def _decide_action(client: Client) -> tuple[str, str] | None:
    """Return (action_type, rationale) for a stale client, or None if no action fits."""
    stage = client.lead_stage
    if stage == LeadStage.qualified:
        return ActionType.schedule_visit, "Cliente calificado sin visita reciente: proponer agendar una visita."
    if stage in (LeadStage.new, LeadStage.contacted):
        return ActionType.follow_up, "Lead sin avance: reconectar para mantener el interés."
    if stage in (LeadStage.visit_scheduled, LeadStage.negotiating):
        return ActionType.follow_up, "Operación en curso sin novedades: hacer seguimiento."
    return None


async def _has_open_action(db: AsyncSession, client: Client, action_type: str) -> bool:
    existing = (await db.execute(
        select(SuggestedAction.id).where(
            SuggestedAction.client_id == client.id,
            SuggestedAction.action_type == action_type,
            SuggestedAction.status.in_([ActionStatus.pending, ActionStatus.sent]),
        ).limit(1)
    )).first()
    return existing is not None


def _follow_up_message(client: Client) -> str:
    name = (client.full_name or "").split(" ")[0] or "Hola"
    return (
        f"Hola {name}, ¿seguís en la búsqueda? Tengo novedades que pueden interesarte. "
        "Contame si querés que coordinemos una visita o si cambió lo que estás buscando."
    )


async def plan_for_client(db: AsyncSession, client: Client, agent: User | None) -> SuggestedAction | None:
    """Create a suggested action for one client if it is stale and actionable."""
    if client.lead_stage not in _ACTIONABLE_STAGES:
        return None

    last = await _last_activity(db, client)
    if last and last > datetime.utcnow().replace(tzinfo=last.tzinfo) - timedelta(days=STALE_DAYS):
        return None  # recently active, no nudge needed

    decided = _decide_action(client)
    if not decided:
        return None
    action_type, rationale = decided

    if await _has_open_action(db, client, action_type):
        return None  # don't pile up duplicate suggestions

    action = SuggestedAction(
        client_id=client.id,
        agent_id=client.assigned_agent_id,
        action_type=action_type,
        due_at=datetime.utcnow() + timedelta(days=1),
        status=ActionStatus.pending,
        rationale=rationale,
    )

    # Autonomous mode: send the follow-up now and mark it sent.
    if agent and agent.autonomous_mode and action_type == ActionType.follow_up and client.wa_contact_id:
        try:
            async with httpx.AsyncClient(timeout=10) as http:
                await http.post(f"{GATEWAY_URL}/send",
                                json={"to": client.wa_contact_id, "message": _follow_up_message(client)})
            action.status = ActionStatus.sent
        except Exception:
            pass  # leave as pending; assisted fallback

    db.add(action)
    return action


async def run_work_planner() -> dict:
    """Scan active clients and generate suggested actions. Returns a small summary."""
    from app.core.database import AsyncSessionLocal
    created = 0
    sent = 0
    async with AsyncSessionLocal() as db:
        clients = (await db.execute(
            select(Client).where(Client.assigned_agent_id.is_not(None))
        )).scalars().all()

        # Cache agents to read autonomous_mode without re-querying per client.
        agents: dict = {}
        for client in clients:
            agent = agents.get(client.assigned_agent_id)
            if agent is None and client.assigned_agent_id is not None:
                agent = await db.get(User, client.assigned_agent_id)
                agents[client.assigned_agent_id] = agent
            action = await plan_for_client(db, client, agent)
            if action is not None:
                created += 1
                if action.status == ActionStatus.sent:
                    sent += 1
        await db.commit()
    return {"created": created, "auto_sent": sent}
