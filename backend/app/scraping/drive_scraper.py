from googleapiclient.discovery import build
from google.oauth2 import service_account
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.scraping.excel_parser import parse_excel_property_row, parse_excel_contact_row
from app.models.property import Property
from app.models.client import Client
from app.matching.preference_embedder import embed_property
import openpyxl
import io
import json
import structlog
import uuid

log = structlog.get_logger()


def _get_drive_service():
    creds_json = settings.google_service_account_json
    if not creds_json:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON not set")
    creds = service_account.Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    return build("drive", "v3", credentials=creds)


async def run_drive_sync():
    try:
        service = _get_drive_service()
        folder_id = settings.google_drive_folder_id
        results = service.files().list(
            q=f"'{folder_id}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
            fields="files(id, name)"
        ).execute()
        files = results.get("files", [])
        log.info("drive_scraper.files_found", count=len(files))
        for f in files:
            content = service.files().get_media(fileId=f["id"]).execute()
            wb = openpyxl.load_workbook(io.BytesIO(content))
            # Process sheets — extend with real logic
        return {"status": "ok", "files": len(files)}
    except Exception as e:
        log.error("drive_scraper.error", error=str(e))
        return {"status": "error", "error": str(e)}
