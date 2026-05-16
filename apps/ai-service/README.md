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

یا:

```bash
./apps/ai-service/dev.sh
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

## Modes

- **With OpenAI**: Set `OPENAI_API_KEY` in `.env` for real embeddings and LLM responses
- **Stub mode**: Leave `OPENAI_API_KEY` empty — uses deterministic pseudo-random embeddings and stub responses (for dev/testing)
