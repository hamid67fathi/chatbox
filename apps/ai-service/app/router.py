"""Route classified intents to RAG, tool-use stub, or escalation."""

from __future__ import annotations

from enum import Enum

from .intent import Intent, IntentResult, classify_intent
from .langfuse_tracing import trace_operation
from .language import detect_language, normalize_lang
from .llm import generate_reply
from .prompts import (
	get_chitchat_reply,
	get_complaint_reply,
	get_off_topic_reply,
	get_transactional_reply,
)
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


async def route_and_answer(
    workspace_id: str,
    question: str,
    top_k: int | None = None,
    conversation_id: str | None = None,
    default_language: str | None = None,
    ai_persona: dict | None = None,
) -> dict:
    with trace_operation(
        "ask",
        workspace_id=workspace_id,
        conversation_id=conversation_id,
    ):
        return await _route_and_answer_impl(
            workspace_id,
            question,
            top_k,
            conversation_id,
            default_language,
            ai_persona,
        )


async def _route_and_answer_impl(
    workspace_id: str,
    question: str,
    top_k: int | None,
    conversation_id: str | None,
    default_language: str | None,
    ai_persona: dict | None,
) -> dict:
    default_lang = normalize_lang(default_language, "fa")
    lang, lang_confidence = detect_language(question, default_lang)

    intent_result: IntentResult = await classify_intent(question)
    route = decide_route(intent_result.intent, intent_result.confidence)

    base = {
        "intent": intent_result.intent.value,
        "route": route.value,
        "intent_confidence": intent_result.confidence,
        "language": lang,
        "language_confidence": lang_confidence,
        "retrieved_chunks": [],
        "input_tokens": 0,
        "output_tokens": 0,
    }

    if route == Route.ESCALATION or intent_result.intent == Intent.COMPLAINT:
        return {
            **base,
            "reply": get_complaint_reply(lang),
            "confidence": max(0.3, 1.0 - intent_result.confidence),
            "handoff": True,
            "model": "router:escalation",
        }

    if intent_result.intent == Intent.TRANSACTIONAL:
        return {
            **base,
            "reply": get_transactional_reply(lang),
            "confidence": 0.55,
            "handoff": True,
            "model": "router:tool_use",
            "route": Route.TOOL_USE.value,
        }

    if intent_result.intent == Intent.CHITCHAT:
        return {
            **base,
            "reply": get_chitchat_reply(lang, question),
            "confidence": 0.92,
            "handoff": False,
            "model": "router:chitchat",
        }

    if intent_result.intent == Intent.OFF_TOPIC:
        handoff = intent_result.confidence >= 0.75
        return {
            **base,
            "reply": get_off_topic_reply(lang),
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
        conversation_id=conversation_id,
        language=lang,
        persona=ai_persona,
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
