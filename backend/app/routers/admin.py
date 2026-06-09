from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from app.core.supabase import get_supabase
from app.core.auth import require_admin
from app.schemas.admin import (
    AgentCreate, AgentResponse,
    WhatsAppNumberCreate, WhatsAppNumberResponse,
)
from typing import List

router = APIRouter(tags=["admin"])

_SCHEMA = "asistente_real_state"


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(admin: dict = Depends(require_admin)):
    sb = get_supabase()
    result = sb.schema(_SCHEMA).table("users").select("*").eq("role", "agent").execute()
    return result.data


@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(body: AgentCreate, admin: dict = Depends(require_admin)):
    sb = get_supabase()
    try:
        auth_resp = sb.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    auth_user_id = auth_resp.user.id
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "email": body.email,
        "full_name": body.full_name,
        "role": "agent",
        "is_active": True,
        "wa_contact_id": body.wa_contact_id,
        "auth_user_id": auth_user_id,
        "created_at": now,
        "updated_at": now,
    }
    result = sb.schema(_SCHEMA).table("users").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user row")
    return result.data[0]


@router.patch("/agents/{agent_id}/activate", response_model=AgentResponse)
async def toggle_agent(agent_id: str, admin: dict = Depends(require_admin)):
    sb = get_supabase()
    current = sb.schema(_SCHEMA).table("users").select("is_active").eq("id", agent_id).single().execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    new_state = not current.data["is_active"]
    result = (
        sb.schema(_SCHEMA)
        .table("users")
        .update({"is_active": new_state, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", agent_id)
        .execute()
    )
    return result.data[0]


@router.get("/whatsapp", response_model=List[WhatsAppNumberResponse])
async def list_whatsapp(admin: dict = Depends(require_admin)):
    sb = get_supabase()
    result = sb.schema(_SCHEMA).table("whatsapp_numbers").select("*").execute()
    return result.data


@router.post("/whatsapp", response_model=WhatsAppNumberResponse, status_code=201)
async def create_whatsapp(body: WhatsAppNumberCreate, admin: dict = Depends(require_admin)):
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "agent_id": body.agent_id,
        "phone_number": body.phone_number,
        "phone_number_id": body.phone_number_id,
        "display_name": body.display_name,
        "is_active": True,
        "enabled_by": admin["id"],
        "enabled_at": now,
    }
    result = sb.schema(_SCHEMA).table("whatsapp_numbers").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to register WhatsApp number")
    return result.data[0]


@router.patch("/whatsapp/{number_id}/toggle", response_model=WhatsAppNumberResponse)
async def toggle_whatsapp(number_id: str, admin: dict = Depends(require_admin)):
    sb = get_supabase()
    current = (
        sb.schema(_SCHEMA).table("whatsapp_numbers").select("is_active").eq("id", number_id).single().execute()
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="WhatsApp number not found")
    now = datetime.now(timezone.utc).isoformat()
    new_state = not current.data["is_active"]
    update = {"is_active": new_state}
    if new_state:
        update["enabled_by"] = admin["id"]
        update["enabled_at"] = now
        update["disabled_at"] = None
    else:
        update["disabled_at"] = now
    result = sb.schema(_SCHEMA).table("whatsapp_numbers").update(update).eq("id", number_id).execute()
    return result.data[0]
