# Asistente Real State

PropTech AI platform — WhatsApp-first real estate assistant. Supabase-native architecture: Next.js 14 dashboard on Netlify, Supabase (Postgres + pgvector + Auth + Edge Functions), and a slim Node.js WhatsApp gateway.

## Stack

| Layer | Technology |
|---|---|
| Dashboard | Next.js 14 + Tailwind (Netlify) |
| Auth | Supabase Auth + `@supabase/ssr` |
| Database | Supabase Postgres 16 + pgvector |
| Backend logic | Supabase Edge Functions (Deno) |
| WhatsApp gateway | Node.js / Express (Hetzner CX11) |
| Multi-tenant | Row Level Security (agent scoping + admin bypass) |

> **Architecture note:** The original self-hosted FastAPI + Celery + Docker Compose
> stack was superseded in Fase 8 by the Supabase-native architecture above. It is
> preserved in history under the `legacy-fastapi-backend` git tag (TD-006).

## Roadmap

| Phase | Node | Status |
|---|---|---|
| 1–6 | Core features (agent, ML, RAG, analytics, scraping, hardening) | COMPLETE |
| 7 | Multi-tenant schema + RLS + RBAC | COMPLETE |
| 8 | Netlify + Supabase native + design system | COMPLETE (v0.8.2 live) |

## Quick start (dashboard)

```bash
cp .env.example .env   # fill in Supabase values
cd dashboard
npm install
npm run dev            # http://localhost:3000
```

## WhatsApp gateway

```bash
cd whatsapp-gateway
npm install
npm start              # http://localhost:3001
```

## Edge Functions

Deployed via the Supabase CLI: `match-properties`, `notify-agent`, `create-agent`.

Live: https://solernou.netlify.app
