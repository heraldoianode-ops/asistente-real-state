from app.workers.celery_app import celery_app
from app.scraping.adinco_scraper import run_scraper
from app.scraping.drive_scraper import run_drive_sync
import asyncio


@celery_app.task(name="app.workers.tasks.scraping.scrape_adinco")
def scrape_adinco():
    return asyncio.get_event_loop().run_until_complete(run_scraper())


@celery_app.task(name="app.workers.tasks.scraping.sync_drive")
def sync_drive():
    return asyncio.get_event_loop().run_until_complete(run_drive_sync())
