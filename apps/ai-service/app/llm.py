"""LLM completion — uses OpenAI if key is set, otherwise returns a stub response."""

from .config import settings
from .pii import redact

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


SYSTEM_PROMPT = """شما دستیار هوشمند پشتیبانی هستید. بر اساس اطلاعات زیر به سوال کاربر پاسخ دهید.
اگر مطمئن نیستید، بگویید «نیاز به بررسی بیشتر دارم» و handoff=true برگردانید.
فقط به فارسی پاسخ دهید."""


async def generate_reply(
    question: str,
    context_chunks: list[dict],
) -> dict:
    context = "\n---\n".join(c["content"] for c in context_chunks)
    safe_question = redact(question)
    safe_context = redact(context)

    if not settings.use_openai:
        has_context = len(context_chunks) > 0
        confidence = 0.85 if has_context else 0.3
        return {
            "reply": f"[STUB] پاسخ به: {safe_question[:80]}",
            "confidence": confidence,
            "handoff": confidence < settings.ai_confidence_threshold,
            "model": "stub",
            "input_tokens": 0,
            "output_tokens": 0,
        }

    client = _get_client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"اطلاعات:\n{safe_context}\n\nسوال: {safe_question}"},
    ]

    response = client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        temperature=0.3,
        max_tokens=500,
    )

    reply = response.choices[0].message.content or ""
    usage = response.usage

    confidence = 0.85 if context_chunks else 0.5
    if "نیاز به بررسی" in reply or "نمی‌دانم" in reply:
        confidence = 0.3

    return {
        "reply": reply,
        "confidence": confidence,
        "handoff": confidence < settings.ai_confidence_threshold,
        "model": settings.openai_chat_model,
        "input_tokens": usage.prompt_tokens if usage else 0,
        "output_tokens": usage.completion_tokens if usage else 0,
    }
