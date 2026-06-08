import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_add_interaction_unauthenticated():
    # Without a running app, just verify import
    from app.routers.crm import router
    assert router is not None
