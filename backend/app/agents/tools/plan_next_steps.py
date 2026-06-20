from langchain_core.tools import tool
from sqlalchemy import select
from app.models.suggested_action import SuggestedAction  # noqa: F401 — register model at startup


@tool
async def plan_next_steps_tool(wa_contact_id: str) -> str:
    """Suggest the next step for a client (follow-up, search or schedule a visit) based on
    their lead stage and how long since the last interaction. Records the suggestion so the
    agent can act on it. Returns a short description of the suggested action."""
    from app.core.database import AsyncSessionLocal
    from app.models.client import Client
    from app.models.user import User
    from app.services.work_planner import plan_for_client

    async with AsyncSessionLocal() as db:
        client = (await db.execute(
            select(Client).where(Client.wa_contact_id == wa_contact_id)
        )).scalar_one_or_none()
        if not client:
            return "Client not found."

        agent = await db.get(User, client.assigned_agent_id) if client.assigned_agent_id else None
        action = await plan_for_client(db, client, agent)
        await db.commit()

        if not action:
            return "No next step needed right now — the client is up to date or already has a pending action."
        return f"Suggested next step: {action.action_type} — {action.rationale}"
