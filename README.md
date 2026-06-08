# Asistente Real State

PropTech AI platform — WhatsApp-first real estate assistant with LangChain ReAct agents, pgvector semantic search, XGBoost lead scoring, and a Next.js 14 dashboard.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL 16 + pgvector |
| Cache / Sessions | Redis 7 |
| LLM (local-first) | Ollama (llama3) |
| Agent framework | LangChain ReAct |
| ML | XGBoost + LightGBM + SHAP |
| Task queue | Celery + Celery Beat |
| WhatsApp gateway | Node.js / Express |
| Dashboard | Next.js 14 + Tailwind |
| Infra | Docker Compose |

## Roadmap

| Phase | Node | Status |
|---|---|---|
| 1 | Core backend + DB schema | COMPLETE |
| 2 | ReAct agent + WhatsApp gateway | COMPLETE |
| 3 | ML pipeline (XGBoost lead scoring) | COMPLETE |
| 4 | RAG + semantic property search | COMPLETE |
| 5 | Analytics dashboard + scraping | COMPLETE |
| 6 | Meta-learning + production hardening | COMPLETE |

## Quick start

```bash
cp .env.example .env
# fill in .env values
docker compose up -d
```

Backend: http://localhost:8000/docs  
Dashboard: http://localhost:3001
