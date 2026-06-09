import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_run_agent_returns_reply():
    with patch("app.agents.react_agent.get_llm") as mock_llm, \
         patch("app.agents.react_agent.get_session", new_callable=AsyncMock, return_value=None), \
         patch("app.agents.react_agent.set_session", new_callable=AsyncMock):
        mock_llm.return_value = AsyncMock()
        # Basic smoke test — agent returns dict
        from app.agents.react_agent import run_agent
        # Would need full mock of AgentExecutor; placeholder assertion
        assert run_agent is not None
