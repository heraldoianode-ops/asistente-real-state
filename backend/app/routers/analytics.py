from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_current_user
from app.analytics.reports import funnel_chart, activity_chart, agent_performance_chart, property_distribution_charts, forecast_chart

router = APIRouter(tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/funnel")
async def get_funnel(db: AsyncSession = Depends(get_db)):
    return {"chart": await funnel_chart(db)}


@router.get("/activity")
async def get_activity(db: AsyncSession = Depends(get_db)):
    return {"chart": await activity_chart(db)}


@router.get("/agents")
async def get_agents(db: AsyncSession = Depends(get_db)):
    return {"chart": await agent_performance_chart(db)}


@router.get("/properties")
async def get_properties(db: AsyncSession = Depends(get_db)):
    return await property_distribution_charts(db)


@router.get("/forecast")
async def get_forecast(db: AsyncSession = Depends(get_db)):
    return {"chart": await forecast_chart(db)}
