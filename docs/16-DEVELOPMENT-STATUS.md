# 📊 وضعیت اجرای مراحل توسعه (ردیاب)

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** Engineering (به‌روزرسانی همراه با PR هر مرحله)  
> **هم‌راستا با:** [`roadmap_machine.md`](./roadmap_machine.md) (بسته‌های پرامپت)، [`08-ROADMAP.md`](./08-ROADMAP.md)، [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md)

این فایل **تنها جدول وضعیت** برای مراحل تعریف‌شده در `roadmap_machine.md` است. بعد از اتمام یا شروع هر مرحله، **همین جدول را در همان PR یا PR بلافاصله بعدی** به‌روز کنید تا تیم و Agent بعدی بدانند کجای مسیر هستید.

---

## Machine-readable (برای Agent)

```yaml
doc_id: 16-DEVELOPMENT-STATUS
version: 1.0.0
tracker_for: roadmap_machine_phases
status_enum:
  - not_started    # شروع نشده
  - in_progress    # در حال انجام
  - blocked        # مسدود — در ستون یادداشت دلیل را بنویسید
  - done           # انجام شد — در ستون PR لینک merge را بگذارید
rule: >
  When a phase from roadmap_machine is completed or started, update this table
  in the same PR as the code/docs change, or in a follow-up PR within 24h.
```

---

## قرارداد ستون «وضعیت»

| مقدار در جدول (فارسی) | معادل enum |
|------------------------|------------|
| شروع نشده | `not_started` |
| در حال انجام | `in_progress` |
| مسدود | `blocked` |
| انجام شد | `done` |

---

## جدول وضعیت (مراحل P0 → P3)

> **الان:** فاز 0 تا 4 کامل شد (MVP + Auth). فاز 5 (داشبورد محصول) آماده شروع — مسیر تولید P5→P10.

| کد | عنوان کوتاه | Agent (مرجع) | وضعیت | تاریخ به‌روزرسانی | PR / شاخه | یادداشت |
|----|----------------|--------------|--------|-------------------|-----------|---------|
| P0.1 | قواعد PR و branch | AGT-GOV-01 | انجام شد | 2026-05-12 | — | `.github/PULL_REQUEST_TEMPLATE.md`، `CONTRIBUTING.md`، `docs/BRANCHING.md` |
| P0.2 | Monorepo + API خالی + compose | AGT-DEVX-01 | انجام شد | 2026-05-12 | — | `apps/api`، `packages/config`، `docker-compose.yml`، `pnpm-workspace` + turbo |
| P0.3 | README محلی + `.env.example` | AGT-INF-01 | انجام شد | 2026-05-13 | — | README با جدول پورت‌ها، prerequisites، ساختار پروژه |
| P0.4 | CI سبز (lint/typecheck) | AGT-QA-01 | انجام شد | 2026-05-13 | — | `.github/workflows/ci.yml` — lint + typecheck + build |
| P1.1 | Schema + migration + RLS پایه | AGT-DB-01 | انجام شد | 2026-05-13 | — | Drizzle schema (9 tables) + RLS policies + triggers + seed |
| P1.2 | REST مکالمه/پیام حداقلی | AGT-API-01 | انجام شد | 2026-05-13 | — | Workspaces, Contacts, Conversations, Messages CRUD + error format |
| P1.3 | WebSocket + Redis adapter | AGT-RT-01 | انجام شد | 2026-05-13 | — | Socket.io 4 + Redis adapter + events + REST broadcast |
| P1.4 | ویجت vanilla | AGT-WGT-01 | انجام شد | 2026-05-13 | — | apps/widget (tsup IIFE 7.97 KB) + widget API route + demo.html + CORS |
| P1.5 | داشبورد inbox ساده | AGT-FE-01 | انجام شد | 2026-05-13 | — | Next.js 14 App Router, RTL, conversation list + message thread + Socket.io real-time |
| P1.6 | تست یک happy path | AGT-QA-01 | انجام شد | 2026-05-13 | — | vitest + supertest, 8 tests (health→widget session), CI with Postgres+Redis services |
| P2.1 | جداول KB در DB | AGT-DB-01 | انجام شد | 2026-05-13 | — | knowledge_bases, kb_documents, kb_chunks (pgvector), ai_interactions + RLS + HNSW index |
| P2.2 | سرویس AI + RAG حداقلی | AGT-AI-01 | انجام شد | 2026-05-13 | — | FastAPI: ingest+chunk+embed, retrieve top-k, LLM reply+confidence, PII redaction, stub mode |
| P2.3 | اتصال API به AI | AGT-API-01 | انجام شد | 2026-05-13 | — | AI client with timeout+circuit breaker, auto-reply on contact message, ai_interactions log |
| P2.4 | UI وضعیت AI / escalation | AGT-FE-01 | انجام شد | 2026-05-13 | — | AI vs human badges on messages, needs_human badge on conv list, real-time conv:needs_human |
| P2.5 | مرور امنیتی PR | AGT-SEC-01 | انجام شد | 2026-05-13 | — | helmet + rate-limit on widget, security review doc PASS |
| P2.6 | fixture / eval سبک | AGT-QA-01 | انجام شد | 2026-05-13 | — | 10 Persian FAQ fixtures + smoke eval script |
| P3.1 | Billing webhook حداقلی | AGT-API-01 | انجام شد | 2026-05-13 | — | subscriptions + payments schema, Zarinpal sandbox webhook, checkout + verify routes |
| P3.2 | Runbook + بکاپ spec | AGT-INF-01 | انجام شد | 2026-05-13 | — | docs/ops/RUNBOOK.md — backup schedule, restore drill, env var table |
| P3.3 | پروفایل observability dev | AGT-DEVX-01 | انجام شد | 2026-05-13 | — | docker-compose.observability.yml — Prometheus + Grafana + Loki |
| P3.4 | متن لندینگ قیمت | AGT-GTM-01 | انجام شد | 2026-05-13 | — | docs/marketing/ — hero, features, pricing (Persian) |
| P3.5 | چک‌لیست pre-prod | AGT-SEC-01 | انجام شد | 2026-05-13 | — | docs/security/preprod-checklist.md — 16 PASS, 7 P4, 3 OPS, 3 WARN |

---

## جدول وضعیت (مراحل P4 → P10 — مسیر تولید)

> **هدف:** تبدیل MVP به محصول قابل عرضه عمومی با احراز هویت، داشبورد کامل، AI پیشرفته، لندینگ، billing واقعی و زیرساخت تولید.

### فاز ۴ — احراز هویت و امنیت

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P4.1 | سیستم Auth سمت API | JWT (jose) + bcrypt + sessions/otp tables + register/login/refresh/logout + auth middleware | انجام شد | 2026-05-13 | auth lib, routes, migration |
| P4.2 | RBAC و Workspace Isolation | استخراج workspace از JWT، role check، جلوگیری cross-workspace | انجام شد | 2026-05-13 | rbac.ts؛ inbox isolation: صف مشترک + تخصیص خودکار |
| P4.2+ | سطوح دسترسی آینده (برنامه) | نقش‌های تفصیلی، صف تیم، دسترسی گزارش/تنظیمات per-permission | برنامه‌ریزی | — | owner/admin همه را می‌بینند؛ agent فقط صف باز + مکالمات خود |
| P4.3 | Widget Visitor Token | visitor_token (JWT 24h)، ذخیره در ویجت، اعتبارسنجی Socket.IO | انجام شد | 2026-05-13 | signVisitorToken + requireVisitorToken |
| P4.4 | Login/Signup داشبورد | صفحات login + signup، auth context، httpOnly cookie، redirect guard | انجام شد | 2026-05-13 | /login, /register, AuthGuard, auth-store |
| P4.5 | امنیت تکمیلی | unauthorized/forbidden errors، فیلتر PII لاگ، CSRF، محدود CORS | انجام شد | 2026-05-13 | CORS credentials, cookie plugin, seed bcrypt password |

### فاز ۵ — داشبورد محصول

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P5.1 | UI Framework Setup | Tailwind CSS + RTL + shadcn/ui، layout (sidebar + header)، dark mode | انجام شد | 2026-05-16 | Tailwind v3، AppShell/Sidebar/Header، ThemeProvider، Button/Input |
| P5.2 | Inbox کامل | جستجو، فیلتر، مرتب‌سازی، pagination، typing indicator، read receipts | انجام شد | 2026-05-16 | infinite scroll، typing، ✓/✓✓ read receipts |
| P5.3 | مدیریت مکالمه | Assignment، تغییر وضعیت، Tags/Notes UI، Priority، Reply-to/Quote | انجام شد | 2026-05-16 | toolbar وضعیت/تخصیص/اولویت/تگ/یادداشت + reply |
| P5.4 | پاسخ‌های آماده | CRUD canned responses، جستجوی /shortcut، متغیرها | انجام شد | 2026-05-16 | API CRUD + صفحه /canned + picker در composer |
| P5.5 | تنظیمات و مدیریت تیم | Settings، invite اعضا، تغییر role، workspace management | انجام شد | 2026-05-16 | /settings + /team، invite با رمز موقت |
| P5.6 | Knowledge Base UI | آپلود اسناد، لیست KB/docs، وضعیت indexing، حذف و re-index | انجام شد | 2026-05-16 | /knowledge، txt/md، ingest به AI service |

### فاز ۶ — ویجت و تجربه چت

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P6.1 | Theming و سفارشی‌سازی | Config: color/position/welcome/avatar، CSS variables، widget config API | انجام شد | 2026-05-16 | GET /widget/v1/config، تب ویجت در /settings |
| P6.2 | Pre-chat Form | فرم نام/ایمیل/تلفن، ذخیره contact، قابل تنظیم از داشبورد | انجام شد | 2026-05-16 | PATCH /widget/v1/contact، تنظیم در تب ویجت |
| P6.3 | File Upload | آپلود تصویر/فایل (ویجت + داشبورد)، ذخیره local، پیش‌نمایش تصویر | انجام شد | 2026-05-16 | POST /v1/uploads، /widget/v1/uploads، attachments در پیام |
| P6.4 | تجربه چت پیشرفته | Emoji، وضعیت پیام، welcome message، triggers، mobile responsive | انجام شد | 2026-05-16 | emoji + ✓/✓✓، triggers در settings، RTL/LTR خودکار |

### فاز ۷ — ارتقاء سرویس AI

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P7.1 | Intent Classifier + Router | کلاسیفایر ۵ کلاس، router به RAG/tool-use/escalation | انجام شد | 2026-05-16 | /v1/ask + /v1/classify، heuristic + LLM |
| P7.2 | Copilot (پیشنهاد پاسخ) | /v1/copilot، ۳ پیشنهاد، SSE streaming، UI داشبورد | انجام شد | 2026-05-16 | دکمه ✨ در inbox، UI build 13 |
| P7.3 | Summarizer و Sentiment | خلاصه مکالمه، امتیاز sentiment، mood indicator | انجام شد | 2026-05-16 | /v1/summarize، خلاصه در toolbar، mood در inbox |
| P7.4 | بهبود RAG | Cohere reranker، Persian normalization، کش ۴ سطحی، multi-model fallback | انجام شد | 2026-05-16 | retrieve 20→rerank 5، OpenAI→Anthropic→template |
| P7.5 | هزینه و مانیتورینگ AI | per-workspace credits، budget enforcement، Langfuse | انجام شد | 2026-05-16 | ai-usage API، بنر داشبورد، Langfuse اختیاری |

### فاز ۸ — لندینگ پیج و Billing واقعی

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P8.1 | اپلیکیشن لندینگ پیج | apps/landing (Next.js static)، Home/Pricing/About/Contact، دمو ویجت | انجام شد | 2026-05-16 | پورت 3002، static export |
| P8.2 | Billing واقعی (Zarinpal) | SDK رسمی، فاکتور PDF، مدیریت اشتراک، trial 7 روزه، webhook | انجام شد | 2026-05-16 | verify عمومی، PDF، trial، cancel، webhook |
| P8.3 | اعمال محدودیت پلن‌ها | محدودیت agent/مکالمه/AI credits، نمایش usage، هشدار سقف | انجام شد | 2026-05-16 | plan-limits.ts؛ invite/chat/upload؛ GET plan-usage؛ /billing + بنر |

### فاز ۹ — زیرساخت و Deploy تولید

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P9.1 | Dockerfiles | multi-stage build برای api/dashboard/widget/ai-service/landing | شروع نشده | — | — |
| P9.2 | Production Compose | docker-compose.prod.yml، Nginx + SSL (Let's Encrypt)، health checks | شروع نشده | — | — |
| P9.3 | CI/CD کامل | Docker build+push GHCR، تست Python، E2E، audit، deploy trigger | شروع نشده | — | — |
| P9.4 | Backup خودکار | cron pg_dump هر ۶ ساعت، rotation ۳۰ روز، بازیابی، Redis snapshot | شروع نشده | — | — |
| P9.5 | Monitoring و Alerting | Prometheus alerts، Grafana dashboards، uptime، Loki logs | شروع نشده | — | — |

### فاز ۱۰ — پولیش و آمادگی لانچ

| کد | عنوان | توضیح | وضعیت | تاریخ | یادداشت |
|----|-------|-------|--------|-------|---------|
| P10.1 | i18n (چندزبانگی) | next-intl، FA + EN، تغییر زبان، auto-detect ویجت | شروع نشده | — | — |
| P10.2 | Accessibility | ARIA، focus management، keyboard nav، screen reader، WCAG 2.1 AA | شروع نشده | — | — |
| P10.3 | Performance | Widget <30KB، API P95 <300ms، query optimization، assets | شروع نشده | — | — |
| P10.4 | تست جامع | E2E Playwright، k6 load test، AI eval gate، security pentest | شروع نشده | — | — |
| P10.5 | مستندات نهایی | OpenAPI/Swagger، user guide فارسی، developer onboarding، changelog | شروع نشده | — | — |

---

## فیچر لیست (بک‌لاگ محصول)

> قابلیت‌های درخواست‌شده برای توسعه آینده — خارج از جدول فازهای P0–P10. با شروع پیاده‌سازی، وضعیت را به‌روز کنید.

| کد | عنوان | توضیح | دسته | وضعیت | فاز مرتبط |
|----|--------|-------|------|--------|-----------|
| FL-01 | مستندات API | مستندات عمومی REST برای یکپارچه‌سازی (OpenAPI/Swagger، مثال‌ها، auth) | توسعه‌دهندگان | برنامه‌ریزی | P10.5 |
| FL-02 | توکن API برای برنامه‌نویسان | ساخت/لغو توکن شخصی workspace برای فراخوانی API و webhook | توسعه‌دهندگان | برنامه‌ریزی | P4+ |
| FL-03 | لیست پلن‌های شارژ اکانت | نمایش پلن‌های افزایش اعتبار/شارژ (AI credits، موجودی) و خرید از پنل | Billing | برنامه‌ریزی | P8 |
| FL-04 | محدودیت پلن (اپراتور / چت / آپلود) | سقف تعداد اپراتور، تعداد مکالمه فعال، حجم فایل آپلود بر اساس پلن جاری + هشدار نزدیک سقف | Billing | انجام شد | P8.3 |
| FL-05 | ابزارک (ویجت + پلاگین) | ویجت embed + پلاگین CMS (وردپرس و …) با برند «ابزارک» | ابزارک | برنامه‌ریزی | P6 / P8 |
| FL-06 | آرشیو گفتگوها | آرشیو کردن مکالمات (خارج از inbox فعال)، بازیابی و فیلتر archived | Inbox | برنامه‌ریزی | P5+ |
| FL-07 | گزارش گفتگوها | گزارش بر اساس بازه تاریخ، export، جستجو در متن/فیلترها | گزارش | برنامه‌ریزی | P5+ |
| FL-08 | تعداد بازدیدکننده آنلاین | نمایش live تعداد مشتری/بازدیدکننده آنلاین در داشبورد | ریل‌تایم | برنامه‌ریزی | P1.3+ |
| FL-09 | تعداد اپراتور آنلاین | نمایش live تعداد اپراتورهای آنلاین (presence) | ریل‌تایم | برنامه‌ریزی | P1.3+ |
| FL-10 | اطلاعات بازدیدکننده (صفحه / IP / دستگاه) | IP، URL صفحه فعلی، کشور (GeoIP)، نوع دستگاه و نسخه مرورگر/OS در پنل اپراتور | Visitor | برنامه‌ریزی | P6+ |
| FL-11 | سابقه بازدید صفحات | نگهداری و نمایش تاریخچه صفحاتی که مشتری بازدید کرده (مسیر در سایت) | Visitor | برنامه‌ریزی | P6+ |
| FL-12 | آواتار اپراتور | آپلود/تنظیم آواتار برای هر اپراتور (نمایش در چت و لیست تیم) | تیم | برنامه‌ریزی | P5.5+ |
| FL-13 | Ban کاربر | مسدود کردن contact خاطی (عدم امکان چت جدید از همان هویت) | امنیت | برنامه‌ریزی | P4+ |
| FL-14 | Ban بر اساس IP | مسدود کردن IP یا محدوده IP برای جلوگیری از سوءاستفاده | امنیت | برنامه‌ریزی | P4+ |

---

## چک‌لیست‌های دیگر کجا هستند؟

| نوع | محل |
|-----|-----|
| خروجی دقیق هر بستهٔ AI | بخش **«خروجی مورد انتظار»** زیر هر `P…` در [`roadmap_machine.md`](./roadmap_machine.md) |
| قبل از باز کردن PR | [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md) — «چک‌لیست یک‌صفحه‌ای» |
| امنیت MVP | [`11-SECURITY-PRIVACY.md`](./11-SECURITY-PRIVACY.md) |
| نصب سرور Ubuntu (اینترنت آزاد) | [`SERVER-DEV-FIRST-INSTALL-FA.md`](./SERVER-DEV-FIRST-INSTALL-FA.md) |
| قبل از اولین production | [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md) بخش ۱۳ |

---

**پایان سند.** با اتمام هر مرحله، این جدول را به‌روز نگه دارید.
