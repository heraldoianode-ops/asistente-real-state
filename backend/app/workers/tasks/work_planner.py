from app.workers.celery_app import celery_app
from app.services.work_planner import run_work_planner
import asyncio


@celery_app.task(name="app.workers.tasks.work_planner.plan_next_steps")
def plan_next_steps():
    return asyncio.get_event_loop().run_until_complete(run_work_planner())
