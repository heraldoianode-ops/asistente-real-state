from fastapi import APIRouter, Depends, BackgroundTasks
from app.core.auth import require_roles
from app.models.user import UserRole
from app.scraping.adinco_scraper import run_scraper
from app.scraping.drive_scraper import run_drive_sync

router = APIRouter(tags=["scraping"], dependencies=[Depends(require_roles(UserRole.admin))])


@router.post("/adinco")
async def trigger_adinco(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_scraper)
    return {"status": "triggered"}


@router.post("/drive")
async def trigger_drive(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_drive_sync)
    return {"status": "triggered"}
