from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.event import Event
from app.schemas.event import EventCreate, EventOut
import uuid

router = APIRouter(tags=["events"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[EventOut])
async def list_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).order_by(Event.scheduled_at).limit(200))
    return result.scalars().all()


@router.post("/", response_model=EventOut, status_code=201)
async def create_event(body: EventCreate, db: AsyncSession = Depends(get_db)):
    event = Event(id=uuid.uuid4(), **body.model_dump())
    db.add(event)
    await db.commit()
    return event
