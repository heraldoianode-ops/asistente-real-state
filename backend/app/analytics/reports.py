import plotly.graph_objects as go
import plotly.express as px
import json
from app.analytics.queries import (
    funnel_counts, interactions_over_time, agent_performance,
    property_distribution, closing_forecast
)


async def funnel_chart(db) -> str:
    data = await funnel_counts(db)
    stages = list(data.keys())
    counts = list(data.values())
    fig = go.Figure(go.Funnel(y=stages, x=counts, textinfo="value+percent initial"))
    fig.update_layout(title="Lead Funnel")
    return fig.to_json()


async def activity_chart(db, days: int = 30) -> str:
    data = await interactions_over_time(db, days)
    if not data:
        return json.dumps({})
    days_list = [d["day"] for d in data]
    counts = [d["count"] for d in data]
    fig = px.line(x=days_list, y=counts, labels={"x": "Day", "y": "Interactions"}, title="Activity (last 30 days)")
    return fig.to_json()


async def agent_performance_chart(db) -> str:
    data = await agent_performance(db)
    if not data:
        return json.dumps({})
    agents = [d["agent_id"][:8] for d in data]
    fig = go.Figure(data=[
        go.Bar(name="Total", x=agents, y=[d["total"] for d in data]),
        go.Bar(name="Completed", x=agents, y=[d["completed"] for d in data]),
    ])
    fig.update_layout(barmode="group", title="Agent Performance")
    return fig.to_json()


async def property_distribution_charts(db) -> dict:
    data = await property_distribution(db)
    type_fig = px.pie(names=list(data["by_type"].keys()), values=list(data["by_type"].values()), title="By Type")
    op_fig = px.pie(names=list(data["by_operation"].keys()), values=list(data["by_operation"].values()), title="By Operation")
    return {"by_type": type_fig.to_json(), "by_operation": op_fig.to_json()}


async def forecast_chart(db) -> str:
    data = await closing_forecast(db)
    if not data:
        return json.dumps({})
    weeks = [d["week"] for d in data]
    closings = [d["scheduled_closings"] for d in data]
    fig = px.bar(x=weeks, y=closings, labels={"x": "Week", "y": "Closings"}, title="Closing Forecast (4 weeks)")
    return fig.to_json()
