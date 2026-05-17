"""Optional Langfuse tracing for LLM calls and RAG."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterator

from .config import settings

logger = logging.getLogger(__name__)

_client: Any = None
_enabled: bool | None = None


def langfuse_enabled() -> bool:
    global _enabled
    if _enabled is None:
        _enabled = bool(
            settings.langfuse_public_key and settings.langfuse_secret_key
        )
    return _enabled


def _client_get() -> Any:
    global _client
    if _client is None:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
    return _client


@contextmanager
def trace_operation(
    name: str,
    *,
    workspace_id: str | None = None,
    conversation_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Iterator[Any]:
    if not langfuse_enabled():
        yield None
        return
    try:
        client = _client_get()
        trace = client.trace(
            name=name,
            user_id=workspace_id,
            session_id=conversation_id,
            metadata=metadata or {},
        )
        yield trace
    except Exception as exc:
        logger.warning("Langfuse trace failed: %s", exc)
        yield None


def log_generation(
    trace: Any,
    *,
    name: str,
    model: str,
    input_text: str,
    output_text: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    metadata: dict[str, Any] | None = None,
) -> None:
    if trace is None:
        return
    try:
        trace.generation(
            name=name,
            model=model,
            input=input_text[:8000],
            output=output_text[:8000],
            usage={"input": input_tokens, "output": output_tokens},
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("Langfuse generation failed: %s", exc)
