"""Adinco scrape task entrypoint.

ES: Orquesta la sincronización desde Adinco a través del adaptador modular AdincoSource
    (puerto ExternalCRMSource). El circuit breaker corta tras fallos repetidos. La
    extracción real depende de los selectores del adaptador (Fase 3, pendiente de acceso).
EN: Orchestrates the Adinco sync through the modular AdincoSource adapter (ExternalCRMSource
    port). The circuit breaker trips after repeated failures. Real extraction depends on the
    adapter's selectors (Phase 3, pending account access).
"""
from app.core.database import AsyncSessionLocal
from app.models.property import Property, PropertyStatus
from app.matching.preference_embedder import embed_property
from app.integrations.crm import crm_registry
import app.integrations.crm_adinco  # noqa: F401 — registers the AdincoSource provider
from sqlalchemy import select
import structlog
import uuid

log = structlog.get_logger()
CIRCUIT_THRESHOLD = 3


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


async def _upsert_property(db, ext) -> bool:
    """Insert or update a Property from an ExternalProperty. Returns True if new."""
    existing = (await db.execute(
        select(Property).where(Property.source_id == ext.external_id)
    )).scalar_one_or_none()
    if existing:
        existing.price = ext.price if ext.price is not None else existing.price
        existing.source_url = ext.url or existing.source_url
        return False
    prop = Property(
        id=uuid.uuid4(),
        title=ext.title or None,
        address=ext.address or "",
        neighborhood=ext.neighborhood or None,
        property_type=ext.property_type or "other",
        operation_type=ext.operation_type or "sale",
        status=PropertyStatus.available,
        price=ext.price or 0,
        currency=ext.currency or "USD",
        source_url=ext.url or None,
        source_id=ext.external_id,
    )
    db.add(prop)
    await db.flush()
    await embed_property(prop, db)
    return True


async def run_scraper():
    if _cb.open:
        log.warning("circuit_breaker.skipped", scraper="adinco")
        return {"status": "circuit_open"}

    try:
        provider = crm_registry.provider_class("adinco")()
        properties = await provider.fetch_properties(agent_id="")
        created = 0
        async with AsyncSessionLocal() as db:
            for ext in properties:
                if await _upsert_property(db, ext):
                    created += 1
            await db.commit()
        _cb.record_success()
        return {"status": "ok", "fetched": len(properties), "created": created}
    except Exception as e:
        _cb.record_failure()
        log.error("adinco_scraper.error", error=str(e))
        return {"status": "error", "error": str(e)}
