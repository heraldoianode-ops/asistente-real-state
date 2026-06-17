"""Agent tool registry with auto-discovery.

ES: Registro de herramientas del agente. Descubre automáticamente cualquier tool
    declarada en este paquete, de modo que agregar una nueva no requiere editar el
    agente (``react_agent.py``): basta con dejar el archivo de la tool en esta carpeta.
EN: Auto-discovers any tool declared in this package, so adding a new tool does not
    require editing ``react_agent.py`` — just drop the tool file in this folder.
"""
from __future__ import annotations

import importlib
import pkgutil

from langchain_core.tools import BaseTool

_EXCLUDE = {"registry"}


def discover_tools() -> list[BaseTool]:
    """Import every module in this package and collect its BaseTool instances."""
    import app.agents.tools as pkg

    found: dict[str, BaseTool] = {}
    for _, mod_name, _ in pkgutil.iter_modules(pkg.__path__):
        if mod_name in _EXCLUDE:
            continue
        module = importlib.import_module(f"{pkg.__name__}.{mod_name}")
        for value in vars(module).values():
            if isinstance(value, BaseTool):
                found[value.name] = value
    return list(found.values())
