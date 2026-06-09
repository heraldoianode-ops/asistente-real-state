from langchain_core.tools import tool
from sqlalchemy import select, and_
from app.models.property import Property, PropertyStatus
import json


@tool
async def search_properties_tool(query: str, max_price: float = None, bedrooms: int = None, operation_type: str = None) -> str:
    """Search available properties. Returns top 5 matches as JSON."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        filters = [Property.status == PropertyStatus.available]
        if max_price:
            filters.append(Property.price <= max_price)
        if bedrooms:
            filters.append(Property.bedrooms >= bedrooms)
        if operation_type:
            filters.append(Property.operation_type == operation_type)

        result = await db.execute(select(Property).where(and_(*filters)).limit(5))
        props = result.scalars().all()

        if not props:
            return "No properties found matching the criteria."

        return json.dumps([{
            "id": str(p.id),
            "title": p.title,
            "address": p.address,
            "neighborhood": p.neighborhood,
            "price": float(p.price),
            "currency": p.currency,
            "bedrooms": p.bedrooms,
            "sqm_covered": p.sqm_covered,
            "operation_type": p.operation_type,
        } for p in props])
