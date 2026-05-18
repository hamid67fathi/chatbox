"""Agent copilot — three reply suggestions (brief / friendly / detailed)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from .config import settings
from .persona import merge_system_prompt
from .pii import redact
from .retriever import retrieve_chunks

_client = None

COPILOT_STYLES: list[tuple[str, str]] = [
    ("brief", "مختصر"),
    ("friendly", "دوستانه"),
    ("detailed", "مفصل"),
]

COPILOT_SYSTEM = """شما دستیار نگارش پاسخ اپراتور پشتیبانی هستید.
بر اساس تاریخچه مکالمه، سه پیشنهاد پاسخ به فارسی بنویسید:
1) brief — کوتاه و مستقیم (حداکثر ۲ جمله)
2) friendly — گرم و محترمانه
3) detailed — کامل با جزئیات و قدم‌های بعدی در صورت نیاز
فقط JSON برگردانید:
{"suggestions":[{"style":"brief","text":"..."},{"style":"friendly","text":"..."},{"style":"detailed","text":"..."}]}"""


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def _format_transcript(messages: list[dict[str, str]], contact_name: str | None) -> str:
    lines: list[str] = []
    for m in messages[-16:]:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role in ("contact", "user", "visitor"):
            who = contact_name or "مشتری"
            lines.append(f"{who}: {content}")
        elif role in ("agent", "assistant"):
            lines.append(f"اپراتور: {content}")
        elif role == "ai":
            lines.append(f"AI: {content}")
        else:
            lines.append(content)
    return "\n".join(lines) if lines else "(بدون تاریخچه)"


def _last_visitor_text(messages: list[dict[str, str]]) -> str:
    for m in reversed(messages):
        if m.get("role") in ("contact", "user", "visitor"):
            return (m.get("content") or "").strip()
    return ""


def _stub_suggestion(style: str, visitor_msg: str, kb_hint: str) -> str:
    topic = visitor_msg[:60] if visitor_msg else "درخواست شما"
    if style == "brief":
        return f"سلام، درباره «{topic}» بررسی می‌کنم و به‌زودی پاسخ می‌دهم."
    if style == "friendly":
        return (
            f"سلام وقت بخیر! ممنون از پیام‌تان درباره «{topic}». "
            "هم‌اکنون در حال بررسی هستم و تا چند دقیقه دیگر راهنمایی‌تان می‌کنم."
        )
    hint = f" {kb_hint}" if kb_hint else ""
    return (
        f"سلام، از تماس شما سپاسگزارم.{hint}\n"
        f"موضوع: «{topic}»\n"
        "پس از بررسی جزئیات، نتیجه را همین‌جا اطلاع می‌دهم. "
        "اگر اطلاعات تکمیلی دارید بفرمایید."
    )


async def generate_copilot_suggestions(
    workspace_id: str,
    messages: list[dict[str, str]],
    contact_name: str | None = None,
    ai_persona: dict | None = None,
) -> dict[str, Any]:
    transcript = _format_transcript(messages, contact_name)
    visitor_msg = _last_visitor_text(messages)
    safe_transcript = redact(transcript)
    safe_visitor = redact(visitor_msg)

    kb_chunks: list[dict] = []
    try:
        kb_chunks = await retrieve_chunks(
            workspace_id,
            visitor_msg or safe_transcript,
            top_k=3,
        )
    except Exception:
        kb_chunks = []
    kb_hint = kb_chunks[0]["content"][:120] if kb_chunks else ""

    if not settings.use_openai:
        suggestions = [
            {
                "style": style,
                "label": label,
                "text": _stub_suggestion(style, safe_visitor, kb_hint),
            }
            for style, label in COPILOT_STYLES
        ]
        return {
            "suggestions": suggestions,
            "model": "stub",
            "input_tokens": 0,
            "output_tokens": 0,
        }

    client = _get_client()
    user_prompt = (
        f"تاریخچه:\n{safe_transcript}\n\n"
        f"آخرین پیام مشتری:\n{safe_visitor or '(ندارد)'}\n\n"
    )
    if kb_hint:
        user_prompt += f"نکته از پایگاه دانش:\n{redact(kb_hint)}\n\n"
    user_prompt += "سه پیشنهاد پاسخ اپراتور را بنویس."

    system_prompt = merge_system_prompt(COPILOT_SYSTEM, ai_persona, "fa")
    response = client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.6,
        max_tokens=700,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    usage = response.usage
    label_by_style = dict(COPILOT_STYLES)
    suggestions: list[dict[str, str]] = []

    try:
        data = json.loads(raw)
        for item in data.get("suggestions", []):
            style = str(item.get("style", "brief"))
            text = str(item.get("text", "")).strip()
            if text:
                suggestions.append(
                    {
                        "style": style,
                        "label": label_by_style.get(style, style),
                        "text": text,
                    }
                )
    except (json.JSONDecodeError, TypeError):
        suggestions = []

    if len(suggestions) < 3:
        for style, label in COPILOT_STYLES:
            if any(s["style"] == style for s in suggestions):
                continue
            suggestions.append(
                {
                    "style": style,
                    "label": label,
                    "text": _stub_suggestion(style, safe_visitor, kb_hint),
                }
            )

    order = {s: i for i, (s, _) in enumerate(COPILOT_STYLES)}
    suggestions.sort(key=lambda x: order.get(x["style"], 99))

    return {
        "suggestions": suggestions[:3],
        "model": settings.openai_chat_model,
        "input_tokens": usage.prompt_tokens if usage else 0,
        "output_tokens": usage.completion_tokens if usage else 0,
    }


async def stream_copilot_suggestions(
    workspace_id: str,
    messages: list[dict[str, str]],
    contact_name: str | None = None,
    ai_persona: dict | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE-ready events one suggestion at a time."""
    result = await generate_copilot_suggestions(
        workspace_id, messages, contact_name, ai_persona
    )
    yield {"type": "meta", "model": result["model"]}
    for i, s in enumerate(result["suggestions"]):
        yield {
            "type": "suggestion",
            "index": i,
            "style": s["style"],
            "label": s["label"],
            "text": s["text"],
        }
    yield {
        "type": "done",
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
    }
