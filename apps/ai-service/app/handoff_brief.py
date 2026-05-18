"""Generate agent handoff brief: summary, context, suggested reply."""

from __future__ import annotations

import json

from .config import settings
from .pii import redact

_client = None

HANDOFF_SYSTEM = """You prepare a handoff brief for a human support agent taking over a chat.
Return JSON only:
{
  "summary": "3-5 sentences in Persian describing topic, customer request, and status",
  "key_points": ["bullet 1", "bullet 2"],
  "suggested_reply": "one polite reply the agent can send (2-4 sentences, Persian)"
}
Be factual. Use the conversation transcript and context provided."""


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


def _stub_brief(
	messages: list[dict[str, str]],
	contact_name: str | None,
	context: dict | None,
) -> dict:
	transcript = _format_messages(messages, contact_name)
	lines = [ln for ln in transcript.split("\n") if ln.strip()]
	last = lines[-1] if lines else ""
	name = contact_name or "مشتری"
	channel = (context or {}).get("channel", "widget")
	return {
		"summary": (
			f"مکالمه {len(lines)} پیامی با {name} از کانال {channel}. "
			f"آخرین پیام: {last[:100]}"
		),
		"key_points": ["نیاز به بررسی اپراتور", "خلاصه خودکار (بدون LLM)"],
		"suggested_reply": (
			f"سلام {name}، ممنون از صبر شما. هم‌اکنون مورد شما را بررسی می‌کنم "
			"و به‌زودی پاسخ کامل می‌دهم."
		),
		"model": "stub",
		"input_tokens": 0,
		"output_tokens": 0,
	}


def _get_client():
	global _client
	if _client is None:
		from openai import OpenAI

		_client = OpenAI(api_key=settings.openai_api_key)
	return _client


async def generate_handoff_brief(
	messages: list[dict[str, str]],
	contact_name: str | None = None,
	context: dict | None = None,
) -> dict:
	ctx = context or {}
	transcript = _format_messages(messages, contact_name)
	safe = redact(transcript)

	if not settings.use_openai or not safe.strip() or safe == "(پیامی نیست)":
		return _stub_brief(messages, contact_name, ctx)

	ctx_lines = [
		f"Channel: {ctx.get('channel', 'widget')}",
		f"Contact: {contact_name or 'unknown'}",
	]
	tags = ctx.get("tags")
	if isinstance(tags, list) and tags:
		ctx_lines.append(f"Tags: {', '.join(str(t) for t in tags[:10])}")
	if ctx.get("subject"):
		ctx_lines.append(f"Subject: {ctx['subject']}")

	client = _get_client()
	response = client.chat.completions.create(
		model=settings.openai_chat_model,
		messages=[
			{"role": "system", "content": HANDOFF_SYSTEM},
			{
				"role": "user",
				"content": (
					f"Context:\n" + "\n".join(ctx_lines) + f"\n\nTranscript:\n{safe}"
				),
			},
		],
		temperature=0.35,
		max_tokens=700,
		response_format={"type": "json_object"},
	)
	raw = response.choices[0].message.content or "{}"
	usage = response.usage
	try:
		parsed = json.loads(raw)
	except json.JSONDecodeError:
		parsed = {}

	summary = str(parsed.get("summary") or "").strip()
	suggested = str(parsed.get("suggested_reply") or "").strip()
	key_points = parsed.get("key_points")
	if not isinstance(key_points, list):
		key_points = []
	key_points = [str(p).strip() for p in key_points if str(p).strip()][:6]

	if not summary:
		stub = _stub_brief(messages, contact_name, ctx)
		summary = stub["summary"]
	if not suggested:
		suggested = (
			"سلام، ممنون از تماس شما. در حال بررسی درخواست هستم و به‌زودی پاسخ می‌دهم."
		)

	return {
		"summary": summary,
		"key_points": key_points,
		"suggested_reply": suggested,
		"model": settings.openai_chat_model,
		"input_tokens": usage.prompt_tokens if usage else 0,
		"output_tokens": usage.completion_tokens if usage else 0,
	}
