"""Messaging channel port.

ES: Puerto de mensajería. Hoy WhatsApp (vía el gateway existente); permite sumar
    Telegram o email a futuro detrás de la misma interfaz.
EN: Messaging port. WhatsApp today (via the existing gateway); Telegram or email can
    be added later behind the same interface.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod

import httpx

from app.integrations.base import ProviderRegistry


class MessagingChannel(ABC):
    """Port for outbound messaging channels."""

    @abstractmethod
    async def send_text(self, to: str, message: str) -> bool:
        """Send a plain text message. Returns True on success."""


messaging_registry: ProviderRegistry[MessagingChannel] = ProviderRegistry("messaging")


@messaging_registry.register("whatsapp", default=True)
class WhatsAppChannel(MessagingChannel):
    """WhatsApp channel backed by the existing gateway service."""

    def __init__(self) -> None:
        self.gateway_url = os.getenv("GATEWAY_URL", "http://gateway:3000")

    async def send_text(self, to: str, message: str) -> bool:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.gateway_url}/send", json={"to": to, "message": message}
            )
            return resp.is_success
