from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    wa_contact_id: Optional[str]
    auth_user_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
