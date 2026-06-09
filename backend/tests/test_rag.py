import pytest
from app.rag.chunker import chunk_text


def test_chunk_text_basic():
    text = "a" * 5000
    chunks = chunk_text(text)
    assert len(chunks) > 1
    assert len(chunks[0]) == 1800


def test_chunk_text_overlap():
    text = "abcdefghij" * 300  # 3000 chars
    chunks = chunk_text(text, chunk_size=1800, overlap=360)
    # Second chunk starts 1800-360=1440 chars in
    assert chunks[1][:10] == text[1440:1450]
