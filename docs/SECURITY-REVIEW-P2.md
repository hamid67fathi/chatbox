# Security Review — Phase 2

**Date:** 2026-05-13  
**Reviewer:** AGT-SEC-01 (automated)  
**Scope:** P2.1–P2.4 changes

---

## 1. PII Flow

| Check | Status | Notes |
|---|---|---|
| PII redacted before external LLM calls | PASS | `apps/ai-service/app/pii.py` strips phone, email, national ID, card numbers |
| PII patterns cover Iranian formats | PASS | 09xx, 10-digit national ID, 16-digit card |
| No PII logged in ai_interactions.prompt | WARN | Prompt field stores redacted version, but original question stored in messages table (expected) |

## 2. Rate Limits on Public Routes

| Route | Limit | Status |
|---|---|---|
| `POST /widget/v1/sessions` | 20 req/min per IP | PASS |
| Socket.IO handshake | Not rate-limited | P2 — add in Phase 3 |
| Internal API routes (`/v1/*`) | No limit (behind auth in prod) | OK for MVP |

## 3. Tenant Isolation on AI Path

| Check | Status | Notes |
|---|---|---|
| AI service receives workspace_id | PASS | Passed from API, scopes vector search |
| kb_chunks RLS policy | PASS | `workspace_id = current_setting('app.current_workspace')` |
| ai_interactions RLS policy | PASS | Same tenant isolation |
| Cross-tenant vector search impossible | PASS | WHERE clause + RLS |

## 4. HTTP Security Headers

| Check | Status | Notes |
|---|---|---|
| `@fastify/helmet` registered | PASS | Added in P2.5 |
| CSP disabled for widget embedding | OK | Widget needs to load from external domains |

## 5. Input Validation

| Check | Status | Notes |
|---|---|---|
| Widget session: workspace_slug validated | PASS | Returns 400 if missing |
| Message body required | PASS | Returns 400 if empty |
| AI service: request body validated via Pydantic | PASS | FastAPI auto-validates |

## 6. Circuit Breaker

| Check | Status | Notes |
|---|---|---|
| AI client timeout | PASS | 10s default, configurable |
| Circuit breaker on failures | PASS | 3 consecutive failures = 30s cooldown |
| Failure doesn't crash API | PASS | Returns null, message still saved |

---

## Verdict: **PASS**

No P1 (must-fix) issues. Minor P2 items noted for Phase 3:
- Rate limit Socket.IO connections
- Add request body size limit to AI ingest endpoint
