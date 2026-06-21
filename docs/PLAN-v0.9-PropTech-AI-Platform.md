# PropTech AI Platform — Plan de Trabajo v0.9.0 / Work Plan v0.9.0

> Re-baseline de "Asistente de Real State" → **PropTech AI Platform**.
> Multi-tenant · modular · escalable · serverless (Supabase + Netlify) · WhatsApp-first · LLM free-first.
> Fecha: 2026-06-21 · Branch: `claude/cool-gates-p2lfkg`

---

## 0. Objetivo / Goal

**ES:** Vender más propiedades, captar más inmuebles, mejorar la experiencia de usuario y reducir
drásticamente la carga de asesores, secretarias y el martillero/broker.

**EN:** Sell more properties, capture more listings, improve UX, and drastically reduce the workload of
advisors, secretaries and the auctioneer/broker.

---

## 1. Arquitectura técnica / Technical architecture

| Capa / Layer | Decisión / Decision |
|---|---|
| Frontend | Next.js 14 en Netlify (`@netlify/plugin-nextjs`) |
| Backend + DB | Supabase (PostgreSQL + pgvector + Edge Functions Deno) |
| Auth | Supabase Auth + `@supabase/ssr`, RLS multi-tenant |
| Canal | WhatsApp Cloud API vía gateway slim Node.js (Hetzner CX11) |
| Tareas programadas | GitHub Actions / Cron-Job.org → Edge Functions **protegidas con llave secreta** |
| LLM Router | **Ollama (gratis, default)** → **DeepSeek API** (media) → **Claude API** (solo a pedido del admin) |
| Matching | pgvector **aditivo y gratuito** (embeddings Ollama) + análisis de chats |
| Web | **Sin acceso externo.** Solo verificar el link de aviso consultado |

**Política LLM (D016):** chat, matching, resumen y meta-aprendizaje cuestan **cero tokens de Claude**.
Claude se usa **únicamente cuando el administrador lo solicita** para análisis y reportes pesados.

---

## 2. Cimientos reutilizados / Reused foundation (ya DONE)

Multi-tenant schema, RLS, Supabase Auth + RBAC base, panel de números WhatsApp, dashboards admin/agente,
export CSV, branding, CRUD propiedades/clientes/eventos, gateway slim, **pgvector matching** (se conserva).

---

## 3. Roadmap modular / Modular roadmap

### M0 — Platform Core (infra) — *en progreso*
- **F100** LLM Router (Ollama → DeepSeek → Claude admin-only).
- **F101** Scheduler con llave secreta (GitHub Actions / Cron-Job.org → Edge Fn).
- **F102** Ingesta + **resumen de chats** preservando contexto en Supabase.
- **F103** Verificador de link de aviso (sin crawl; confirma que una URL consultada es una propiedad).

### M1 — Canal Conversacional (5 contextos)
- **F110** Clasificador/router de contexto.
- **F111** *Ventas/Dueños* — reportes del estado del inmueble a demanda.
- **F112** *Compras/Interesados* — asesoría + agenda de visitas **con confirmación explícita del asesor**.
- **F113** *Trámites varios* — deriva al WhatsApp personal de la martillera.
- **F114** *Inquilinos/Arrendatarios* — deriva al WhatsApp del área de alquileres.
- **F115** *IA independiente + meta-aprendizaje* (LLM gratis) — éxito/fracaso + consejos de comunicación asertiva.

### M2 — Alarmas & Matching
- **F120** Alarmas de incumplimiento (visita / documentación / reporte) → martillero.
- **F121** Negocio entrelazado **activo** (chats + pgvector aditivo, gratis).
- **F122** Entrelazamiento **oculto** (descarta los vigentes; notifica martillero + asesores).
- **F123** Gestión de documentación de capturas (solicita → reenvía al martillero para validar).

### M3 — Motor de Reportes & Agenda
- **F130** Reportes a propietarios — periodos programables.
- **F131** Reportes de actividad de asesores + consejos estadísticos personalizados.
- **F132** Listas consolidadas a demanda (admin / martillera / marketing).
- **F133** Calendario central + reporte semanal automático de visitas por WhatsApp.

### M4 — Matriz de Permisos (4 niveles)
- **F140** RBAC: **N1** Propiedades · **N2** Dueños · **N3** Martillero · **N4** Admin, con scoping RLS.

### M5 — Panel de Asesores
- **F150** Auto-gestión: datos personales, horarios de disponibilidad semanal, reportes a demanda.

---

## 4. Matriz de permisos / Permission matrix

| Nivel | Alcance |
|---|---|
| **N1 — Propiedades** | Asiste interesados, genera solicitudes de visita. |
| **N2 — Dueños** | Reportes de comercialización, coordina visitas de captación, agenda reuniones. |
| **N3 — Martillero** | Reportes avanzados, alarmas de incumplimiento, agenda global, métricas de equipo, validación de documentación. |
| **N4 — Administrador** | Config total, habilita/deshabilita usuarios, gestiona reportes, carga datos de respaldo al chatbot, configura números WhatsApp y horarios, descarga CSV. |

---

## 5. Limpieza requerida / Cleanup (deuda técnica)

- **TD-007 (HIGH):** quitar de `next.config.js` el proxy `/api/* → backend:8000` y `output:'standalone'`.
- **TD-008 (MEDIUM):** eliminar `gateway/` legacy; consolidar en `whatsapp-gateway/` slim.
- **TD-006 (MEDIUM):** borrar `backend/` (FastAPI) y limpiar `docker-compose.yml` (celery/redis/postgres).

## 6. Fuera de alcance / Out of scope (archivado)

Scraper Adinco (Playwright), sync Google Drive/Excel, lead scoring XGBoost/LightGBM/SHAP, RAG,
analítica Plotly pesada, agente ReAct LangChain, Redis/Celery. Disponibles como **módulos opcionales futuros**.
