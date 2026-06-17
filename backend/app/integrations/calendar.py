"""Calendar integration port.

ES: Puerto de calendario. Implementaciones concretas (Google, Outlook) se registran
    en ``calendar_registry`` y se intercambian sin tocar el agente.
EN: Calendar port. Concrete implementations (Google, Outlook) register in
    ``calendar_registry`` and are swappable without touching the agent.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime

from app.integrations.base import ProviderRegistry


@dataclass
class CalendarEvent:
    """Backend-agnostic calendar event."""

    title: str
    start: datetime
    end: datetime
    description: str = ""
    location: str = ""
    attendees: list[str] = field(default_factory=list)


class CalendarProvider(ABC):
    """Port for calendar backends."""

    @abstractmethod
    async def create_event(self, agent_id: str, event: CalendarEvent) -> str:
        """Create an event and return its external id."""

    @abstractmethod
    async def update_event(self, agent_id: str, external_id: str, event: CalendarEvent) -> None:
        """Update an existing external event."""

    @abstractmethod
    async def cancel_event(self, agent_id: str, external_id: str) -> None:
        """Cancel/delete an external event."""


calendar_registry: ProviderRegistry[CalendarProvider] = ProviderRegistry("calendar")
