import json
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .chunker import chunk_text
from .config import settings
from .copilot import generate_copilot_suggestions, stream_copilot_suggestions
from .db import close_pool, get_pool
from .embeddings import embed_texts
from .router import route_and_answer


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="Chat-Box AI Service", version="0.1.0", lifespan=lifespan)


# ── Health ────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"ok": True, "openai": settings.use_openai}


# ── Ingest (chunk + embed + store) ───────────────────


class IngestRequest(BaseModel):
    workspace_id: str
    kb_id: str
    document_id: str
    text: str
    title: str | None = None


class IngestResponse(BaseModel):
    document_id: str
    chunk_count: int


@app.post("/v1/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest):
    chunks = chunk_text(req.text)
    if not chunks:
        raise HTTPException(400, "No text to chunk")

    embeddings = await embed_texts(chunks)

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i, (content, emb) in enumerate(zip(chunks, embeddings)):
                vec_str = "[" + ",".join(str(v) for v in emb) + "]"
                await conn.execute(
                    """
                    INSERT INTO kb_chunks (id, workspace_id, document_id, chunk_index, content, content_tokens, embedding)
                    VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7::vector)
                    """,
                    str(uuid.uuid4()),
                    req.workspace_id,
                    req.document_id,
                    i,
                    content,
                    len(content.split()),
                    vec_str,
                )

            await conn.execute(
                """
                UPDATE kb_documents
                SET chunk_count = $1, status = 'indexed', last_indexed_at = now()
                WHERE id = $2::uuid
                """,
                len(chunks),
                req.document_id,
            )

    return IngestResponse(document_id=req.document_id, chunk_count=len(chunks))


# ── Ask (retrieve + generate) ────────────────────────


class AskRequest(BaseModel):
    workspace_id: str
    question: str
    conversation_id: str | None = None
    top_k: int | None = None


class AskResponse(BaseModel):
    reply: str
    confidence: float
    handoff: bool
    model: str
    intent: str
    route: str
    intent_confidence: float
    retrieved_chunks: list[dict]
    input_tokens: int
    output_tokens: int


@app.post("/v1/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    result = await route_and_answer(
        req.workspace_id,
        req.question,
        req.top_k,
    )

    return AskResponse(
        reply=result["reply"],
        confidence=result["confidence"],
        handoff=result["handoff"],
        model=result["model"],
        intent=result["intent"],
        route=result["route"],
        intent_confidence=result["intent_confidence"],
        retrieved_chunks=result["retrieved_chunks"],
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
    )


class ClassifyRequest(BaseModel):
    question: str


class ClassifyResponse(BaseModel):
    intent: str
    confidence: float
    route: str


@app.post("/v1/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    from .intent import classify_intent
    from .router import decide_route

    intent_result = await classify_intent(req.question)
    route = decide_route(intent_result.intent, intent_result.confidence)
    return ClassifyResponse(
        intent=intent_result.intent.value,
        confidence=intent_result.confidence,
        route=route.value,
    )


# ── Copilot (agent reply suggestions) ───────────────


class CopilotMessage(BaseModel):
    role: str
    content: str


class CopilotRequest(BaseModel):
    workspace_id: str
    messages: list[CopilotMessage]
    contact_name: str | None = None
    conversation_id: str | None = None


class CopilotSuggestion(BaseModel):
    style: str
    label: str
    text: str


class CopilotResponse(BaseModel):
    suggestions: list[CopilotSuggestion]
    model: str
    input_tokens: int
    output_tokens: int


@app.post("/v1/copilot", response_model=CopilotResponse)
async def copilot(req: CopilotRequest):
    if not req.messages:
        raise HTTPException(400, "messages is required")
    payload = [m.model_dump() for m in req.messages]
    result = await generate_copilot_suggestions(
        req.workspace_id,
        payload,
        req.contact_name,
    )
    return CopilotResponse(
        suggestions=result["suggestions"],
        model=result["model"],
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
    )


@app.post("/v1/copilot/stream")
async def copilot_stream(req: CopilotRequest):
    if not req.messages:
        raise HTTPException(400, "messages is required")
    payload = [m.model_dump() for m in req.messages]

    async def event_generator():
        async for event in stream_copilot_suggestions(
            req.workspace_id,
            payload,
            req.contact_name,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Embed (standalone) ──────────────────────────────


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dimensions: int


@app.post("/v1/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not req.texts:
        raise HTTPException(400, "No texts provided")
    results = await embed_texts(req.texts)
    return EmbedResponse(embeddings=results, dimensions=len(results[0]))
