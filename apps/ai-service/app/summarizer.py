"""Conversation summarization for agent handoff."""

from __future__ import annotations

import json

from .config import settings
from .pii import redact

_client = None

SUMMARY_SYSTEM = """شما خلاصه‌نویس مکالمات پشتیبانی هستید.
یک خلاصه فارسی کوتاه (۳–۵ جمله) برای اپراتور بنویسید شامل:
- موضوع اصلی
- وضعیت فعلی / درخواست مشتری
- نکات مهم یا احساس کلی
فقط متن خلاصه را برگردانید، بدون عنوان."""


def _format_messages(messages: list[dict[str, str]], contact_name: str | None) -> str:
	lines: list[str] = []
	for m in messages[-40:]:
		role = m.get("role", "contact")
		content = (m.get("content") or "").strip()
		if not content:
			continue
		if role in ("contact", "user", "visitor"):
			who = contact_name or "مشتری"
			lines.append(f"{who}: {content}")
		elif role == "agent":
			lines.append(f"اپراتور: {content}")
		elif role == "ai":
			lines.append(f"AI: {content}")
	return "\n".join(lines) if lines else "(پیامی نیست)"


def _stub_summary(messages: list[dict[str, str]], contact_name: str | None) -> str:
	transcript = _format_messages(messages, contact_name)
	lines = [ln for ln in transcript.split("\n") if ln.strip()]
	count = len(lines)
	last = lines[-1] if lines else ""
	return (
		f"خلاصه خودکار: این مکالمه شامل {count} پیام است. "
		f"آخرین پیام: {last[:120]}{'…' if len(last) > 120 else ''}"
	)


def _get_client():
	global _client
	if _client is None:
		from openai import OpenAI

		_client = OpenAI(api_key=settings.openai_api_key)
	return _client


async def summarize_conversation(
	messages: list[dict[str, str]],
	contact_name: str | None = None,
) -> dict:
	transcript = _format_messages(messages, contact_name)
	safe = redact(transcript)

	if not settings.use_openai or not safe.strip() or safe == "(پیامی نیست)":
		return {
			"summary": _stub_summary(messages, contact_name),
			"model": "stub",
			"input_tokens": 0,
			"output_tokens": 0,
		}

	client = _get_client()
	response = client.chat.completions.create(
		model=settings.openai_chat_model,
		messages=[
			{"role": "system", "content": SUMMARY_SYSTEM},
			{"role": "user", "content": f"تاریخچه مکالمه:\n{safe}"},
		],
		temperature=0.3,
		max_tokens=400,
	)
	summary = (response.choices[0].message.content or "").strip()
	usage = response.usage
	return {
		"summary": summary or _stub_summary(messages, contact_name),
		"model": settings.openai_chat_model,
		"input_tokens": usage.prompt_tokens if usage else 0,
		"output_tokens": usage.completion_tokens if usage else 0,
	}
