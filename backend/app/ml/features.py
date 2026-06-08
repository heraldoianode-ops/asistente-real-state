from dataclasses import dataclass
from app.models.client import Client
from app.models.interaction import Interaction
from app.models.event import Event, EventStatus
from sqlalchemy import select, func
from datetime import datetime, timedelta


@dataclass
class ClientFeatures:
    days_since_first_contact: float
    total_interactions: int
    interactions_last_7d: int
    interactions_last_30d: int
    has_budget: int
    budget_usd: float
    has_preferred_neighborhood: int
    has_preferred_type: int
    min_bedrooms: int
    events_scheduled: int
    events_completed: int
    events_cancelled: int
    completion_rate: float
    days_since_last_interaction: float
    has_wa_contact: int
    preferred_operation_buy: int
    preferred_operation_rent: int


async def extract_features(client: Client, db) -> ClientFeatures:
    now = datetime.utcnow()

    interactions = await db.execute(
        select(func.count(Interaction.id)).where(Interaction.client_id == client.id)
    )
    total_interactions = interactions.scalar() or 0

    last_7d = await db.execute(
        select(func.count(Interaction.id)).where(
            Interaction.client_id == client.id,
            Interaction.created_at >= now - timedelta(days=7)
        )
    )
    last_30d = await db.execute(
        select(func.count(Interaction.id)).where(
            Interaction.client_id == client.id,
            Interaction.created_at >= now - timedelta(days=30)
        )
    )

    events = await db.execute(
        select(Event).where(Event.client_id == client.id)
    )
    all_events = events.scalars().all()
    scheduled = sum(1 for e in all_events)
    completed = sum(1 for e in all_events if e.status == EventStatus.completed)
    cancelled = sum(1 for e in all_events if e.status == EventStatus.cancelled)

    last_interaction = await db.execute(
        select(func.max(Interaction.created_at)).where(Interaction.client_id == client.id)
    )
    last_dt = last_interaction.scalar()
    days_since_last = (now - last_dt).days if last_dt else 999

    days_since_first = (now - client.created_at).days if client.created_at else 0

    return ClientFeatures(
        days_since_first_contact=days_since_first,
        total_interactions=total_interactions,
        interactions_last_7d=last_7d.scalar() or 0,
        interactions_last_30d=last_30d.scalar() or 0,
        has_budget=1 if client.budget else 0,
        budget_usd=float(client.budget or 0),
        has_preferred_neighborhood=1 if client.preferred_neighborhoods else 0,
        has_preferred_type=1 if client.preferred_property_type else 0,
        min_bedrooms=client.min_bedrooms or 0,
        events_scheduled=scheduled,
        events_completed=completed,
        events_cancelled=cancelled,
        completion_rate=completed / scheduled if scheduled > 0 else 0.0,
        days_since_last_interaction=days_since_last,
        has_wa_contact=1 if client.wa_contact_id else 0,
        preferred_operation_buy=1 if client.preferred_operation == "buy" else 0,
        preferred_operation_rent=1 if client.preferred_operation == "rent" else 0,
    )
