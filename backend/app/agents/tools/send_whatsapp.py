from langchain_core.tools import tool
import httpx
import os

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:3000")


@tool
async def send_whatsapp_tool(to: str, message: str) -> str:
    """Send a WhatsApp text message to a contact."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{GATEWAY_URL}/send", json={"to": to, "message": message})
        return f"Sent: {resp.status_code}"


@tool
async def escalate_to_human_tool(wa_contact_id: str, reason: str = "") -> str:
    """Escalate the conversation to a human agent."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{GATEWAY_URL}/escalate", json={"wa_contact_id": wa_contact_id, "reason": reason})
        return f"Escalated: {resp.status_code}"
