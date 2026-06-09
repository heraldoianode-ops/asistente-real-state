from app.workers.celery_app import celery_app
import structlog

log = structlog.get_logger()


@celery_app.task(name="app.workers.tasks.analytics.refresh_analytics")
def refresh_analytics():
    log.info("analytics.refresh")
    return {"status": "ok"}
