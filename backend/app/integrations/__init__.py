"""Pluggable integrations (ports & adapters).

ES: Integraciones intercambiables detrás de interfaces. EN: Swappable integrations.
"""
from app.integrations.base import ProviderRegistry
from app.integrations.calendar import (
    CalendarEvent,
    CalendarProvider,
    calendar_registry,
)
from app.integrations.crm import (
    ExternalContact,
    ExternalCRMSource,
    ExternalInquiry,
    ExternalProperty,
    crm_registry,
)
from app.integrations.messaging import (
    MessagingChannel,
    WhatsAppChannel,
    messaging_registry,
)

__all__ = [
    "ProviderRegistry",
    "CalendarProvider",
    "CalendarEvent",
    "calendar_registry",
    "ExternalCRMSource",
    "ExternalProperty",
    "ExternalContact",
    "ExternalInquiry",
    "crm_registry",
    "MessagingChannel",
    "WhatsAppChannel",
    "messaging_registry",
]
