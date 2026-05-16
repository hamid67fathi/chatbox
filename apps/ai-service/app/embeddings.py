"""Embedding service with optional OpenAI and embedding cache."""

import hashlib
import json
import struct

import numpy as np

from .cache import embedding_cache, make_key
from .config import settings
from .persian_normalize import normalize_persian

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


async def embed_texts(texts: list[str], *, use_cache: bool = True) -> list[list[float]]:
    if not texts:
        return []

    normalized = [normalize_persian(t) for t in texts]
    out: list[list[float] | None] = [None] * len(texts)
    to_fetch: list[tuple[int, str]] = []

    if use_cache:
        for i, n in enumerate(normalized):
            key = make_key("emb", n)
            hit = embedding_cache.get(key)
            if hit is not None:
                out[i] = json.loads(hit) if isinstance(hit, str) else hit
            else:
                to_fetch.append((i, texts[i]))
    else:
        to_fetch = list(enumerate(texts))

    if to_fetch:
        raw_texts = [texts[i] for i, _ in to_fetch]
        if not settings.use_openai:
            vectors = [stub_embed(t) for t in raw_texts]
        else:
            client = _get_client()
            response = client.embeddings.create(
                model=settings.openai_embedding_model,
                input=raw_texts,
            )
            vectors = [item.embedding for item in response.data]

        for (idx, _), vec in zip(to_fetch, vectors):
            out[idx] = vec
            if use_cache:
                key = make_key("emb", normalized[idx])
                embedding_cache.set(key, json.dumps(vec))

    return [v if v is not None else stub_embed(texts[i]) for i, v in enumerate(out)]


async def embed_single(text: str) -> list[float]:
    results = await embed_texts([text])
    return results[0]
