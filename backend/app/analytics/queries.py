from sqlalchemy import select, func, text, Integer
from app.models.client import Client, LeadStage
from app.models.interaction import Interaction
from app.models.event import Event, EventStatus
from app.models.property import Property
from datetime import datetime, timedelta


async def funnel_counts(db) -> dict:
    result = await db.execute(
        select(Client.lead_stage, func.count(Client.id)).group_by(Client.lead_stage)
    )
    return {row[0]: row[1] for row in result.all()}


async def interactions_over_time(db, days: int = 30) -> list:
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(
            func.date_trunc('day', Interaction.created_at).label('day'),
            func.count(Interaction.id).label('count')
        )
        .where(Interaction.created_at >= since)
        .group_by('day')
        .order_by('day')
    )
    return [{"day": str(r.day), "count": r.count} for r in result.all()]


async def agent_performance(db) -> list:
    result = await db.execute(
        select(
            Event.agent_id,
            func.count(Event.id).label('total'),
            func.sum(
                func.cast(Event.status == EventStatus.completed, Integer)
            ).label('completed')
        ).group_by(Event.agent_id)
    )
    return [{"agent_id": str(r.agent_id), "total": r.total, "completed": r.completed or 0} for r in result.all()]


async def property_distribution(db) -> dict:
    by_type = await db.execute(
        select(Property.property_type, func.count(Property.id)).group_by(Property.property_type)
    )
    by_op = await db.execute(
        select(Property.operation_type, func.count(Property.id)).group_by(Property.operation_type)
    )
    return {
        "by_type": {r[0]: r[1] for r in by_type.all()},
        "by_operation": {r[0]: r[1] for r in by_op.all()},
    }


async def closing_forecast(db, weeks: int = 4) -> list:
    result = await db.execute(
        select(
            func.date_trunc('week', Event.scheduled_at).label('week'),
            func.count(Event.id).label('scheduled_closings')
        )
        .where(
            Event.event_type == 'closing',
            Event.scheduled_at >= datetime.utcnow(),
            Event.scheduled_at <= datetime.utcnow() + timedelta(weeks=weeks),
        )
        .group_by('week')
        .order_by('week')
    )
    return [{"week": str(r.week), "scheduled_closings": r.scheduled_closings} for r in result.all()]
