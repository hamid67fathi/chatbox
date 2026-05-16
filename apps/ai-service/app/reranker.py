"""Rerank retrieved chunks — Cohere API with vector-score fallback."""

from __future__ import annotations

import logging

import httpx

from .config import settings
from .persian_normalize import normalize_persian

logger = logging.getLogger(__name__)


async def rerank_chunks(
    query: str,
    chunks: list[dict],
    top_n: int | None = None,
) -> list[dict]:
    """Return top_n chunks after reranking (default: settings.ai_top_k)."""
    k = top_n or settings.ai_top_k
    if not chunks:
        return []
    if len(chunks) <= k:
        return chunks

    if settings.use_cohere:
        try:
            return await _cohere_rerank(query, chunks, k)
        except Exception as exc:
            logger.warning("Cohere rerank failed, using vector order: %s", exc)

    return sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)[:k]


async def _cohere_rerank(query: str, chunks: list[dict], top_n: int) -> list[dict]:
    nq = normalize_persian(query)
    documents = [c.get("content", "") for c in chunks]

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            "https://api.cohere.ai/v1/rerank",
            headers={
                "Authorization": f"Bearer {settings.cohere_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.cohere_rerank_model,
                "query": nq,
                "documents": documents,
                "top_n": top_n,
            },
        )
        res.raise_for_status()
        data = res.json()

    out: list[dict] = []
    for item in data.get("results", []):
        idx = item.get("index", 0)
        if 0 <= idx < len(chunks):
            chunk = {**chunks[idx]}
            chunk["rerank_score"] = float(item.get("relevance_score", 0))
            out.append(chunk)
    return out
