# Roadmap Machine — بستهٔ پرامپت + اطلاعات برای هر مرحله (تحویل به AI)

> **ایدهٔ اصلی:** شما طبق برنامه‌ای که چیده‌اید، **برای هر مرحله یک بسته** آماده می‌کنید و به AI می‌دهید؛ AI همان بسته را می‌خواند و **برایتان می‌سازد**. این فایل همان بسته‌ها را قالب‌بندی کرده است.  
> **هم‌راستا با:** [`08-ROADMAP.md`](./08-ROADMAP.md)، [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md)، [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md)، [`07-PROJECT-STRUCTURE.md`](./07-PROJECT-STRUCTURE.md)، [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md)، [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md) (ردیاب وضعیت مراحل).

**قید میزبان:** تمام بسته‌های پرامپت و دستورات نمونه برای اجرا روی **Ubuntu 22.04 یا 24.04 LTS** (bash، Docker CE، همان مسیر سند ۱۵) نوشته شده‌اند؛ CI و لانچ نیز در اسناد زیرساخت روی همین خط پایه است.

---

## چطور از این فایل استفاده کنم؟ (۴ قدم برای شما)

1. **مرحلهٔ بعد** را از جدول فازها انتخاب کنید (مثلاً `P0.2`).  
2. بخش **«بسته: P…»** همان مرحله را باز کنید.  
3. در Cursor/ChatGPT: فایل‌های لیست‌شده در **پیوست‌ها** را `@` کنید (یا در چت دیگر paste کنید).  
4. بلوک **«پرامپت آماده — کپی کنید»** را یکجا کپی کنید؛ اگر جدول **«قبل از ارسال پر کنید»** دارد، اول آن را پر کنید سپس بفرستید.

بعد از تحویل، **خروجی مورد انتظار** را چک کنید؛ PR باید `PRIMARY_ROLE` در بدنه داشته باشد ([`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md)).

**ردیاب وضعیت:** پس از شروع یا اتمام هر مرحلهٔ `P…`، جدول [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md) را در همان PR یا PR فوری بعدی به‌روز کنید (ستون‌های وضعیت، تاریخ، PR).

---

## جدول مراحل (نقشهٔ کل)

| کد | عنوان کوتاه | Agent |
|----|----------------|--------|
| P0.1 | قواعد PR و branch | AGT-GOV-01 |
| P0.2 | Monorepo + API خالی + compose | AGT-DEVX-01 |
| P0.3 | README محلی + `.env.example` | AGT-INF-01 |
| P0.4 | CI سبز (lint/typecheck) | AGT-QA-01 |
| P1.1 | Schema + migration + RLS پایه | AGT-DB-01 |
| P1.2 | REST مکالمه/پیام حداقلی | AGT-API-01 |
| P1.3 | WebSocket + Redis adapter | AGT-RT-01 |
| P1.4 | ویجت vanilla | AGT-WGT-01 |
| P1.5 | داشبورد inbox ساده | AGT-FE-01 |
| P1.6 | تست یک happy path | AGT-QA-01 |
| P2.1 | جداول KB در DB | AGT-DB-01 |
| P2.2 | سرویس AI + RAG حداقلی | AGT-AI-01 |
| P2.3 | اتصال API به AI | AGT-API-01 |
| P2.4 | UI وضعیت AI / escalation | AGT-FE-01 |
| P2.5 | مرور امنیتی PR | AGT-SEC-01 |
| P2.6 | fixture / eval سبک | AGT-QA-01 |
| P3.1 | Billing webhook حداقلی | AGT-API-01 |
| P3.2 | Runbook + بکاپ spec | AGT-INF-01 |
| P3.3 | پروفایل observability dev | AGT-DEVX-01 |
| P3.4 | متن لندینگ قیمت | AGT-GTM-01 |
| P3.5 | چک‌لیست pre-prod | AGT-SEC-01 |

---

## الگوی استاندارد هر «بسته» (همهٔ بخش‌ها همین ساختار را دارند)

### الف) پیوست‌ها — حتماً به چت بدهید (`@` در Cursor)

- لیست فایل‌های `docs/*.md` (و در صورت وجود کد) که در همان بسته نام برده شده‌اند.

### ب) قبل از ارسال پر کنید (شما)

| فیلد | مثال | توضیح |
|------|------|--------|
| `REPO_ROOT` | `chat-box` | نام پوشهٔ ریشه اگر لازم شد |
| `ISSUE_URL` | لینک issue | برای ارجاع در PR |

### ج) پرامپت آماده — کپی کنید

یک بلوک کد زیر را بعد از پر کردن فیلدهای اختیاری بفرستید.

### د) خروجی که باید تحویل بگیرید

چک‌لیست قابل تیک زدن در همان بسته.

---

## قرارداد نام Agent (اول خط هر پرامپت)

```text
[AGENT-ID] نام کوتاه | PRIMARY_ROLE: <enum> | مرحله: P<x.y>
```

| ID | نام | PRIMARY_ROLE |
|----|-----|---------------|
| AGT-GOV-01 | Governance | PRODUCT |
| AGT-SPEC-01 | Spec-Keeper | ENGINEERING |
| AGT-DEVX-01 | DevEx | DEVOPS |
| AGT-INF-01 | Infra | DEVOPS |
| AGT-FE-01 | Dashboard | ENGINEERING |
| AGT-WGT-01 | Widget | ENGINEERING |
| AGT-API-01 | API-Core | ENGINEERING |
| AGT-RT-01 | Realtime | ENGINEERING |
| AGT-DB-01 | Data | ENGINEERING |
| AGT-AI-01 | AI-Pipeline | AI_ML |
| AGT-SEC-01 | Security | SECURITY |
| AGT-QA-01 | Quality | ENGINEERING |
| AGT-GTM-01 | GTM-Copy | GTM_MARKETING |

---

# فاز ۰ — بسته‌های آماده

---

## بسته: P0.1 — قواعد PR، branch، برچسب MVP

### پیوست‌ها (`@`)

- `docs/00-GOVERNANCE-ROLES.md`
- `docs/08-ROADMAP.md`
- `docs/09-AI-AGENT-GUIDE.md`

### قبل از ارسال پر کنید

| فیلد | مقدار |
|------|--------|
| نام پیش‌فرض branch اصلی | مثلاً `main` |
| آیا GitHub است؟ | بله / خیر → اگر خیر، GitLab را در پرامپت جایگزین کنید |

### پرامپت آماده — کپی کنید

```text
[AGT-GOV-01] Governance | PRIMARY_ROLE: PRODUCT | مرحله: P0.1

Task: Add repository governance artifacts only (no application code).
1) Add `.github/PULL_REQUEST_TEMPLATE.md` with sections: PRIMARY_ROLE, RELATED_DOCS, MVP_LABEL, TEST, ROLLBACK (match 09-AI-AGENT-GUIDE.md).
2) Add `CONTRIBUTING.md` with: branch naming (`feat/`, `fix/`, `chore/`), requirement one PRIMARY_ROLE per PR, link to 00-GOVERNANCE-ROLES.md.
3) Add short `docs/BRANCHING.md` if not exists: default branch, squash merge recommendation.
Do not implement features. If files already exist, improve minimally without scope creep.

Acceptance: PR template renders on GitHub; CONTRIBUTING links to governance doc.
```

### خروجی مورد انتظار

- [x] `PULL_REQUEST_TEMPLATE` با فیلدهای قواعد  
- [x] `CONTRIBUTING.md`  
- [x] بدون کد اپلیکیشن اضافه

---

## بسته: P0.2 — Monorepo + API سلامت + Docker Compose

### پیوست‌ها (`@`)

- `docs/07-PROJECT-STRUCTURE.md`
- `docs/03-TECH-STACK.md`
- `docs/14-INFRASTRUCTURE.md` (بخش‌های ۴ و ۴.۲ مربوط dev)
- `docs/05-API-SPEC.md` (فقط برای قرارداد کلی خطا اگر لازم شد — اختیاری)

### قبل از ارسال پر کنید

| فیلد | مقدار |
|------|--------|
| پورت API محلی | پیش‌فرض `3001` مگر خلافش را می‌خواهید |
| پورت Postgres در compose | `5432` |
| پورت Redis | `6379` |

### پرامپت آماده — کپی کنید

```text
[AGT-DEVX-01] DevEx | PRIMARY_ROLE: DEVOPS | مرحله: P0.2

Task: Bootstrap monorepo for Chat-Box per docs/07-PROJECT-STRUCTURE.md and stack in 03-TECH-STACK.md.

Requirements:
- Target developer OS: Ubuntu 22.04 or 24.04 LTS; document any assumption of bash and paths accordingly.
- pnpm workspace + Turborepo at repo root.
- packages: at least `packages/config` (shared tsconfig/biome stubs).
- apps: `apps/api` — Fastify + TypeScript, listens PORT env default 3001, route GET /health returns JSON { ok: true }.
- Root scripts: lint, typecheck, build (turbo pipelines).
- docker-compose.yml: postgres 16 + redis 7, named volumes, ports documented; add `.env.example` with DATABASE_URL and REDIS_URL pointing to compose services.
- No auth, no widget, no AI services yet.

PRIMARY_ROLE in future PRs will be declared by humans; prepare only infra here.

Acceptance: `pnpm install` works; `docker compose up -d` starts DB+Redis; `pnpm --filter api dev` serves /health.
```

### خروجی مورد انتظار

- [x] ساختار `apps/` و `packages/` مطابق سند ساختار  
- [x] `docker-compose` + `.env.example`  
- [x] اسکلت `apps/api` با `/health`

---

## بسته: P0.3 — README اجرا + پورت‌ها

### پیوست‌ها (`@`)

- `docs/14-INFRASTRUCTURE.md`
- `docs/12-OPERATIONS-SUPPORT.md` (فقط اگر runbook کوتک می‌خواهید)
- `README.md` ریشه (اگر وجود دارد) یا بسازید

### پرامپت آماده — کپی کنید

```text
[AGT-INF-01] Infra | PRIMARY_ROLE: DEVOPS | مرحله: P0.3

Task: Update root README.md with "Local development" section: prerequisites (Ubuntu 22.04/24.04 LTS, Docker CE + compose plugin, Node 20, pnpm 9), commands to start compose, migrate (stub if no migrations yet), run API, URLs and ports table aligned with 14-INFRASTRUCTURE.md section 5 (adjust if your compose uses different host ports). No secrets.

Acceptance: new developer can follow README only to reach GET /health OK.
```

### خروجی مورد انتظار

- [x] README با جدول پورت و دستورات

---

## بسته: P0.4 — CI سبز

### پیوست‌ها (`@`)

- `docs/09-AI-AGENT-GUIDE.md`
- `docs/03-TECH-STACK.md` (Biome/Vitest)

### پرامپت آماده — کپی کنید

```text
[AGT-QA-01] Quality | PRIMARY_ROLE: ENGINEERING | مرحله: P0.4

Task: Add GitHub Actions workflow `.github/workflows/ci.yml` running on PR on **ubuntu-latest** (aligns with project baseline Ubuntu 22.04/24.04): install pnpm, cache, run lint + typecheck across monorepo (turbo). Optional: single trivial vitest that always passes in packages/config or apps/api.
Fail if lint/typecheck fails.

Acceptance: workflow file exists; passes on clean tree.
```

### خروجی مورد انتظار

- [x] CI سبز روی PR

---

# فاز ۱ — بسته‌های آماده

---

## بسته: P1.1 — دیتابیس اولیه + RLS

### پیوست‌ها (`@`)

- `docs/04-DATABASE-SCHEMA.md`
- `docs/11-SECURITY-PRIVACY.md` (RLS)
- `docs/05-API-SPEC.md` (مدل workspace/conversation اگر موجود است)

### پرامپت آماده — کپی کنید

```text
[AGT-DB-01] Data | PRIMARY_ROLE: ENGINEERING | مرحله: P1.1

Task: Implement initial PostgreSQL schema + Drizzle (or chosen ORM per repo) for multi-tenant core tables: workspace, user (minimal), conversation, message — follow docs/04-DATABASE-SCHEMA.md as source of truth. Enable RLS policies per workspace_id as in doc. Provide migration command and seed script optional single dev workspace.

Acceptance: migrations apply on fresh DB; RLS prevents cross-tenant read in a test.
```

### خروجی مورد انتظار

- [x] migrationها + RLS  
- [ ] تست cross-tenant حداقلی (بعد از deploy و push migration)

---

## بسته: P1.2 — REST حداقلی

### پیوست‌ها (`@`)

- `docs/05-API-SPEC.md`
- `docs/04-DATABASE-SCHEMA.md`
- `docs/11-SECURITY-PRIVACY.md`

### پرامپت آماده — کپی کنید

```text
[AGT-API-01] API-Core | PRIMARY_ROLE: ENGINEERING | مرحله: P1.2

Task: In apps/api, implement minimal REST for workspaces and conversations/messages per 05-API-SPEC.md (stub auth if spec allows with explicit TODO + issue id). Standard error JSON format from spec. All queries tenant-scoped.

Acceptance: curl examples in PR description; OpenAPI stub optional.
```

### خروجی مورد انتظار

- [x] endpointهای حداقلی + خطای استاندارد

---

## بسته: P1.3 — WebSocket

### پیوست‌ها (`@`)

- `docs/05-API-SPEC.md` (بخش WebSocket)
- `docs/02-ARCHITECTURE.md` (sequence diagram بخش ۵)
- `docs/03-TECH-STACK.md`

### پرامپت آماده — کپی کنید

```text
[AGT-RT-01] Realtime | PRIMARY_ROLE: ENGINEERING | مرحله: P1.3

Task: Add Socket.io (or stack in 03) with Redis adapter: join conversation room, broadcast new message events, typing stub. Align event names with 05-API-SPEC.md. Document handshake expectations for workspace_id (stub token acceptable with TODO).

Acceptance: manual test steps in PR; unit test for room name formatting if easy.
```

### خروجی مورد انتظار

- [x] WS + Redis adapter  
- [x] لیست eventها در PR

---

## بسته: P1.4 — ویجت

### پیوست‌ها (`@`)

- `docs/05-API-SPEC.md` (Widget)
- `docs/07-PROJECT-STRUCTURE.md`
- `docs/03-TECH-STACK.md` (Vanilla + size goal)

### پرامپت آماده — کپی کنید

```text
[AGT-WGT-01] Widget | PRIMARY_ROLE: ENGINEERING | مرحله: P1.4

Task: Create apps/widget — Vanilla TS build (tsup) under size budget in PRD/03. Embed script loads, connects to WS per 05, sends/receives plain text messages for one conversation id passed via data-attribute config. No React runtime in bundle.

Acceptance: demo HTML in apps/widget/demo.html works against local API; bundle size reported in PR.
```

### خروجی مورد انتظار

- [ ] ویجت build + دمو محلی

---

## بسته: P1.5 — داشبورد inbox

### پیوست‌ها (`@`)

- `docs/01-PRD.md` (MVP inbox)
- `docs/05-API-SPEC.md`
- `docs/07-PROJECT-STRUCTURE.md`

### پرامپت آماده — کپی کنید

```text
[AGT-FE-01] Dashboard | PRIMARY_ROLE: ENGINEERING | مرحله: P1.5

Task: apps/dashboard Next.js 14 App Router: RTL layout (fa), list conversations from REST, open thread, send message via REST or WS per 05. Minimal UI with shadcn if already in stack doc; otherwise plain components. Env NEXT_PUBLIC_API_URL.

Acceptance: screenshots in PR; keyboard focus sane for RTL.
```

### خروجی مورد انتظار

- [ ] inbox مینیمال RTL

---

## بسته: P1.6 — تست happy path

### پیوست‌ها (`@`)

- `docs/09-AI-AGENT-GUIDE.md`
- کد `apps/api` و در صورت تمایل `apps/dashboard`

### پرامپت آماده — کپی کنید

```text
[AGT-QA-01] Quality | PRIMARY_ROLE: ENGINEERING | مرحله: P1.6

Task: Add Playwright (or vitest+supertest) covering: start stack (document assumption), create workspace stub via API if available, open dashboard, assert conversation list loads OR API health + one REST flow. Keep CI runtime small.

Acceptance: test runs in CI with documented env.
```

### خروجی مورد انتظار

- [ ] یک مسیر اتوماتیک سبز

---

# فاز ۲ — بسته‌های آماده (خلاصهٔ پرامپت کامل)

---

## بسته: P2.1 — جداول KB

**پیوست‌ها:** `04-DATABASE-SCHEMA.md` (بخش KB)، `05-API-SPEC.md` (KB)

**پرامپت:**

```text
[AGT-DB-01] Data | PRIMARY_ROLE: ENGINEERING | مرحله: P2.1
Implement KB tables, chunks, embeddings storage per 04-DATABASE-SCHEMA.md; migrations + RLS. No LLM calls here.
Acceptance: schema matches doc sections; migration up/down.
```

---

## بسته: P2.2 — سرویس AI

**پیوست‌ها:** `06-AI-ARCHITECTURE.md`, `11-SECURITY-PRIVACY.md`, `05-API-SPEC.md`

**پرامپت:**

```text
[AGT-AI-01] AI-Pipeline | PRIMARY_ROLE: AI_ML | مرحله: P2.2
Create apps/ai-service FastAPI: ingest text, chunk, embed (stub or OpenAI per env), retrieve top-k, call mini model with confidence; redact PII per 11 before external call; return structured response + handoff flag. Langfuse hook stub optional.
Acceptance: curl example + env documented in .env.example (no secrets).
```

---

## بسته: P2.3 — اتصال API به AI

**پیوست‌ها:** `05-API-SPEC.md`, `06-AI-ARCHITECTURE.md`

**پرامپت:**

```text
[AGT-API-01] API-Core | PRIMARY_ROLE: ENGINEERING | مرحله: P2.3
From chat pipeline on new inbound message, call ai-service HTTP with timeouts + circuit breaker; persist AI message if confidence above threshold else flag needs_human.
Acceptance: integration test or recorded mock.
```

---

## بسته: P2.4 — UI وضعیت AI

**پیوست‌ها:** `01-PRD.md`, `06-AI-ARCHITECTURE.md`

**پرامپت:**

```text
[AGT-FE-01] Dashboard | PRIMARY_ROLE: ENGINEERING | مرحله: P2.4
Show AI vs human messages and needs_human badge in thread UI; RTL-safe.
Acceptance: screenshot + a11y basic (contrast not broken).
```

---

## بسته: P2.5 — مرور امنیتی

**پیوست‌ها:** `11-SECURITY-PRIVACY.md`, diff آخرین PRهای فاز ۲

**پرامپت:**

```text
[AGT-SEC-01] Security | PRIMARY_ROLE: SECURITY | مرحله: P2.5
Review merged changes for P2.x: PII flow, rate limits on public routes, tenant isolation on AI path. Output PASS or MUST_FIX list P1/P2.
```

---

## بسته: P2.6 — fixture فارسی eval

**پیوست‌ها:** `06-AI-ARCHITECTURE.md`

**پرامپت:**

```text
[AGT-QA-01] Quality | PRIMARY_ROLE: ENGINEERING | مرحله: P2.6
Add small JSONL fixture of Persian FAQ Q/A for smoke eval of ai-service (no full RAGAS yet). Document how to run in CI optionally nightly not blocking.
```

---

# فاز ۳ — بسته‌های آماده (خلاصه)

---

## بسته: P3.1 — Billing

**پیوست‌ها:** `05-API-SPEC.md` (Billing)، `10-GTM-PRICING-MARKETING.md`

```text
[AGT-API-01] API-Core | PRIMARY_ROLE: ENGINEERING | مرحله: P3.1
Implement Zarinpal webhook stub + subscription state machine minimal per 05; sandbox notes in README; no real merchant id in repo.
```

## بسته: P3.2 — Runbook

**پیوست‌ها:** `12-OPERATIONS-SUPPORT.md`, `14-INFRASTRUCTURE.md`

```text
[AGT-INF-01] Infra | PRIMARY_ROLE: DEVOPS | مرحله: P3.2
Expand ops docs: backup schedule template, restore drill checklist, env var table for production.
```

## بسته: P3.3 — Observability dev profile

**پیوست‌ها:** `03-TECH-STACK.md`, `12-OPERATIONS-SUPPORT.md`

```text
[AGT-DEVX-01] DevEx | PRIMARY_ROLE: DEVOPS | مرحله: P3.3
Optional docker profile or compose override adding prometheus/grafana/loki for local dev only; document ports.
```

## بسته: P3.4 — متن GTM

**پیوست‌ها:** `10-GTM-PRICING-MARKETING.md`, `01-PRD.md`

```text
[AGT-GTM-01] GTM-Copy | PRIMARY_ROLE: GTM_MARKETING | مرحله: P3.4
Produce Persian landing copy blocks (hero, features, pricing) as markdown files under docs/marketing/ — no auth code changes.
```

## بسته: P3.5 — Pre-prod security checklist

**پیوست‌ها:** `11-SECURITY-PRIVACY.md`, `14-INFRASTRUCTURE.md`

```text
[AGT-SEC-01] Security | PRIMARY_ROLE: SECURITY | مرحله: P3.5
Produce checklist result table against 11 for current codebase; file under docs/security/preprod-checklist.md.
```

---

## پرامپت‌های کمکی (بعد از PR)

### بازبینی قرارداد Spec

```text
[AGT-SPEC-01] Spec-Keeper | PRIMARY_ROLE: ENGINEERING | مرحله: —
Review PR #<N>: list any drift vs 05-API-SPEC.md and 04-DATABASE-SCHEMA.md. APPROVE or CHANGES_REQUIRED with file paths.
```

---

## خط قرمز (برای همهٔ بسته‌ها)

این موارد را به انتهای پرامپت خود اضافه کنید یا به Agent بگویید [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md) و [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md) را رعایت کند:

- هیچ **secret**ای در ریپو؛ **RLS** و `workspace_id` قربانی سرعت نشوند؛ ویجت **بدون React سنگین** در bundle؛ هر PR دقیقاً یک **`PRIMARY_ROLE`** در بدنه.

---

**نسخه:** 1.1 · مه 2026  
**تغییر نسبت به ۱.۰:** چیدمان «بستهٔ تحویل به AI» با پرامپت کامل فاز ۰ و ۱؛ فاز ۲ و ۳ فشرده با پرامپت قابل گسترش.
