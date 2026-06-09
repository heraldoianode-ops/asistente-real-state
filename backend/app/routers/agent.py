from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.agents.react_agent import run_agent
from pydantic import BaseModel

router = APIRouter(tags=["agent"])


class WAMessage(BaseModel):
    wa_contact_id: str
    message: str
    message_id: str = ""
    timestamp: str = ""


@router.post("/whatsapp")
async def agent_whatsapp(body: WAMessage, db: AsyncSession = Depends(get_db)):
    result = await run_agent(body.wa_contact_id, body.message, db)
    return result
