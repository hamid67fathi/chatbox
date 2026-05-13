# 🔌 سند API Specification

> Chat-Box — REST + WebSocket + Webhook API
> ورژن 1.0 · مه 2026

---

## 1. اصول کلی API

| اصل | توضیح |
|---|---|
| **REST برای CRUD، WebSocket برای real-time** | جدا نگه داشتن load |
| **OpenAPI 3.1 خودکار از Zod schemas** | تولید SDK یک کلیک |
| **JSON-only** (به‌جز file upload) | سادگی + مشتری چندزبانه |
| **Versioning در URL:** `/v1/...` | breaking change → نسخه جدید |
| **Cursor-based pagination** برای collection | scale برای میلیون‌ها row |
| **HTTP status استاندارد** | بدون wrapping `{success: true}` |
| **Snake_case در body، kebab-case در URL** | همانند Stripe/Slack |
| **HTTPS only، TLS 1.3** | redirect خودکار |
| **Rate limiting سراسری** | per-token و per-IP |
| **Idempotency-Key** برای POST مالی | جلوگیری از double-charge |

### Base URLs

| Env | URL |
|---|---|
| Production | `https://api.chat-box.ir/v1` |
| Staging | `https://api.stg.chat-box.ir/v1` |
| WebSocket Production | `wss://ws.chat-box.ir` |

---

## 2. احراز هویت

### 2.1 انواع توکن

| نوع | کاربرد | عمر | شکل |
|---|---|---|---|
| **Access Token** (JWT) | درخواست‌های Dashboard/Mobile | ۱۵ دقیقه | `eyJ...` |
| **Refresh Token** | تمدید Access | ۷ روز با rotation | opaque |
| **API Key** | server-to-server | بدون expiry تا revoke | `cb_live_...` |
| **Widget Token** | احراز visitor | ۲۴ ساعت | JWT امضا شده |

### 2.2 هدرها

```http
Authorization: Bearer <access_token>
X-Workspace-Id: <workspace_uuid>      # اجباری برای endpointهای tenant-scoped
X-Request-Id: <uuid>                   # برای tracing
Idempotency-Key: <uuid>                # برای POST مهم
```

### 2.3 جریان لاگین

```
POST /v1/auth/login        → access + refresh
POST /v1/auth/refresh      → access جدید
POST /v1/auth/logout       → invalidate session
POST /v1/auth/otp/request  → ارسال OTP
POST /v1/auth/otp/verify   → access + refresh
```

---

## 3. خطاها (Error Format)

تمام خطاها در یک شکل واحد:

```json
{
  "error": {
    "code": "validation_error",
    "message": "نام workspace نمی‌تواند خالی باشد.",
    "details": {
      "field": "name"
    },
    "request_id": "req_01HX9..."
  }
}
```

### Status codes استاندارد

| Code | معنی | مثال |
|---|---|---|
| 400 | `validation_error` | فرمت نامعتبر |
| 401 | `unauthenticated` | توکن منقضی/نامعتبر |
| 403 | `forbidden` | دسترسی ندارد |
| 404 | `not_found` | resource موجود نیست |
| 409 | `conflict` | duplicate یا state غلط |
| 422 | `unprocessable` | منطق business |
| 429 | `rate_limited` | بیش از حد مجاز |
| 500 | `internal_error` | خطای سرور |
| 503 | `service_unavailable` | maintenance |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1747000000
Retry-After: 30                       # وقتی 429
```

---

## 4. Pagination

### Cursor-based (پیش‌فرض)

```http
GET /v1/conversations?limit=50&cursor=eyJpZCI6...
```

Response:
```json
{
  "data": [ /* ... */ ],
  "page": {
    "limit": 50,
    "next_cursor": "eyJpZCI6...",
    "has_more": true
  }
}
```

### Offset-based (فقط جاهای آماری)

```http
GET /v1/analytics/conversations?page=2&per_page=20
```

---

## 5. Workspaces

### 5.1 ساخت workspace
```http
POST /v1/workspaces
Content-Type: application/json

{
  "name": "فروشگاه نازنین",
  "slug": "nazaninshop",
  "locale": "fa-IR",
  "timezone": "Asia/Tehran"
}
```

**Response 201:**
```json
{
  "id": "ws_01HX...",
  "slug": "nazaninshop",
  "name": "فروشگاه نازنین",
  "plan": "free",
  "trial_ends_at": null,
  "created_at": "2026-05-11T08:00:00Z"
}
```

### 5.2 لیست workspaces کاربر
```http
GET /v1/workspaces
```

### 5.3 جزئیات
```http
GET /v1/workspaces/:id
```

### 5.4 بروزرسانی
```http
PATCH /v1/workspaces/:id
```

### 5.5 دعوت عضو
```http
POST /v1/workspaces/:id/members
{
  "email": "ali@example.ir",
  "role": "agent"
}
```

### 5.6 لیست اعضا
```http
GET /v1/workspaces/:id/members
```

---

## 6. Conversations

### 6.1 لیست (Inbox)
```http
GET /v1/conversations?status=open&assigned_to=me&channel=widget&limit=50
```

**Query params:**
- `status` — open, pending, resolved, closed, spam
- `assigned_to` — me | unassigned | <user_id>
- `channel` — widget | telegram | email | api
- `tag` — repeat برای چند تگ
- `priority` — 0..3
- `q` — جستجوی FTS
- `cursor`, `limit`

### 6.2 جزئیات (شامل پیام‌ها)
```http
GET /v1/conversations/:id
```

### 6.3 پیام‌های مکالمه (paginated)
```http
GET /v1/conversations/:id/messages?cursor=...&limit=50
```

### 6.4 شروع مکالمه (server-side)
```http
POST /v1/conversations
{
  "contact_id": "ct_01HX...",
  "channel": "api",
  "first_message": {
    "type": "text",
    "body": "سلام، در مورد سفارش..."
  }
}
```

### 6.5 ارسال پیام
```http
POST /v1/conversations/:id/messages
{
  "type": "text",
  "body": "بله، می‌توانم کمک کنم.",
  "reply_to_id": "msg_..."
}
```

### 6.6 Assign اپراتور
```http
POST /v1/conversations/:id/assign
{ "agent_id": "usr_..." }     # یا "auto": true
```

### 6.7 تغییر وضعیت
```http
POST /v1/conversations/:id/status
{ "status": "resolved" }
```

### 6.8 افزودن tag/note
```http
POST /v1/conversations/:id/tags          { "tags": ["vip", "refund"] }
POST /v1/conversations/:id/notes         { "body": "مشتری ناراضی است." }
```

### 6.9 درخواست AI پاسخ (دستی)
```http
POST /v1/conversations/:id/ai/suggest
```

**Response:**
```json
{
  "suggestions": [
    { "text": "...", "confidence": 0.82, "model": "gpt-4o-mini" },
    { "text": "...", "confidence": 0.75 }
  ]
}
```

### 6.10 خلاصه‌سازی
```http
POST /v1/conversations/:id/ai/summarize
```

---

## 7. Contacts

```http
GET    /v1/contacts?q=ali&tag=vip&limit=50
GET    /v1/contacts/:id
POST   /v1/contacts
PATCH  /v1/contacts/:id
DELETE /v1/contacts/:id                  # soft delete
GET    /v1/contacts/:id/conversations
```

### Upsert با external_id
```http
PUT /v1/contacts/by-external-id/:external_id
{
  "full_name": "علی رضایی",
  "email": "ali@example.ir",
  "metadata": { "plan": "gold" }
}
```

---

## 8. Knowledge Base

### 8.1 ساخت KB
```http
POST /v1/knowledge-bases
{ "name": "FAQ محصول", "embedding_model": "text-embedding-3-small" }
```

### 8.2 افزودن سند از URL
```http
POST /v1/knowledge-bases/:kb_id/documents
{
  "source_type": "url",
  "source_url": "https://nazaninshop.ir/faq",
  "crawl_depth": 2,
  "max_pages": 50
}
```

**Response 202:**
```json
{
  "id": "doc_01HX...",
  "status": "processing",
  "job_id": "job_..."
}
```

### 8.3 آپلود فایل
```http
POST /v1/knowledge-bases/:kb_id/documents
Content-Type: multipart/form-data

file=@FAQ.pdf
metadata={"category":"refund"}
```

### 8.4 وضعیت ingest
```http
GET /v1/knowledge-bases/:kb_id/documents/:doc_id
```

### 8.5 جستجوی KB (manual)
```http
POST /v1/knowledge-bases/:kb_id/search
{ "query": "چطور سفارشم رو لغو کنم؟", "top_k": 5 }
```

---

## 9. Canned Responses

```http
GET    /v1/canned-responses
POST   /v1/canned-responses               { shortcut, title, body, variables }
PATCH  /v1/canned-responses/:id
DELETE /v1/canned-responses/:id
```

---

## 10. Integrations — Telegram

### 10.1 اتصال بات
```http
POST /v1/integrations/telegram
{ "bot_token": "1234:ABC..." }
```

**Response:** اطلاعات بات + webhook URL تنظیم شده.

### 10.2 لیست integrations
```http
GET /v1/integrations
```

### 10.3 حذف
```http
DELETE /v1/integrations/:id
```

---

## 11. Webhooks (outbound)

```http
GET    /v1/webhooks
POST   /v1/webhooks                       { url, events[], secret? }
PATCH  /v1/webhooks/:id
DELETE /v1/webhooks/:id
POST   /v1/webhooks/:id/test              # test delivery
```

### Event types

```
conversation.created
conversation.assigned
conversation.status_changed
conversation.closed
message.created
message.ai_replied
contact.created
contact.updated
ai.escalated
```

### Payload نمونه

```json
{
  "id": "evt_01HX...",
  "type": "message.created",
  "workspace_id": "ws_01HX...",
  "created_at": "2026-05-11T08:00:00Z",
  "data": {
    "message": { /* ... */ },
    "conversation": { /* ... */ }
  }
}
```

### Signing

هدر `X-Chatbox-Signature: t=<unix>,v1=<hmac_sha256>` — verify با secret.

---

## 12. Analytics

```http
GET /v1/analytics/overview?from=2026-05-01&to=2026-05-11
```

**Response:**
```json
{
  "conversations": { "total": 1240, "new": 320, "resolved": 280 },
  "messages": { "total": 14820, "by_sender": { "agent": 5600, "ai": 7400, "contact": 1820 } },
  "ai": { "resolution_rate": 0.62, "cost_usd": 12.40, "tokens": 1450000 },
  "response_time": { "first_p50_sec": 18, "first_p95_sec": 120 },
  "csat": { "avg": 4.2, "responses": 87 }
}
```

```http
GET /v1/analytics/conversations?group_by=day
GET /v1/analytics/agents
GET /v1/analytics/ai
```

---

## 13. Billing

```http
GET  /v1/billing/subscription
POST /v1/billing/subscription/upgrade     { "plan": "pro" }
GET  /v1/billing/invoices
GET  /v1/billing/invoices/:id/pdf         # redirect 302
POST /v1/billing/payment-init             { invoice_id }
POST /v1/billing/payment-callback         # internal (Zarinpal webhook)
GET  /v1/billing/usage                    # AI tokens, storage, ...
```

---

## 14. WebSocket API

### 14.1 اتصال

```
wss://ws.chat-box.ir/v1
?token=<access_token>
&workspace_id=<ws_id>
```

پروتکل: **Socket.IO 4** (با fallback HTTP long-polling).

### 14.2 Rooms

- `workspace:<ws_id>` — اپراتورها برای دریافت inbox-wide events
- `conversation:<conv_id>` — همه‌ی دیدگاه‌بان‌ها (visitor + agent + observer)
- `user:<user_id>` — DM به یک اپراتور خاص

### 14.3 Events — Client → Server

| Event | Payload | منظور |
|---|---|---|
| `message:send` | `{ conv_id, type, body, attachments? }` | ارسال پیام |
| `message:read` | `{ conv_id, message_id }` | علامت خوانده شد |
| `typing:start` | `{ conv_id }` | شروع تایپ |
| `typing:stop` | `{ conv_id }` | توقف تایپ |
| `presence:online` | `{}` | اپراتور آنلاین شد |
| `presence:away` | `{}` | اپراتور رفت |
| `conv:join` | `{ conv_id }` | join room |
| `conv:leave` | `{ conv_id }` | leave room |

### 14.4 Events — Server → Client

| Event | Payload | منظور |
|---|---|---|
| `message:new` | `{ message, conversation }` | پیام جدید |
| `message:updated` | `{ message }` | edit/delete |
| `message:read` | `{ conv_id, message_id, by }` | read receipt |
| `typing` | `{ conv_id, sender, isTyping }` | typing indicator |
| `conv:assigned` | `{ conv_id, agent_id }` | تخصیص |
| `conv:status_changed` | `{ conv_id, status }` | تغییر وضعیت |
| `conv:new` | `{ conversation }` | inbox: مکالمه جدید |
| `ai:suggestion` | `{ conv_id, suggestion }` | Copilot |
| `error` | `{ code, message }` | خطا |

### 14.5 ACK pattern

```js
socket.emit('message:send', { conv_id, body }, (ack) => {
  // ack = { ok: true, message_id: '...' } یا { ok: false, error: {...} }
});
```

### 14.6 Reconnect

- exponential backoff (1s, 2s, 4s, ...)
- Last-Event-Id برای catch-up پیام‌های از دست رفته از REST: `GET /v1/conversations/:id/messages?since=<msg_id>`

---

## 15. Widget API (Public, Visitor-facing)

### 15.1 Init
```http
GET https://widget.chat-box.ir/v1/init?workspace_slug=nazaninshop
```

Response شامل: settings (color, position, greeting, prechat fields).

### 15.2 ساخت/Resume session بازدیدکننده
```http
POST /widget/v1/sessions
{
  "workspace_slug": "nazaninshop",
  "visitor_id": "<localStorage uuid یا null>",
  "page_url": "https://nazaninshop.ir/cart",
  "metadata": { "utm_source": "instagram" }
}
```

**Response:**
```json
{
  "visitor_token": "<JWT>",
  "conversation_id": "...",
  "ws_endpoint": "wss://ws.chat-box.ir"
}
```

### 15.3 ارسال پیام (HTTP fallback)
```http
POST /widget/v1/conversations/:id/messages
Authorization: Bearer <visitor_token>
```

### 15.4 Upload فایل
```http
POST /widget/v1/uploads
Content-Type: multipart/form-data
```

---

## 16. Admin API (Internal)

> دسترسی فقط با role `super_admin`، endpoint زیر `/admin/v1/...`.

```http
GET    /admin/v1/workspaces
POST   /admin/v1/workspaces/:id/suspend
POST   /admin/v1/workspaces/:id/refund
GET    /admin/v1/metrics                 # platform-wide
POST   /admin/v1/feature-flags
```

---

## 17. Rate Limits پیش‌فرض

| دسته | محدودیت |
|---|---|
| Anonymous (Widget init) | ۶۰ req/min/IP |
| Authenticated (per token) | ۶۰۰ req/min |
| `POST /messages` (per workspace) | ۵۰۰۰ msg/min |
| WebSocket new connections | ۲۰۰/min/IP |
| AI suggest endpoint | ۶۰ req/min/workspace |
| File upload | ۳۰ req/min/workspace |

---

## 18. SDKها (آینده)

| زبان | پکیج | اولویت |
|---|---|---|
| TypeScript/Node | `@chatbox/sdk` | فاز ۱ |
| Python | `chatbox-sdk` | فاز ۲ |
| PHP (WooCommerce) | `chatbox-php` | فاز ۲ |
| WordPress Plugin | `chatbox-wp` | فاز ۲ |

تولید خودکار از OpenAPI با `openapi-generator`.

---

## 19. OpenAPI

- `https://api.chat-box.ir/v1/openapi.json` — اسپک کامل
- `https://api.chat-box.ir/v1/docs` — Scalar/Redoc UI

---

## 20. Versioning Policy

- نسخه فقط در URL تغییر می‌کند (`/v1`, `/v2`)
- breaking change → نسخه جدید، حداقل ۱۸۰ روز overlap
- additive change (فیلد جدید nullable) → نیاز به نسخه‌بندی ندارد
- deprecation header: `Deprecation: true` + `Sunset: <date>`

---

## 21. مرجع‌های مرتبط

- [`02-ARCHITECTURE.md`](./02-ARCHITECTURE.md) — کجا این API ها deploy می‌شوند
- [`04-DATABASE-SCHEMA.md`](./04-DATABASE-SCHEMA.md) — model داده‌ای پشت endpoint ها
- [`06-AI-ARCHITECTURE.md`](./06-AI-ARCHITECTURE.md) — جزئیات endpoint های AI
