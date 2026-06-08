from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.client import Client
from app.models.interaction import Interaction, InteractionType
import uuid

router = APIRouter(tags=["crm"], dependencies=[Depends(get_current_user)])


@router.post("/interactions", status_code=201)
async def add_interaction(
    client_id: str,
    content: str,
    interaction_type: str = "note",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    interaction = Interaction(
        id=uuid.uuid4(),
        client_id=uuid.UUID(client_id),
        agent_id=uuid.UUID(user["sub"]),
        interaction_type=interaction_type,
        content=content,
        direction="out",
    )
    db.add(interaction)
    await db.commit()
    return {"id": str(interaction.id)}


@router.patch("/clients/{client_id}/stage")
async def update_stage(client_id: str, stage: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    client.lead_stage = stage
    await db.commit()
    return {"id": client_id, "stage": stage}
