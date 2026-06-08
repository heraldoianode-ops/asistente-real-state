import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import (
    health, auth, properties, clients, events,
    agent, analytics, crm, matching, predictions,
    rag, scraping, feedback
)

if settings.sentry_dsn:
    sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Asistente Real State API",
    version="0.6.2",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(properties.router, prefix="/properties")
app.include_router(clients.router, prefix="/clients")
app.include_router(events.router, prefix="/events")
app.include_router(agent.router, prefix="/agent")
app.include_router(analytics.router, prefix="/analytics")
app.include_router(crm.router, prefix="/crm")
app.include_router(matching.router, prefix="/matching")
app.include_router(predictions.router, prefix="/predictions")
app.include_router(rag.router, prefix="/rag")
app.include_router(scraping.router, prefix="/scraping")
app.include_router(feedback.router, prefix="/feedback")
