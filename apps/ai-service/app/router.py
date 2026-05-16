"""Route classified intents to RAG, tool-use stub, or escalation."""

from __future__ import annotations

from enum import Enum

from .intent import Intent, IntentResult, classify_intent
from .llm import generate_reply
from .retriever import retrieve_chunks


class Route(str, Enum):
    RAG = "rag"
    TOOL_USE = "tool_use"
    ESCALATION = "escalation"


def decide_route(intent: Intent, confidence: float) -> Route:
    if intent == Intent.COMPLAINT:
        return Route.ESCALATION
    if intent == Intent.TRANSACTIONAL:
        return Route.TOOL_USE
    if intent == Intent.OFF_TOPIC and confidence >= 0.75:
        return Route.ESCALATION
    if intent in (Intent.CHITCHAT, Intent.OFF_TOPIC):
        return Route.RAG  # handled with templates below, no retrieval
    return Route.RAG


def _chitchat_reply(question: str) -> str:
    q = question.strip().lower()
    if any(w in q for w in ("ممنون", "متشکر", "مرسی", "thanks")):
        return "خواهش می‌کنم! اگر سوال دیگری دارید در خدمتم."
    if any(w in q for w in ("خداحافظ", "bye", "شب بخیر")):
        return "خداحافظ! روز خوبی داشته باشید."
    return "سلام! چطور می‌توانم کمکتان کنم؟"


def _off_topic_reply() -> str:
    return (
        "متأسفم، فقط در زمینه پشتیبانی و خدمات مربوط به این سامانه می‌توانم کمک کنم. "
        "لطفاً سوال خود را در همین زمینه بپرسید."
    )


def _transactional_reply() -> str:
    return (
        "درخواست شما نیاز به پیگیری توسط تیم پشتیبانی دارد. "
        "هم‌اکنون شما را به اپراتور وصل می‌کنیم."
    )


def _complaint_reply() -> str:
    return (
        "از ناراحتی شما متأسفیم. مورد شما برای بررسی فوری به اپراتور ارجاع داده شد."
    )


async def route_and_answer(
    workspace_id: str,
    question: str,
    top_k: int | None = None,
) -> dict:
    intent_result: IntentResult = await classify_intent(question)
    route = decide_route(intent_result.intent, intent_result.confidence)

    base = {
        "intent": intent_result.intent.value,
        "route": route.value,
        "intent_confidence": intent_result.confidence,
        "retrieved_chunks": [],
        "input_tokens": 0,
        "output_tokens": 0,
    }

    if route == Route.ESCALATION or intent_result.intent == Intent.COMPLAINT:
        return {
            **base,
            "reply": _complaint_reply(),
            "confidence": max(0.3, 1.0 - intent_result.confidence),
            "handoff": True,
            "model": "router:escalation",
        }

    if intent_result.intent == Intent.TRANSACTIONAL:
        return {
            **base,
            "reply": _transactional_reply(),
            "confidence": 0.55,
            "handoff": True,
            "model": "router:tool_use",
            "route": Route.TOOL_USE.value,
        }

    if intent_result.intent == Intent.CHITCHAT:
        return {
            **base,
            "reply": _chitchat_reply(question),
            "confidence": 0.92,
            "handoff": False,
            "model": "router:chitchat",
        }

    if intent_result.intent == Intent.OFF_TOPIC:
        handoff = intent_result.confidence >= 0.75
        return {
            **base,
            "reply": _off_topic_reply(),
            "confidence": 0.7 if not handoff else 0.35,
            "handoff": handoff,
            "model": "router:off_topic",
        }

    # FAQ → RAG
    chunks = await retrieve_chunks(workspace_id, question, top_k)
    result = await generate_reply(
        question,
        chunks,
        workspace_id=workspace_id,
    )
    handoff = result["handoff"]
    if not chunks and intent_result.confidence < 0.6:
        handoff = True

    return {
        **base,
        "reply": result["reply"],
        "confidence": result["confidence"],
        "handoff": handoff,
        "model": result["model"],
        "retrieved_chunks": chunks,
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "route": Route.RAG.value,
    }
