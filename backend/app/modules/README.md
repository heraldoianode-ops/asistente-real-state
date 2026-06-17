# Módulos / Modules

ES: Cada capacidad del sistema es un **módulo** que se puede activar o desactivar por
inmobiliaria mediante *feature flags* (tabla `app_settings`, clave
`module.<name>.enabled`). Esto permite mejorar, actualizar e integrar aspectos nuevos
sin reescribir el núcleo.

EN: Each capability is a **module** that can be toggled per agency via feature flags
(`app_settings` table, key `module.<name>.enabled`). This allows improving, updating and
integrating new aspects without rewriting the core.

## Agregar un módulo / Add a module

1. Registrar la capacidad en `app/modules/__init__.py`:

   ```python
   register_module(ModuleSpec(
       name="my_module",
       title_es="Mi módulo", title_en="My module",
       description_es="...", description_en="...",
       phase=1, default_enabled=True,
   ))
   ```

2. Para integraciones externas, implementar el **puerto** correspondiente en
   `app/integrations/` (`CalendarProvider`, `ExternalCRMSource`, `MessagingChannel`) y
   registrarlo en su `*_registry`.

3. Para nuevas **tools** del agente, dejar el archivo en `app/agents/tools/`: se
   auto-descubre vía `app/agents/tools/registry.py` (`discover_tools()`), sin tocar
   `react_agent.py`.

4. Verificar el estado / toggling desde `GET /modules` y `PUT /modules/{name}`
   (panel admin → Módulos).
