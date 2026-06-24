# VALKIRIA RS

PropTech AI platform — WhatsApp-first real estate assistant with semantic search (pgvector), Supabase Edge Functions, and a Next.js 14 dashboard.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS + Radix UI |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL + pgvector (768-dim) |
| Auth | Supabase Auth + @supabase/ssr |
| WhatsApp gateway | Node.js / Express (Hetzner CX11) |
| Hosting | Netlify (dashboard) + Supabase (DB + Edge Fn) |

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 1–6 | Core backend, agents, ML, RAG, analytics, hardening | COMPLETE |
| 7 | Multi-tenant schema + RBAC + privacy (RLS) | COMPLETE |
| 8 | Netlify + Supabase Native + Design System | COMPLETE (v0.8.2) |
| 9 | Pipeline de Contexto Unificado y Multiplataforma | IN PROGRESS |

## Quick start

```bash
cp .env.example .env
# fill in .env values
docker compose up -d
```

Dashboard: http://localhost:3001
WhatsApp Gateway: http://localhost:3000
