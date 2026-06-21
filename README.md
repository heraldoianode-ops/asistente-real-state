# PropTech AI Platform

Plataforma inmobiliaria **multi-tenant, modular y escalable**. Asistente WhatsApp-first para
dueños, interesados, asesores y martillero/broker. Serverless sobre **Supabase + Netlify**, con
ruteo de LLM **free-first** (Ollama → DeepSeek → Claude solo a pedido del admin).

> Re-baseline **v0.9.0** del proyecto antes llamado *Asistente de Real State*.
> Plan completo: [`docs/PLAN-v0.9-PropTech-AI-Platform.md`](docs/PLAN-v0.9-PropTech-AI-Platform.md)

## Objetivo

Vender más propiedades, captar más inmuebles, mejorar la experiencia de usuario y **reducir
drásticamente la carga de asesores, secretarias y el martillero**.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (Netlify) |
| Backend + DB | Supabase (PostgreSQL + pgvector + Edge Functions Deno) |
| Auth | Supabase Auth + `@supabase/ssr` + RLS multi-tenant |
| Canal | WhatsApp Cloud API (gateway slim Node.js) |
| Tareas programadas | GitHub Actions / Cron-Job.org → Edge Functions con llave secreta |
| LLM | Ollama (gratis) · DeepSeek (media) · Claude (heavy, solo a pedido del admin) |

## Módulos (roadmap v0.9.0)

- **M0** Platform Core — LLM router · scheduler con llave secreta · resumen de chats · verificador de links.
- **M1** Canal Conversacional — 5 contextos (Ventas, Compras, Trámites, Inquilinos, IA meta-aprendizaje).
- **M2** Alarmas & Matching — incumplimiento · entrelazado activo · entrelazado oculto · docs de captura.
- **M3** Reportes & Agenda — propietarios · asesores · admin/marketing · calendario semanal.
- **M4** Permisos — 4 niveles (N1 Propiedades · N2 Dueños · N3 Martillero · N4 Admin).
- **M5** Panel de Asesores — datos, horarios de disponibilidad, reportes a demanda.

## Principios

- **Free-first**: chat, matching, resumen y meta-aprendizaje cuestan **cero tokens de Claude**.
- **Sin acceso web**: solo se verifica el link de aviso consultado para confirmar que es una propiedad.
- **Modular y escalable**: cada módulo se añade sin tocar los demás.

## Estructura

```
dashboard/          Next.js 14 (Netlify)
supabase/functions/ Edge Functions (Deno)
whatsapp-gateway/   Gateway slim (supabase-js directo)
db/                 Schema + migraciones (multi-tenant, RLS, branding)
__AI_CORE__/        Estado del proyecto (config, features, decisions, roadmap)
docs/               Plan de trabajo
```

## Quick start (dashboard)

```bash
cp .env.example .env   # completar valores de Supabase
cd dashboard && npm install && npm run dev
```

---
*Nota: el stack legacy (FastAPI/Celery/Redis, scraper Adinco, RAG, XGBoost) está deprecado y en proceso de
remoción — ver `__AI_CORE__/tech_debt.json` (TD-006/007/008).*
