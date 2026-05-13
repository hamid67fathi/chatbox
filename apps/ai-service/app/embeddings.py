"""Embedding service — uses OpenAI if key is set, otherwise returns stub vectors."""

import hashlib
import struct

import numpy as np

from .config import settings

DIMS = 1536

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def stub_embed(text: str) -> list[float]:
    """Deterministic pseudo-random vector based on text hash."""
    h = hashlib.sha256(text.encode()).digest()
    rng = np.random.Generator(np.random.PCG64(struct.unpack("Q", h[:8])[0]))
    vec = rng.standard_normal(DIMS).astype(np.float32)
    vec /= np.linalg.norm(vec)
    return vec.tolist()


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not settings.use_openai:
        return [stub_embed(t) for t in texts]

    client = _get_client()
    response = client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


async def embed_single(text: str) -> list[float]:
    results = await embed_texts([text])
    return results[0]
