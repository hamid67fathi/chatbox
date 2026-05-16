"""Message sentiment scoring in [-1, 1]."""

from __future__ import annotations

import json
import re

from .config import settings
from .pii import redact

_client = None

_POSITIVE = [
	"ممنون",
	"متشکر",
	"عالی",
	"خوب",
	"راضی",
	"عالیه",
	"دوست دارم",
	"خوشحال",
	"thanks",
	"great",
	"good",
	"love",
]
_NEGATIVE = [
	"بد",
	"افتضاح",
	"ناراضی",
	"شکایت",
	"عصبانی",
	"مشکل",
	"خراب",
	"کلافه",
	"پشیمون",
	"terrible",
	"bad",
	"angry",
	"hate",
	"awful",
]


def _clamp(score: float) -> float:
	return max(-1.0, min(1.0, round(score, 3)))


def sentiment_heuristic(text: str) -> float:
	q = text.strip().lower()
	if not q:
		return 0.0
	pos = sum(1 for w in _POSITIVE if w in q)
	neg = sum(1 for w in _NEGATIVE if w in q)
	if pos == 0 and neg == 0:
		if "!" in q and "؟" not in q and "?" not in q:
			return -0.15
		return 0.0
	score = (pos - neg) / max(pos + neg, 1)
	if neg >= 2:
		score -= 0.2
	if pos >= 2:
		score += 0.15
	return _clamp(score)


def _get_client():
	global _client
	if _client is None:
		from openai import OpenAI

		_client = OpenAI(api_key=settings.openai_api_key)
	return _client


async def sentiment_llm(text: str) -> float:
	safe = redact(text)
	client = _get_client()
	response = client.chat.completions.create(
		model=settings.openai_chat_model,
		messages=[
			{
				"role": "system",
				"content": (
					"Score customer message sentiment from -1 (very negative) to +1 (very positive). "
					'Reply JSON only: {"score": number}'
				),
			},
			{"role": "user", "content": safe},
		],
		temperature=0,
		max_tokens=30,
		response_format={"type": "json_object"},
	)
	raw = (response.choices[0].message.content or "{}").strip()
	try:
		data = json.loads(raw)
		return _clamp(float(data.get("score", 0)))
	except (json.JSONDecodeError, TypeError, ValueError):
		return sentiment_heuristic(text)


async def analyze_sentiment(text: str) -> float:
	clean = re.sub(r"\s+", " ", text.strip())
	if not clean:
		return 0.0
	if settings.use_openai:
		try:
			return await sentiment_llm(clean)
		except Exception:
			return sentiment_heuristic(clean)
	return sentiment_heuristic(clean)
