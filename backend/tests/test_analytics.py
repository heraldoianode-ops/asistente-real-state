import pytest
from unittest.mock import AsyncMock, MagicMock
from app.analytics.queries import funnel_counts


@pytest.mark.asyncio
async def test_funnel_counts_empty_db():
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.all.return_value = []
    db.execute.return_value = mock_result
    result = await funnel_counts(db)
    assert result == {}
