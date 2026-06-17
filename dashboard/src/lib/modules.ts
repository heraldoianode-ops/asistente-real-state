// Module catalog (dashboard mirror of backend app/modules/__init__.py).
// ES: Catálogo de módulos. El estado activo/inactivo vive en app_settings con la clave
//     `module.<name>.enabled`; backend y dashboard se sincronizan por esa clave.
// EN: Module catalog. Enabled state lives in app_settings under `module.<name>.enabled`;
//     backend and dashboard stay in sync through that key.

export interface ModuleSpec {
  name: string
  titleEs: string
  descriptionEs: string
  phase: number
  defaultEnabled: boolean
}

export const flagKey = (name: string) => `module.${name}.enabled`

export const MODULES: ModuleSpec[] = [
  { name: 'calendar', titleEs: 'Agenda en Google Calendar', descriptionEs: 'Agenda y sincroniza visitas en el Google Calendar del agente.', phase: 1, defaultEnabled: true },
  { name: 'manual_entry', titleEs: 'Carga manual', descriptionEs: 'Alta y edición manual de clientes, inmuebles y propietarios.', phase: 1, defaultEnabled: true },
  { name: 'owner_reports', titleEs: 'Reportes a propietarios', descriptionEs: 'Genera y envía reportes de actividad a los propietarios.', phase: 1, defaultEnabled: true },
  { name: 'theming', titleEs: 'Personalización visual', descriptionEs: 'Logo y selección de colores de la interfaz.', phase: 1, defaultEnabled: true },
  { name: 'conversation_summary', titleEs: 'Resumen de conversaciones', descriptionEs: 'Persiste y resume conversaciones de WhatsApp para el matching.', phase: 2, defaultEnabled: true },
  { name: 'matching', titleEs: 'Coincidencias entre agentes', descriptionEs: 'Detecta coincidencias entre demanda y oferta y alerta a los agentes.', phase: 2, defaultEnabled: true },
  { name: 'work_planner', titleEs: 'Plan de trabajo / modo autónomo', descriptionEs: 'Próximos pasos y seguimientos; modo asistido o autónomo.', phase: 3, defaultEnabled: true },
  { name: 'adinco', titleEs: 'Integración Adinco', descriptionEs: 'Sincroniza datos desde el CRM Adinco (scraping autenticado).', phase: 3, defaultEnabled: false },
]

export const truthy = (value: string | null | undefined): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
