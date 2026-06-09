import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_run_drive_sync_no_credentials():
    from app.scraping.drive_scraper import run_drive_sync
    result = await run_drive_sync()
    assert result["status"] == "error"
