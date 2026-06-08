from typing import List

DEFAULT_CHUNK_SIZE = 1800
DEFAULT_OVERLAP = 360


def chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_OVERLAP) -> List[str]:
    """Split text into overlapping chunks (P006: size=1800, overlap=360)."""
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks
