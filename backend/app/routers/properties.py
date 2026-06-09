from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.property import Property, PropertyStatus
from app.schemas.property import PropertyCreate, PropertyOut
from app.matching.preference_embedder import embed_property
import uuid

router = APIRouter(tags=["properties"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[PropertyOut])
async def list_properties(
    status: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    q = select(Property)
    if status:
        q = q.where(Property.status == status)
    result = await db.execute(q.limit(100))
    return result.scalars().all()


@router.post("/", response_model=PropertyOut, status_code=201)
async def create_property(body: PropertyCreate, db: AsyncSession = Depends(get_db)):
    prop = Property(id=uuid.uuid4(), **body.model_dump())
    db.add(prop)
    await db.flush()
    await embed_property(prop, db)
    return prop
