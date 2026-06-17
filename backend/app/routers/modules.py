"""Modules router — list capability modules and toggle them per agency.

ES: Lista los módulos del sistema y permite activarlos/desactivarlos (solo admin).
EN: Lists system modules and lets an admin enable/disable them.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import feature_flags as ff
from app.core.auth import get_current_user, require_admin
from app.modules import MODULES

router = APIRouter(tags=["modules"])


class ModuleStatus(BaseModel):
    name: str
    title_es: str
    title_en: str
    description_es: str
    description_en: str
    phase: int
    enabled: bool


class ToggleBody(BaseModel):
    enabled: bool


def _status(name: str, enabled: bool) -> ModuleStatus:
    spec = MODULES[name]
    return ModuleStatus(
        name=name,
        title_es=spec.title_es,
        title_en=spec.title_en,
        description_es=spec.description_es,
        description_en=spec.description_en,
        phase=spec.phase,
        enabled=enabled,
    )


@router.get("", response_model=list[ModuleStatus])
async def list_modules(user: dict = Depends(get_current_user)):
    return [
        _status(name, ff.is_enabled(name, spec.default_enabled))
        for name, spec in MODULES.items()
    ]


@router.put("/{module}", response_model=ModuleStatus)
async def toggle_module(module: str, body: ToggleBody, admin: dict = Depends(require_admin)):
    if module not in MODULES:
        raise HTTPException(status_code=404, detail="Unknown module")
    ff.set_enabled(module, body.enabled, updated_by=admin.get("id"))
    return _status(module, body.enabled)
