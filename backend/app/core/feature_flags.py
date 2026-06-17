"""Module feature flags / toggles backed by ``app_settings``.

ES: Flags de módulos por inmobiliaria. Cada módulo se activa/desactiva sin tocar código.
EN: Per-tenant module toggles. Modules are enabled/disabled without code changes.

Convención / convention: ``app_settings.key = "module.<name>.enabled"``,
``value = "true" | "false"``.
"""
from __future__ import annotations

from app.core.supabase import get_supabase

_SCHEMA = "asistente_real_state"
_PREFIX = "module."
_SUFFIX = ".enabled"


def flag_key(module: str) -> str:
    return f"{_PREFIX}{module}{_SUFFIX}"


def _truthy(value) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def is_enabled(module: str, default: bool = True) -> bool:
    """Return whether a module is enabled (falls back to ``default`` if unset)."""
    sb = get_supabase()
    res = (
        sb.schema(_SCHEMA)
        .table("app_settings")
        .select("value")
        .eq("key", flag_key(module))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows or rows[0].get("value") is None:
        return default
    return _truthy(rows[0]["value"])


def set_enabled(module: str, enabled: bool, updated_by: str | None = None) -> None:
    """Persist a module toggle into ``app_settings`` (admin-gated upstream)."""
    sb = get_supabase()
    payload = {
        "key": flag_key(module),
        "value": "true" if enabled else "false",
        "updated_by": updated_by,
    }
    sb.schema(_SCHEMA).table("app_settings").upsert(payload, on_conflict="key").execute()
