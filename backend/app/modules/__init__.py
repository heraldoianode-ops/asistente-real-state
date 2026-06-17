"""Module catalog — declarative registry of functional capabilities.

ES: Catálogo declarativo de módulos. Permite agregar/actualizar capacidades de forma
    modular; cada módulo se puede activar o desactivar por inmobiliaria (feature flags).
EN: Declarative module catalog. Enables adding/updating capabilities modularly; each
    module can be toggled per agency via feature flags.

Para agregar un módulo nuevo / To add a new module::

    register_module(ModuleSpec(name="my_module", title_es=..., title_en=..., ...))
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModuleSpec:
    name: str
    title_es: str
    title_en: str
    description_es: str
    description_en: str
    phase: int = 1
    default_enabled: bool = True


MODULES: dict[str, ModuleSpec] = {}


def register_module(spec: ModuleSpec) -> ModuleSpec:
    MODULES[spec.name] = spec
    return spec


def get_module(name: str) -> ModuleSpec | None:
    return MODULES.get(name)


# --- Core capability catalog -------------------------------------------------
register_module(ModuleSpec(
    "calendar", "Agenda en Google Calendar", "Google Calendar scheduling",
    "Agenda y sincroniza visitas en el Google Calendar del agente.",
    "Schedules and syncs property visits to the agent's Google Calendar.",
    phase=1,
))
register_module(ModuleSpec(
    "manual_entry", "Carga manual", "Manual data entry",
    "Alta y edición manual de clientes, inmuebles y propietarios desde el panel.",
    "Manual create/edit of clients, properties and owners from the dashboard.",
    phase=1,
))
register_module(ModuleSpec(
    "owner_reports", "Reportes a propietarios", "Owner reports",
    "Genera y envía reportes de actividad a los propietarios de la cartera.",
    "Generates and sends activity reports to portfolio owners.",
    phase=1,
))
register_module(ModuleSpec(
    "theming", "Personalización visual", "Visual theming",
    "Logo y selección de colores de la interfaz por inmobiliaria.",
    "Logo and interface color selection per agency.",
    phase=1,
))
register_module(ModuleSpec(
    "conversation_summary", "Resumen de conversaciones", "Conversation summaries",
    "Persiste y resume las conversaciones de WhatsApp para enriquecer el matching.",
    "Persists and summarizes WhatsApp conversations to enrich matching.",
    phase=2,
))
register_module(ModuleSpec(
    "matching", "Coincidencias entre agentes", "Cross-agent matching",
    "Detecta coincidencias entre demanda y oferta y alerta a los agentes.",
    "Detects supply/demand matches and alerts agents.",
    phase=2,
))
register_module(ModuleSpec(
    "work_planner", "Plan de trabajo / modo autónomo", "Work planner / autonomous mode",
    "Genera próximos pasos y seguimientos; modo asistido o autónomo por usuario.",
    "Generates next steps and follow-ups; assisted or autonomous mode per user.",
    phase=3,
))
register_module(ModuleSpec(
    "adinco", "Integración Adinco", "Adinco integration",
    "Sincroniza datos desde el CRM Adinco (scraping autenticado).",
    "Syncs data from the Adinco CRM (authenticated scraping).",
    phase=3, default_enabled=False,
))
