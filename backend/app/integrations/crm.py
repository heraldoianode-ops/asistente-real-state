"""External CRM source port (Adinco and future sources).

ES: Puerto para CRMs externos. Permite sumar fuentes (Adinco, portales) detrás de una
    misma interfaz, sin acoplar el resto del sistema a un proveedor concreto.
EN: Port for external CRMs. New sources (Adinco, portals) plug behind a single
    interface, keeping the rest of the system provider-agnostic.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.integrations.base import ProviderRegistry


@dataclass
class ExternalProperty:
    external_id: str
    title: str = ""
    address: str = ""
    neighborhood: str = ""
    operation_type: str = ""
    property_type: str = ""
    price: Optional[float] = None
    currency: str = ""
    url: str = ""
    raw: dict = field(default_factory=dict)


@dataclass
class ExternalContact:
    external_id: str
    full_name: str = ""
    phone: str = ""
    email: str = ""
    role: str = ""  # buyer | seller | owner | tenant
    raw: dict = field(default_factory=dict)


@dataclass
class ExternalInquiry:
    external_id: str
    contact_external_id: str = ""
    property_external_id: str = ""
    message: str = ""
    created_at: Optional[datetime] = None
    raw: dict = field(default_factory=dict)


class ExternalCRMSource(ABC):
    """Port for external real-estate CRM data sources."""

    @abstractmethod
    async def fetch_properties(self, agent_id: str) -> list[ExternalProperty]:
        ...

    @abstractmethod
    async def fetch_contacts(self, agent_id: str) -> list[ExternalContact]:
        ...

    @abstractmethod
    async def fetch_inquiries(self, agent_id: str) -> list[ExternalInquiry]:
        ...


crm_registry: ProviderRegistry[ExternalCRMSource] = ProviderRegistry("crm")
