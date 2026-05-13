"""Vector retrieval from kb_chunks using pgvector cosine similarity."""

from .config import settings
from .db import get_pool
from .embeddings import embed_single


async def retrieve_chunks(
    workspace_id: str,
    query: str,
    top_k: int | None = None,
) -> list[dict]:
    k = top_k or settings.ai_top_k
    query_vec = await embed_single(query)
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
        k,
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
