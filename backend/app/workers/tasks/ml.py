from app.workers.celery_app import celery_app
from app.ml.trainer import run_training_pipeline
from app.core.database import AsyncSessionLocal
import asyncio


@celery_app.task(name="app.workers.tasks.ml.retrain_model")
def retrain_model():
    async def _run():
        async with AsyncSessionLocal() as db:
            return await run_training_pipeline(db)
    return asyncio.get_event_loop().run_until_complete(_run())
