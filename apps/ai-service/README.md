# AI Service

FastAPI service for Chat-Box AI pipeline: ingest, embed, retrieve (RAG), and generate responses.

## Setup

```bash
cd apps/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

**حتماً از پوشه `apps/ai-service` اجرا کنید** (نه از ریشه monorepo):

```bash
cd apps/ai-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

یا (از پوشه `apps/ai-service`):

```bash
./dev.sh
# اگر Permission denied: bash dev.sh
```

## Endpoints

### Health
```bash
curl http://localhost:8000/health
```

### Ingest text (chunk + embed + store)
```bash
curl -X POST http://localhost:8000/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "<WORKSPACE_UUID>",
    "kb_id": "<KB_UUID>",
    "document_id": "<DOC_UUID>",
    "text": "متن مستند شما اینجا..."
  }'
```

### Ask (intent classify → route → RAG / escalation)
```bash
curl -X POST http://localhost:8000/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "<WORKSPACE_UUID>",
    "question": "سوال کاربر"
  }'
```

Response includes `intent` (faq|transactional|complaint|chitchat|off_topic), `route` (rag|tool_use|escalation), and `handoff`.

### Copilot (۳ پیشنهاد پاسخ برای اپراتور)
```bash
curl -X POST http://localhost:8000/v1/copilot \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "<WORKSPACE_UUID>",
    "messages": [{"role": "contact", "content": "سلام، سفارشم کجاست؟"}]
  }'
```

Stream (SSE): `POST /v1/copilot/stream` با همان body.

### Sentiment & Summary
```bash
curl -X POST http://localhost:8000/v1/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "از خدمات راضی نیستم"}'

curl -X POST http://localhost:8000/v1/summarize \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"<UUID>","messages":[{"role":"contact","content":"سلام"}]}'
```

### Classify only (debug)
```bash
curl -X POST http://localhost:8000/v1/classify \
  -H "Content-Type: application/json" \
  -d '{"question": "سلام"}'
```

### Embed texts
```bash
curl -X POST http://localhost:8000/v1/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["متن اول", "متن دوم"]}'
```

## RAG pipeline (P7.4)

1. **Persian normalization** — Arabic ی/ک, digits, ZWNJ on ingest and queries
2. **Retrieve** — `AI_RETRIEVE_K` vector candidates (default 20)
3. **Rerank** — Cohere `rerank-multilingual-v3.0` when `COHERE_API_KEY` is set; else vector order
4. **Generate** — OpenAI → Anthropic (`ANTHROPIC_API_KEY`) → template stub
5. **Cache** — in-memory TTL: embedding (1h), retrieval (10m), answer (5m), intent (10m)

`GET /health` reports provider flags and cache sizes.

## Cost & observability (P7.5)

- API tracks monthly AI credits per workspace (plan limit + `ai_credits` bonus column).
- Enforcement at 80% (dashboard banner + WebSocket `workspace:ai_budget`) and 100% (block auto-reply / copilot / summarize).
- Optional **Langfuse**: set `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` for traces on `/v1/ask` and LLM generations.

API env (optional overrides):

```
AI_CREDITS_FREE=500
AI_CREDITS_STARTER=5000
AI_CREDITS_PRO=25000
AI_BUDGET_WARN_PCT=80
```

Dashboard: `GET /v1/workspaces/:id/ai-usage`

## Modes

- **With OpenAI**: Set `OPENAI_API_KEY` in `.env` for real embeddings and LLM responses
- **Optional Cohere**: `COHERE_API_KEY` for reranking
- **Optional Anthropic**: `ANTHROPIC_API_KEY` as LLM fallback
- **Stub mode**: Leave `OPENAI_API_KEY` empty — uses deterministic pseudo-random embeddings and stub responses (for dev/testing)
