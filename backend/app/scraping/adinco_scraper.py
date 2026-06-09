from playwright.async_api import async_playwright
from app.core.database import AsyncSessionLocal
from app.models.property import Property, PropertyType, OperationType, PropertyStatus
from app.matching.preference_embedder import embed_property
import structlog
import uuid

log = structlog.get_logger()
CIRCUIT_THRESHOLD = 3
_failures = 0
_open = False


class CircuitBreaker:
    def __init__(self, threshold=CIRCUIT_THRESHOLD):
        self.failures = 0
        self.threshold = threshold
        self.open = False

    def record_failure(self):
        self.failures += 1
        if self.failures >= self.threshold:
            self.open = True
            log.error("circuit_breaker.open", scraper="adinco")

    def record_success(self):
        self.failures = 0
        self.open = False


_cb = CircuitBreaker()


async def run_scraper():
    if _cb.open:
        log.warning("circuit_breaker.skipped", scraper="adinco")
        return {"status": "circuit_open"}

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto("https://www.adinco.com.ar", timeout=30000)
            # Scraping logic placeholder — extend with real selectors
            await browser.close()
        _cb.record_success()
        return {"status": "ok"}
    except Exception as e:
        _cb.record_failure()
        log.error("adinco_scraper.error", error=str(e))
        return {"status": "error", "error": str(e)}
