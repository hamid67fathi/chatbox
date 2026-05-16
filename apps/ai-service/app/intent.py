"""Intent classification — faq / transactional / complaint / chitchat / off_topic."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum

from .config import settings
from .pii import redact

_client = None


class Intent(str, Enum):
    FAQ = "faq"
    TRANSACTIONAL = "transactional"
    COMPLAINT = "complaint"
    CHITCHAT = "chitchat"
    OFF_TOPIC = "off_topic"


@dataclass(frozen=True)
class IntentResult:
    intent: Intent
    confidence: float


# Persian + common Latin keywords per intent
_PATTERNS: list[tuple[Intent, list[str], float]] = [
    (
        Intent.COMPLAINT,
        [
            "شکایت",
            "ناراضی",
            "ناراحت",
            "عصبانی",
            "بد بود",
            "افتضاح",
            "رسیدگی",
            "غیرقابل قبول",
            "مشکل جدی",
            "تخلف",
            "complaint",
            "angry",
        ],
        0.88,
    ),
    (
        Intent.TRANSACTIONAL,
        [
            "سفارش",
            "خرید",
            "پرداخت",
            "فاکتور",
            "لغو",
            "استرداد",
            "بازپرداخت",
            "refund",
            "اشتراک",
            "تمدید",
            "حساب کاربری",
            "رمز",
            "order",
            "payment",
            "invoice",
            "cancel",
        ],
        0.85,
    ),
    (
        Intent.CHITCHAT,
        [
            "سلام",
            "درود",
            "خسته نباش",
            "چطوری",
            "حالت",
            "ممنون",
            "متشکر",
            "مرسی",
            "خداحافظ",
            "شب بخیر",
            "صبح بخیر",
            "hello",
            "hi ",
            "thanks",
            "bye",
        ],
        0.82,
    ),
    (
        Intent.FAQ,
        [
            "چطور",
            "چگونه",
            "راهنما",
            "آموزش",
            "قیمت",
            "هزینه",
            "ساعت",
            "کجا",
            "چرا",
            "آیا",
            "چند",
            "تعریف",
            "how ",
            "what ",
            "where ",
            "when ",
            "price",
        ],
        0.8,
    ),
]

_OFF_TOPIC_HINTS = [
    "فوتبال",
    "آشپزی",
    "آهنگ",
    "فیلم",
    "سیاست",
    "جوک",
    "شعر",
    "weather",
    "recipe",
]


def _normalize(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def classify_intent_heuristic(question: str) -> IntentResult:
    q = _normalize(question)
    if not q:
        return IntentResult(Intent.CHITCHAT, 0.5)

    best_intent = Intent.FAQ
    best_score = 0.45

    for intent, keywords, base_conf in _PATTERNS:
        hits = sum(1 for kw in keywords if kw in q)
        if hits == 0:
            continue
        score = min(0.98, base_conf + 0.04 * (hits - 1))
        if score > best_score:
            best_score = score
            best_intent = intent

    if "?" in q or "؟" in q:
        if best_intent == Intent.CHITCHAT and len(q) > 40:
            best_intent = Intent.FAQ
            best_score = max(best_score, 0.72)
        elif best_score < 0.55:
            best_intent = Intent.FAQ
            best_score = 0.65

    if best_score < 0.6 and any(h in q for h in _OFF_TOPIC_HINTS):
        return IntentResult(Intent.OFF_TOPIC, 0.78)

    if best_score < 0.55 and len(q.split()) <= 3 and "?" not in q:
        if any(k in q for k in ("سلام", "hello", "hi", "ممنون", "thanks")):
            return IntentResult(Intent.CHITCHAT, 0.8)
        return IntentResult(Intent.OFF_TOPIC, 0.65)

    return IntentResult(best_intent, best_score)


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


async def classify_intent_llm(question: str) -> IntentResult:
    safe = redact(question)
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify the user message into exactly one intent: "
                    "faq, transactional, complaint, chitchat, off_topic. "
                    "Reply with JSON only: "
                    '{"intent":"...","confidence":0.0-1.0}'
                ),
            },
            {"role": "user", "content": safe},
        ],
        temperature=0,
        max_tokens=60,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
        intent_str = str(data.get("intent", "faq")).lower()
        conf = float(data.get("confidence", 0.75))
        intent = Intent(intent_str) if intent_str in {i.value for i in Intent} else Intent.FAQ
        return IntentResult(intent, max(0.0, min(1.0, conf)))
    except (json.JSONDecodeError, ValueError, KeyError):
        return classify_intent_heuristic(question)


async def classify_intent(question: str) -> IntentResult:
    if settings.use_openai:
        try:
            return await classify_intent_llm(question)
        except Exception:
            return classify_intent_heuristic(question)
    return classify_intent_heuristic(question)
