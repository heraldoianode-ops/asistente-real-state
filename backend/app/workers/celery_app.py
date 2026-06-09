from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "asistente_real_state",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.tasks.scraping",
        "app.workers.tasks.reminders",
        "app.workers.tasks.ml",
        "app.workers.tasks.matching",
        "app.workers.tasks.analytics",
        "app.workers.tasks.meta_learning",
    ]
)

celery_app.conf.beat_schedule = {
    "adinco-scrape-every-6h": {
        "task": "app.workers.tasks.scraping.scrape_adinco",
        "schedule": 6 * 3600,
    },
    "drive-sync-every-12h": {
        "task": "app.workers.tasks.scraping.sync_drive",
        "schedule": 12 * 3600,
    },
    "reminders-every-15min": {
        "task": "app.workers.tasks.reminders.send_appointment_reminders",
        "schedule": 15 * 60,
    },
}
celery_app.conf.timezone = "America/Argentina/Buenos_Aires"
