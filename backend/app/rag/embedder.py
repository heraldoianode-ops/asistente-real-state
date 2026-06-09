from app.core.llm import get_embeddings
from typing import List
import asyncio

BATCH_SIZE = 16


async def embed_text(text: str) -> List[float]:
    embeddings = get_embeddings()
    return await embeddings.aembed_query(text)


async def embed_batch(texts: List[str]) -> List[List[float]]:
    embeddings = get_embeddings()
    results = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        batch_results = await asyncio.gather(*[embeddings.aembed_query(t) for t in batch])
        results.extend(batch_results)
    return results
