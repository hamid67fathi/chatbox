"""LLM completion — delegates to multi-provider fallback chain."""

from __future__ import annotations

import json

from .cache import answer_cache, make_key
from .llm_chain import generate_reply_with_fallback
from .persian_normalize import normalize_persian


async def generate_reply(
    question: str,
    context_chunks: list[dict],
    *,
    workspace_id: str | None = None,
    use_cache: bool = True,
) -> dict:
    normalized_q = normalize_persian(question)
    chunk_sig = ",".join(c.get("chunk_id", "") for c in context_chunks)
    cache_key = (
        make_key(workspace_id or "global", normalized_q, chunk_sig)
        if workspace_id
        else None
    )

    if use_cache and cache_key:
        hit = answer_cache.get(cache_key)
        if hit is not None:
            return json.loads(hit) if isinstance(hit, str) else hit

    result = await generate_reply_with_fallback(question, context_chunks)

    if use_cache and cache_key and not result.get("handoff"):
        answer_cache.set(cache_key, json.dumps(result, ensure_ascii=False))

    return result
