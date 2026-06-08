from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.client import Client
from app.matching.preference_embedder import update_client_preference_embedding
from sqlalchemy import select
import asyncio


@celery_app.task(name="app.workers.tasks.matching.refresh_embeddings")
def refresh_embeddings():
    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Client).where(Client.preference_embedding.is_(None)))
            clients = result.scalars().all()
            for client in clients:
                await update_client_preference_embedding(client, db)
            return {"updated": len(clients)}
    return asyncio.get_event_loop().run_until_complete(_run())
