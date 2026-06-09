from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import FeedbackRecord
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(tags=["feedback"])


class FeedbackCreate(BaseModel):
    target: str
    target_id: Optional[str] = None
    sentiment: str
    comment: Optional[str] = None


@router.post("/", status_code=201)
async def submit_feedback(body: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    record = FeedbackRecord(
        id=uuid.uuid4(),
        target=body.target,
        target_id=uuid.UUID(body.target_id) if body.target_id else None,
        sentiment=body.sentiment,
        comment=body.comment,
    )
    db.add(record)
    await db.commit()
    return {"id": str(record.id)}
