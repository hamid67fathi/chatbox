"""Vector retrieval with Persian normalization, reranking, and cache."""

from __future__ import annotations

import json

from .cache import make_key, retrieval_cache
from .config import settings
from .db import get_pool
from .embeddings import embed_single
from .persian_normalize import normalize_persian
from .reranker import rerank_chunks


async def _vector_search(
    workspace_id: str,
    query_vec: list[float],
    limit: int,
) -> list[dict]:
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, document_id, chunk_index, content,
               1 - (embedding <=> $1::vector) AS score
        FROM kb_chunks
        WHERE workspace_id = $2::uuid
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        """,
        vec_str,
        workspace_id,
        limit,
    )
    return [
        {
            "chunk_id": str(row["id"]),
            "document_id": str(row["document_id"]),
            "chunk_index": row["chunk_index"],
            "content": row["content"],
            "score": float(row["score"]),
        }
        for row in rows
    ]


async def retrieve_chunks(
    workspace_id: str,
    query: str,
    top_k: int | None = None,
) -> list[dict]:
    """
    Retrieve RAG context: normalize query, cache, fetch top-N vectors,
    rerank to top_k (default settings.ai_top_k).
    """
    final_k = top_k or settings.ai_top_k
    retrieve_k = max(settings.ai_retrieve_k, final_k)
    normalized = normalize_persian(query)

    cache_key = make_key(workspace_id, normalized, str(retrieve_k), str(final_k))
    cached = retrieval_cache.get(cache_key)
    if cached is not None:
        return json.loads(cached) if isinstance(cached, str) else cached

    query_vec = await embed_single(normalized)
    candidates = await _vector_search(workspace_id, query_vec, retrieve_k)
    ranked = await rerank_chunks(normalized, candidates, top_n=final_k)

    retrieval_cache.set(cache_key, json.dumps(ranked, ensure_ascii=False))
    return ranked
