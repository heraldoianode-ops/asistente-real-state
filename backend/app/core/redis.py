import redis.asyncio as aioredis
from app.core.config import settings
import json

_pool = None


async def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _pool


async def get_session(key: str) -> str | None:
    r = await get_redis()
    return await r.get(f"session:{key}")


async def set_session(key: str, value: str, ttl: int = 86400):
    r = await get_redis()
    await r.setex(f"session:{key}", ttl, value)


async def append_to_session(key: str, turn: dict, max_turns: int = 20, ttl: int = 86400):
    r = await get_redis()
    raw = await r.get(f"session:{key}")
    history = json.loads(raw) if raw else []
    history.append(turn)
    await r.setex(f"session:{key}", ttl, json.dumps(history[-max_turns:]))


async def clear_session(key: str):
    r = await get_redis()
    await r.delete(f"session:{key}")
