from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class AgentCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    wa_contact_id: Optional[str] = None


class AgentResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    wa_contact_id: Optional[str]
    auth_user_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class WhatsAppNumberCreate(BaseModel):
    agent_id: str
    phone_number: str
    phone_number_id: str
    display_name: Optional[str] = None


class WhatsAppNumberResponse(BaseModel):
    id: str
    agent_id: str
    phone_number: str
    phone_number_id: str
    display_name: Optional[str]
    is_active: bool
    enabled_by: Optional[str]
    enabled_at: Optional[datetime]
    disabled_at: Optional[datetime]
