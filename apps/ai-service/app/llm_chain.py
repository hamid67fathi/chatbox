"""Multi-provider LLM chain: OpenAI → Anthropic → template stub."""

from __future__ import annotations

import logging

import httpx

from .config import settings
from .langfuse_tracing import log_generation, trace_operation
from .pii import redact

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """شما دستیار هوشمند پشتیبانی هستید. بر اساس اطلاعات زیر به سوال کاربر پاسخ دهید.
اگر مطمئن نیستید، بگویید «نیاز به بررسی بیشتر دارم».
فقط به فارسی پاسخ دهید."""

_openai_client = None


def _openai_client_get():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client


def _template_reply(question: str, context_chunks: list[dict]) -> dict:
    safe_q = redact(question)[:120]
    if context_chunks:
        snippet = redact(context_chunks[0].get("content", ""))[:160]
        reply = f"بر اساس اطلاعات موجود: {snippet}"
        confidence = 0.75
    else:
        reply = f"در حال حاضر اطلاعات کافی برای «{safe_q}» ندارم. نیاز به بررسی بیشتر دارم."
        confidence = 0.35
    return {
        "reply": reply,
        "confidence": confidence,
        "handoff": confidence < settings.ai_confidence_threshold,
        "model": "template",
        "input_tokens": 0,
        "output_tokens": 0,
    }


def _parse_confidence(reply: str, has_context: bool) -> float:
    if "نیاز به بررسی" in reply or "نمی‌دانم" in reply:
        return 0.3
    return 0.85 if has_context else 0.5


async def _try_openai(question: str, context: str) -> dict:
    client = _openai_client_get()
    response = client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"اطلاعات:\n{context}\n\nسوال: {question}",
            },
        ],
        temperature=0.3,
        max_tokens=500,
    )
    reply = response.choices[0].message.content or ""
    usage = response.usage
    has_context = bool(context.strip())
    confidence = _parse_confidence(reply, has_context)
    return {
        "reply": reply,
        "confidence": confidence,
        "handoff": confidence < settings.ai_confidence_threshold,
        "model": f"openai:{settings.openai_chat_model}",
        "input_tokens": usage.prompt_tokens if usage else 0,
        "output_tokens": usage.completion_tokens if usage else 0,
    }


async def _try_anthropic(question: str, context: str) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.anthropic_chat_model,
                "max_tokens": 500,
                "system": SYSTEM_PROMPT,
                "messages": [
                    {
                        "role": "user",
                        "content": f"اطلاعات:\n{context}\n\nسوال: {question}",
                    }
                ],
            },
        )
        res.raise_for_status()
        data = res.json()

    parts = data.get("content", [])
    reply = ""
    for p in parts:
        if p.get("type") == "text":
            reply += p.get("text", "")
    usage = data.get("usage", {})
    has_context = bool(context.strip())
    confidence = _parse_confidence(reply, has_context)
    return {
        "reply": reply.strip(),
        "confidence": confidence,
        "handoff": confidence < settings.ai_confidence_threshold,
        "model": f"anthropic:{settings.anthropic_chat_model}",
        "input_tokens": int(usage.get("input_tokens", 0)),
        "output_tokens": int(usage.get("output_tokens", 0)),
    }


async def generate_reply_with_fallback(
    question: str,
    context_chunks: list[dict],
    *,
    workspace_id: str | None = None,
    conversation_id: str | None = None,
) -> dict:
    context = "\n---\n".join(c["content"] for c in context_chunks)
    safe_question = redact(question)
    safe_context = redact(context)

    with trace_operation(
        "llm_reply",
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        metadata={"chunks": len(context_chunks)},
    ) as trace:
        if settings.use_openai:
            try:
                result = await _try_openai(safe_question, safe_context)
                log_generation(
                    trace,
                    name="openai",
                    model=result["model"],
                    input_text=f"{safe_context}\n\n{safe_question}",
                    output_text=result["reply"],
                    input_tokens=result["input_tokens"],
                    output_tokens=result["output_tokens"],
                )
                return result
            except Exception as exc:
                logger.warning("OpenAI generation failed: %s", exc)

        if settings.use_anthropic:
            try:
                result = await _try_anthropic(safe_question, safe_context)
                log_generation(
                    trace,
                    name="anthropic",
                    model=result["model"],
                    input_text=f"{safe_context}\n\n{safe_question}",
                    output_text=result["reply"],
                    input_tokens=result["input_tokens"],
                    output_tokens=result["output_tokens"],
                )
                return result
            except Exception as exc:
                logger.warning("Anthropic generation failed: %s", exc)

        result = _template_reply(safe_question, context_chunks)
        log_generation(
            trace,
            name="template",
            model=result["model"],
            input_text=safe_question,
            output_text=result["reply"],
        )
        return result
