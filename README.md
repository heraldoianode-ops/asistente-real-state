# Asistente Real State

PropTech AI platform — WhatsApp-first real estate assistant. Multi-tenant catalog,
CRM with lead stages, semantic property matching and cross-agent notifications,
built on Supabase (Postgres + pgvector + RLS + Edge Functions) with a Next.js 14
dashboard on Netlify.

## Stack

| Layer | Technology |
|---|---|
| Dashboard | Next.js 14 + Tailwind (Netlify) |
| Backend logic | Supabase Edge Functions (Deno) |
| Database | Supabase Postgres 16 + pgvector |
| Auth | Supabase Auth + `@supabase/ssr` (admin / agent RBAC + RLS) |
| WhatsApp gateway | Node.js / Express slim (`whatsapp-gateway/`) — Hetzner CX11 |
| Infra | Netlify (dashboard) + Supabase (DB + Edge Fn) + Hetzner (WA gateway) |

## Repository layout

| Path | Purpose |
|---|---|
| `dashboard/` | Next.js 14 dashboard — talks to Supabase directly via `supabase-js` |
| `supabase/functions/` | Edge Functions: `match-properties`, `notify-agent`, `create-agent` |
| `db/migrations/` | Postgres schema, RLS policies, multi-tenant, branding, RPCs |
| `whatsapp-gateway/` | Slim Express webhook → Supabase (WhatsApp Cloud API) |

## Quick start (local dashboard)

```bash
cd dashboard
cp .env.local.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev                        # http://localhost:3000
```

Database schema lives in `db/migrations/` (apply via the Supabase CLI or dashboard).
Edge Functions are deployed with `supabase functions deploy`.

## Roadmap

| Phase | Node | Status |
|---|---|---|
| 1 | Core data model + CRM | COMPLETE |
| 2 | ReAct agent + WhatsApp gateway | COMPLETE |
| 3 | ML lead scoring | COMPLETE |
| 4 | RAG + semantic property search (pgvector) | COMPLETE |
| 5 | Analytics dashboard + scraping | COMPLETE |
| 6 | Meta-learning + production hardening | COMPLETE |
| 7 | Multi-tenant + RLS + RBAC + cross-agent matches | COMPLETE |
| 8 | Netlify + Supabase native + design system | COMPLETE |

## Production

- Dashboard: https://solernou.netlify.app
- Supabase project: `mh-systems-platform` (schema `asistente_real_state`)
