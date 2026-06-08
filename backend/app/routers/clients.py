from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientOut
from app.matching.preference_embedder import update_client_preference_embedding
import uuid

router = APIRouter(tags=["clients"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[ClientOut])
async def list_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).limit(200))
    return result.scalars().all()


@router.post("/", response_model=ClientOut, status_code=201)
async def create_client(body: ClientCreate, db: AsyncSession = Depends(get_db)):
    client = Client(id=uuid.uuid4(), **body.model_dump())
    db.add(client)
    await db.flush()
    await update_client_preference_embedding(client, db)
    return client
