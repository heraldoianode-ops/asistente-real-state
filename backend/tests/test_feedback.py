import pytest
from unittest.mock import AsyncMock
from app.routers.feedback import submit_feedback, FeedbackCreate


@pytest.mark.asyncio
async def test_submit_feedback():
    db = AsyncMock()
    body = FeedbackCreate(target="agent_response", sentiment="positive")
    result = await submit_feedback(body, db)
    assert "id" in result
