# 📁 سند ساختار پروژه (Monorepo)

> Chat-Box — Turborepo + pnpm + polyglot (TS + Python)  
> ورژن 1.1 · مه 2026

**محیط dev مرجع:** **Ubuntu Desktop یا Server 22.04/24.04 LTS** با Docker CE و Node 20 — جزئیات در [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md).

---

## 1. اصول سازماندهی

| اصل | پیامد |
|---|---|
| **Monorepo از روز ۱** | کد share شده بین apps، single source of truth |
| **apps در `apps/`، packages در `packages/`** | استاندارد Turborepo |
| **هر app یک owner ذهنی** | کسی مسئول روی AI، کسی روی dashboard |
| **Polyglot نه به‌بهای ابزار** | سرویس Python داخل monorepo با Turbo task runner |
| **هر چیز shared باید package باشد** | نه import از `../../other-app/...` |
| **هیچ کدی روی root** | بجز config و scripts |

---

## 2. ساختار سطح بالا

```
chat-box/
├── apps/                       # Deployable applications
│   ├── api/                    # REST + WebSocket gateway (Node/Fastify)
│   ├── chat-service/           # Chat core service (Node/Fastify)
│   ├── auth-service/           # Auth service (Node/Fastify)
│   ├── billing-service/        # Billing (Node)
│   ├── notification-service/   # Email/SMS/Push worker (Node)
│   ├── analytics-service/      # Kafka → ClickHouse ETL (Node)
│   ├── integration-telegram/   # Telegram bot (Node + grammy)
│   ├── ai-service/             # AI Python service (FastAPI)
│   ├── knowledge-service/      # KB ingestion (Python)
│   ├── dashboard/              # Agent dashboard (Next.js 14)
│   ├── admin/                  # Internal admin panel (Next.js)
│   ├── widget/                 # Chat widget (Vanilla TS)
│   ├── mobile/                 # React Native (Expo)
│   └── landing/                # Marketing site (Next.js static)
│
├── packages/                   # Shared TS libs
│   ├── config/                 # tsconfig, biome, env schemas
│   ├── ui/                     # shadcn + design system
│   ├── icons/
│   ├── db/                     # Drizzle schema + queries
│   ├── auth/                   # Lucia session helpers
│   ├── sdk/                    # @chatbox/sdk public TypeScript SDK
│   ├── api-types/              # Shared Zod schemas (REST + WS contracts)
│   ├── events/                 # Kafka topics + CloudEvents schemas
│   ├── i18n/                   # Locales fa/en/ar
│   ├── analytics-events/       # Frontend tracking helpers
│   ├── logger/                 # pino + correlation_id
│   ├── otel/                   # OpenTelemetry helpers
│   └── testing/                # Test fixtures + mock factory
│
├── python-packages/            # Shared Python libs
│   ├── chatbox_core/           # config، logging، tracing
│   ├── chatbox_db/             # SQLAlchemy models (mirrors Drizzle)
│   ├── chatbox_llm/            # LLM client abstraction + fallback
│   ├── chatbox_rag/            # Embedding، chunking، retrieval
│   └── chatbox_eval/           # eval harness for AI
│
├── infra/                      # IaC
│   ├── k8s/                    # Helm charts per service
│   ├── terraform/              # Cloud DNS, secrets, buckets
│   ├── docker/                 # Dockerfiles per service
│   └── scripts/                # deploy.sh, rollback.sh, dr-test.sh
│
├── docs/                       # این پوشه — مستندات
│
├── tools/                      # Dev scripts
│   ├── seed/                   # Database seeding
│   ├── codegen/                # OpenAPI → SDK
│   └── migrate/                # Migration runner
│
├── .github/
│   ├── workflows/              # CI: lint, test, build, deploy
│   ├── CODEOWNERS
│   └── pull_request_template.md
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── .editorconfig
├── .gitignore
├── .env.example
├── docker-compose.yml          # local dev: PG, Redis, Redpanda, MinIO
├── CLAUDE.md                   # راهنمای AI Agent (مهم!)
├── README.md
└── LICENSE
```

---

## 3. توضیح apps

### 3.1 `apps/api/` — API Gateway

نقش: gateway و BFF برای dashboard/widget/mobile.

```
api/
├── src/
│   ├── routes/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── conversations/
│   │   ├── contacts/
│   │   ├── knowledge-bases/
│   │   ├── canned-responses/
│   │   ├── analytics/
│   │   ├── billing/
│   │   ├── webhooks/
│   │   └── widget/             # /widget/v1 endpoints
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── tenant.ts           # X-Workspace-Id → app.current_workspace
│   │   ├── rate-limit.ts
│   │   ├── error-handler.ts
│   │   └── correlation-id.ts
│   ├── plugins/                # Fastify plugins
│   ├── schemas/                # Zod → JSON schema for OpenAPI
│   ├── lib/                    # helpers
│   ├── app.ts                  # Fastify build
│   ├── server.ts               # entry point
│   └── env.ts                  # env validation با Zod
├── test/
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 3.2 `apps/chat-service/`

```
chat-service/
├── src/
│   ├── ws/
│   │   ├── adapter.ts          # Redis adapter for Socket.IO
│   │   ├── handlers/
│   │   │   ├── message.ts
│   │   │   ├── typing.ts
│   │   │   ├── presence.ts
│   │   │   └── conversation.ts
│   │   ├── auth.ts             # token verification
│   │   └── rooms.ts
│   ├── domain/
│   │   ├── conversation/
│   │   ├── message/
│   │   └── presence/
│   ├── events/                 # Kafka producers
│   ├── ai-bridge/              # forward to AI service
│   ├── app.ts
│   └── server.ts
└── ...
```

### 3.3 `apps/ai-service/` (Python)

```
ai-service/
├── src/chatbox_ai/
│   ├── api/                    # FastAPI routes
│   │   ├── routes/
│   │   │   ├── reply.py
│   │   │   ├── copilot.py
│   │   │   ├── summarize.py
│   │   │   ├── classify.py
│   │   │   └── search.py
│   │   ├── deps.py
│   │   └── main.py
│   ├── pipelines/
│   │   ├── auto_reply.py
│   │   ├── copilot.py
│   │   ├── intent.py
│   │   └── sentiment.py
│   ├── providers/
│   │   ├── openai_client.py
│   │   ├── anthropic_client.py
│   │   ├── local_client.py
│   │   └── fallback.py         # circuit breaker
│   ├── prompts/                # Jinja2 templates
│   │   ├── auto_reply.j2
│   │   ├── copilot.j2
│   │   └── summarizer.j2
│   ├── safety/
│   │   ├── pii.py
│   │   ├── jailbreak.py
│   │   └── profanity.py
│   └── settings.py
├── tests/
│   ├── unit/
│   └── eval/                   # eval datasets + runner
├── Dockerfile
├── pyproject.toml              # uv-managed
└── uv.lock
```

### 3.4 `apps/knowledge-service/` (Python)

```
knowledge-service/
├── src/chatbox_kb/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── documents.py
│   │   │   ├── jobs.py
│   │   │   └── search.py
│   │   └── main.py
│   ├── ingest/
│   │   ├── extract/            # Unstructured.io wrappers
│   │   ├── chunk/
│   │   ├── embed/
│   │   ├── crawl/              # URL crawler
│   │   └── pipeline.py
│   ├── workers/                # BullMQ via redis-py
│   └── settings.py
└── ...
```

### 3.5 `apps/dashboard/` (Next.js 14)

```
dashboard/
├── src/
│   ├── app/                    # App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── otp/
│   │   ├── (workspace)/
│   │   │   ├── [workspace]/
│   │   │   │   ├── inbox/      # Inbox اپراتور
│   │   │   │   │   ├── [convId]/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── contacts/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── settings/
│   │   │   │   ├── team/
│   │   │   │   ├── analytics/
│   │   │   │   ├── billing/
│   │   │   │   └── layout.tsx
│   │   │   └── (onboarding)/
│   │   ├── api/                # Route handlers (rare)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── inbox/
│   │   ├── conversation/
│   │   ├── copilot/
│   │   ├── kb/
│   │   └── ui/                 # local extensions، اصلیش در packages/ui
│   ├── hooks/
│   ├── lib/
│   │   ├── api.ts              # کلاینت rest
│   │   ├── ws.ts               # Socket.IO client
│   │   ├── auth.ts
│   │   └── i18n.ts
│   ├── stores/                 # Zustand
│   └── styles/
├── public/
├── tailwind.config.ts          # با tailwindcss-rtl plugin
├── next.config.mjs
└── package.json
```

### 3.6 `apps/widget/` (Vanilla TS)

```
widget/
├── src/
│   ├── core/
│   │   ├── widget.ts           # main entry
│   │   ├── transport.ts        # WS + HTTP fallback
│   │   ├── session.ts
│   │   └── auto-detect-rtl.ts
│   ├── ui/                     # Web Components
│   │   ├── chat-button.ts
│   │   ├── chat-panel.ts
│   │   ├── message-list.ts
│   │   ├── composer.ts
│   │   └── prechat-form.ts
│   ├── styles/                 # CSS-in-JS که در shadow DOM می‌رود
│   ├── types/
│   └── index.ts                # initChatBox()
├── test/
├── tsup.config.ts              # bundler
├── package.json
└── README.md
```

**Build target:**
- `dist/widget.js` — UMD < 30KB gzipped
- `dist/widget.esm.js`

### 3.7 `apps/mobile/` (React Native + Expo)

```
mobile/
├── src/
│   ├── app/                    # expo-router
│   │   ├── (auth)/
│   │   ├── (workspace)/
│   │   │   ├── inbox/
│   │   │   ├── conversation/[id].tsx
│   │   │   └── settings.tsx
│   │   └── _layout.tsx
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── stores/
├── assets/
├── app.config.ts
└── eas.json
```

---

## 4. توضیح packages

### 4.1 `packages/db/`

```
db/
├── src/
│   ├── schema/
│   │   ├── workspaces.ts
│   │   ├── users.ts
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   ├── kb.ts
│   │   ├── billing.ts
│   │   └── index.ts            # re-export
│   ├── migrations/
│   ├── seed/
│   ├── client.ts               # Drizzle client factory
│   ├── tenant.ts               # withTenant() helper
│   └── index.ts
├── drizzle.config.ts
└── package.json
```

### 4.2 `packages/api-types/`

```
api-types/
├── src/
│   ├── rest/                   # Zod schemas for every endpoint
│   │   ├── auth.ts
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   └── ...
│   ├── ws/                     # Socket.IO event types
│   │   ├── client-to-server.ts
│   │   └── server-to-client.ts
│   ├── widget/
│   └── index.ts
└── package.json
```

این package **منبع حقیقت** برای contract است. هم سرور Zod validate می‌کند، هم frontend type می‌گیرد.

### 4.3 `packages/ui/` (shadcn + customization)

```
ui/
├── src/
│   ├── primitives/             # button, input, dialog, ...
│   ├── patterns/               # ConversationCard, InboxList, MessageBubble
│   ├── icons/
│   ├── hooks/                  # useDirection, useKeyboard
│   ├── lib/cn.ts
│   ├── styles/
│   │   ├── tokens.css          # CSS variables
│   │   └── rtl.css
│   └── index.ts
└── package.json
```

### 4.4 `packages/events/`

```
events/
├── src/
│   ├── topics.ts               # 'chatbox.events.v1'
│   ├── schemas/                # CloudEvents schemas per event type
│   ├── producer.ts             # type-safe producer
│   └── consumer.ts
└── package.json
```

---

## 5. Tooling Configuration

### 5.1 `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

### 5.2 `turbo.json` نمونه

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "db:push": { "cache": false },
    "db:generate": { "cache": false }
  }
}
```

### 5.3 `biome.json`

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "rules": {
      "recommended": true,
      "style": { "useNamingConvention": "off" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } }
}
```

### 5.4 `.env.example`

```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/chatbox
DATABASE_RO_URL=

# Redis
REDIS_URL=redis://localhost:6379

# Kafka / Redpanda
KAFKA_BROKERS=localhost:19092

# Object Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=chatbox-files
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
COHERE_API_KEY=

# Payment
ZARINPAL_MERCHANT_ID=

# Auth
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
SESSION_SECRET=

# Telegram
TELEGRAM_WEBHOOK_BASE=

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=
SENTRY_DSN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

### 5.5 `docker-compose.yml` (local dev)

شامل: PostgreSQL + pgvector، Redis، Redpanda، MinIO، MailHog، Langfuse، Adminer.

---

## 6. اسکریپت‌های root

```jsonc
// package.json (root)
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint && biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:push": "pnpm --filter @chatbox/db db:push",
    "db:seed": "pnpm --filter @chatbox/db db:seed",
    "db:generate": "pnpm --filter @chatbox/db db:generate",
    "infra:up": "docker compose up -d",
    "infra:down": "docker compose down",
    "py:install": "uv pip install -r apps/ai-service/requirements.txt",
    "py:dev": "turbo run dev --filter=ai-service --filter=knowledge-service"
  }
}
```

---

## 7. CI/CD Layout

```
.github/workflows/
├── ci.yml                      # PR: lint + typecheck + test + build
├── deploy-staging.yml          # merge to develop
├── deploy-prod.yml             # tag v* on main
├── ai-eval.yml                 # nightly on ai-service changes
└── db-migration-check.yml      # forbid breaking migrations
```

CI parallelism از Turbo cache روی GitHub Actions cache استفاده می‌کند.

---

## 8. CODEOWNERS نمونه

```
*                       @cto
apps/ai-service/        @ai-lead
apps/knowledge-service/ @ai-lead
apps/dashboard/         @frontend
apps/widget/            @frontend
infra/                  @cto
docs/                   @cto
```

---

## 9. Conventions

### 9.1 نام‌گذاری

- **apps:** kebab-case، singular (`chat-service` نه `chat-services`)
- **packages:** scope `@chatbox/`، kebab-case (`@chatbox/db`)
- **فایل‌ها:** kebab-case (`conversation-card.tsx`)
- **components React:** PascalCase export
- **constants:** SCREAMING_SNAKE
- **types:** PascalCase با پسوند `Schema` برای Zod (مثل `MessageSchema`)

### 9.2 Imports

```ts
// 1) external
import { z } from 'zod';
// 2) @chatbox/*
import { db } from '@chatbox/db';
// 3) relative
import { foo } from './foo';
```

Biome این ترتیب را خودکار درست می‌کند.

### 9.3 Branch & PR

- `feat/<scope>-<short>` (e.g., `feat/chat-typing-indicator`)
- `fix/<scope>-<short>`
- `chore/<scope>-<short>`
- PR: title همان scope، body طبق template
- **squash merge** پیش‌فرض، Conventional Commits در body

---

## 10. Hot Reload Plan در Dev

| سرویس | روش |
|---|---|
| API/Chat/... (Node) | `tsx watch` با `--no-clear-screen` |
| AI/KB (Python) | `uvicorn --reload` |
| Dashboard/Admin | `next dev --turbo` |
| Widget | `tsup --watch` |
| Mobile | `expo start` |
| DB schema | `drizzle-kit push` در watch mode |

همه با یک `pnpm dev` در root راه می‌افتند (Turbo parallel).

---

## 11. Lazy adoption checklist

نباید روز اول همه چیز را بسازیم. ترتیب پیشنهادی:

1. **Sprint 0:** `apps/{api, chat-service, dashboard, widget}` + `packages/{db, api-types, ui, auth}`
2. **Sprint 1:** اضافه‌کردن `ai-service`, `knowledge-service`
3. **Sprint 2:** اضافه‌کردن `billing`, `notification`, `integration-telegram`
4. **Sprint 3:** اضافه‌کردن `mobile`, `admin`
5. **Sprint 4:** اضافه‌کردن `analytics-service`, `landing`

---

## 12. مرجع‌های مرتبط

- [`03-TECH-STACK.md`](./03-TECH-STACK.md) — جزئیات tech هر app
- [`08-ROADMAP.md`](./08-ROADMAP.md) — Sprint plan
- [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md) — راهنمای AI Agent برای کار با این monorepo
