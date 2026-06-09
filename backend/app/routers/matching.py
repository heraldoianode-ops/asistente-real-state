from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.client import Client
from app.matching.property_matcher import match_for_client, match_by_query
from app.schemas.property import PropertyOut
import uuid

router = APIRouter(tags=["matching"], dependencies=[Depends(get_current_user)])


@router.get("/client/{client_id}", response_model=list[PropertyOut])
async def match_for_client_endpoint(client_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        return []
    return await match_for_client(client, db)


@router.get("/query", response_model=list[PropertyOut])
async def match_by_query_endpoint(q: str = Query(...), db: AsyncSession = Depends(get_db)):
    return await match_by_query(q, db)
