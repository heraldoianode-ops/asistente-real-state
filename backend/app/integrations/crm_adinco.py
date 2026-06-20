"""Adinco CRM source (implements the ExternalCRMSource port).

ES: Adaptador para el CRM Adinco vía scraping autenticado con Playwright. El flujo de
    login y la estructura están listos; los SELECTORES del DOM y el feed dependen del
    acceso real a la cuenta del usuario (Fase 3, pendiente de credenciales). Mientras no
    estén, los métodos devuelven listas vacías y lo registran — nunca rompen el worker.
EN: Adapter for the Adinco CRM via authenticated Playwright scraping. The login flow and
    structure are in place; the DOM SELECTORS and feed depend on real access to the user's
    account (Phase 3, pending credentials). Until then the methods return empty lists and
    log — they never break the worker.
"""
from __future__ import annotations

import os

import structlog

from app.integrations.crm import (
    ExternalCRMSource,
    ExternalProperty,
    ExternalContact,
    ExternalInquiry,
    crm_registry,
)

log = structlog.get_logger()

ADINCO_BASE_URL = os.getenv("ADINCO_BASE_URL", "https://www.adinco.com.ar")
ADINCO_USERNAME = os.getenv("ADINCO_USERNAME")
ADINCO_PASSWORD = os.getenv("ADINCO_PASSWORD")


@crm_registry.register("adinco", default=True)
class AdincoSource(ExternalCRMSource):
    """Authenticated Adinco scraper. Selectors are filled in once we have account access."""

    async def _login(self, page) -> bool:
        """Authenticate against Adinco. Returns True on success.

        TODO(adinco-access): wire the real login form selectors. Confirmed unknowns that
        require a test account: login URL/path, username/password field selectors, submit
        control, and the post-login success signal. If Adinco exposes an XML syndication
        feed, prefer it over scraping (see fetch_properties).
        """
        if not ADINCO_USERNAME or not ADINCO_PASSWORD:
            log.warning("adinco.login.skipped", reason="missing ADINCO_USERNAME/PASSWORD")
            return False
        await page.goto(ADINCO_BASE_URL, timeout=30000)
        # await page.fill("<username-selector>", ADINCO_USERNAME)
        # await page.fill("<password-selector>", ADINCO_PASSWORD)
        # await page.click("<submit-selector>")
        # await page.wait_for_selector("<post-login-selector>", timeout=15000)
        log.info("adinco.login.pending_selectors")
        return False

    async def fetch_properties(self, agent_id: str) -> list[ExternalProperty]:
        # TODO(adinco-access): navigate the listings view and map rows -> ExternalProperty,
        # or parse the XML syndication feed if available. Returns [] until selectors exist.
        log.info("adinco.fetch_properties.pending", agent_id=agent_id)
        return []

    async def fetch_contacts(self, agent_id: str) -> list[ExternalContact]:
        # TODO(adinco-access): map the contacts/clients view rows -> ExternalContact.
        log.info("adinco.fetch_contacts.pending", agent_id=agent_id)
        return []

    async def fetch_inquiries(self, agent_id: str) -> list[ExternalInquiry]:
        # TODO(adinco-access): map the inquiries/leads view rows -> ExternalInquiry.
        log.info("adinco.fetch_inquiries.pending", agent_id=agent_id)
        return []
