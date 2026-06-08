from app.workers.celery_app import celery_app
from app.ml.meta_learner import run_meta_learning_cycle
import asyncio


@celery_app.task(name="app.workers.tasks.meta_learning.run_cycle")
def run_cycle():
    return asyncio.get_event_loop().run_until_complete(run_meta_learning_cycle())
