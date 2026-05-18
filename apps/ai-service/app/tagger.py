"""Suggest conversation topic tags for agent triage."""

from __future__ import annotations

import json
import re

from .config import settings
from .pii import redact

_client = None

TAG_SYSTEM = """You label customer support conversations with short English tags.
Return JSON only: {"tags": ["billing", "technical-issue"]}
Rules:
- 1 to 5 tags maximum
- lowercase, use hyphens for multi-word tags (e.g. refund-request)
- no spaces inside a tag
- focus on topic/intent, not sentiment alone
Common tags: billing, technical, shipping, account, refund, complaint, praise, sales, onboarding"""


def _format_messages(messages: list[dict[str, str]], contact_name: str | None) -> str:
	lines: list[str] = []
	for m in messages[-50:]:
		role = m.get("role", "contact")
		content = (m.get("content") or "").strip()
		if not content:
			continue
		if role in ("contact", "user", "visitor"):
			who = contact_name or "customer"
			lines.append(f"{who}: {content}")
		elif role == "agent":
			lines.append(f"agent: {content}")
		elif role == "ai":
			lines.append(f"ai: {content}")
	return "\n".join(lines) if lines else ""


def _normalize_tag(raw: str) -> str | None:
	t = raw.strip().lower()
	t = re.sub(r"[^a-z0-9_-]+", "-", t)
	t = re.sub(r"-+", "-", t).strip("-")
	if not t or len(t) > 48:
		return None
	return t


def _stub_tags(messages: list[dict[str, str]]) -> list[str]:
	text = " ".join((m.get("content") or "") for m in messages).lower()
	candidates: list[str] = []
	rules = [
		(r"refund|return|money|payment|bill|invoice|قیمت|پرداخت|بازگشت", "billing"),
		(r"ship|delivery|ارسال|تحویل", "shipping"),
		(r"login|password|account|حساب|رمز", "account"),
		(r"bug|error|crash|خطا|کار نمی", "technical"),
		(r"thank|great|عالی|ممنون", "praise"),
		(r"angry|complain|شکایت|ناراض", "complaint"),
	]
	for pattern, tag in rules:
		if re.search(pattern, text, re.I):
			candidates.append(tag)
	if not candidates:
		candidates.append("general")
	seen: set[str] = set()
	out: list[str] = []
	for t in candidates:
		if t not in seen:
			seen.add(t)
			out.append(t)
	return out[:5]


def _get_client():
	global _client
	if _client is None:
		from openai import OpenAI

		_client = OpenAI(api_key=settings.openai_api_key)
	return _client


async def suggest_conversation_tags(
	messages: list[dict[str, str]],
	contact_name: str | None = None,
	existing_tags: list[str] | None = None,
) -> dict:
	transcript = _format_messages(messages, contact_name)
	safe = redact(transcript)
	existing = [t.strip().lower() for t in (existing_tags or []) if t.strip()]

	if not safe.strip():
		tags = _stub_tags(messages)
		return {
			"tags": [t for t in tags if t not in existing][:5],
			"model": "stub",
			"input_tokens": 0,
			"output_tokens": 0,
		}

	if not settings.use_openai:
		tags = _stub_tags(messages)
		return {
			"tags": [t for t in tags if t not in existing][:5],
			"model": "stub",
			"input_tokens": 0,
			"output_tokens": 0,
		}

	existing_hint = ""
	if existing:
		existing_hint = f"\nAlready tagged (do not repeat): {', '.join(existing)}"

	client = _get_client()
	response = client.chat.completions.create(
		model=settings.openai_chat_model,
		messages=[
			{"role": "system", "content": TAG_SYSTEM},
			{
				"role": "user",
				"content": f"Conversation:\n{safe}{existing_hint}",
			},
		],
		temperature=0.2,
		max_tokens=120,
		response_format={"type": "json_object"},
	)
	raw = response.choices[0].message.content or "{}"
	try:
		parsed = json.loads(raw)
		raw_tags = parsed.get("tags") if isinstance(parsed, dict) else []
	except json.JSONDecodeError:
		raw_tags = []

	tags: list[str] = []
	seen: set[str] = set(existing)
	if isinstance(raw_tags, list):
		for item in raw_tags:
			if not isinstance(item, str):
				continue
			norm = _normalize_tag(item)
			if norm and norm not in seen:
				seen.add(norm)
				tags.append(norm)
	if not tags:
		tags = [t for t in _stub_tags(messages) if t not in seen][:5]

	return {
		"tags": tags[:5],
		"model": settings.openai_chat_model,
		"input_tokens": response.usage.prompt_tokens if response.usage else 0,
		"output_tokens": response.usage.completion_tokens if response.usage else 0,
	}
