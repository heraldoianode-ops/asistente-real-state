from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.client import Client
from app.ml.features import extract_features
from app.ml.predictor import score_lead
import uuid

router = APIRouter(tags=["predictions"], dependencies=[Depends(get_current_user)])


@router.get("/score/{client_id}")
async def score_client(client_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")
    features = await extract_features(client, db)
    score_result = score_lead(features)
    return {
        "client_id": client_id,
        "score": score_result.score,
        "label": score_result.label,
        "model": score_result.model_used,
        "top_features": score_result.top_features,
    }
