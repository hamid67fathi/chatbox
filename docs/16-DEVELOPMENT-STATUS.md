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

> **الان:** P1.4 (ویجت) انجام شد؛ P1.5 (داشبورد inbox) آماده شروع.

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
| P1.5 | داشبورد inbox ساده | AGT-FE-01 | شروع نشده | — | — | — |
| P1.6 | تست یک happy path | AGT-QA-01 | شروع نشده | — | — | — |
| P2.1 | جداول KB در DB | AGT-DB-01 | شروع نشده | — | — | — |
| P2.2 | سرویس AI + RAG حداقلی | AGT-AI-01 | شروع نشده | — | — | — |
| P2.3 | اتصال API به AI | AGT-API-01 | شروع نشده | — | — | — |
| P2.4 | UI وضعیت AI / escalation | AGT-FE-01 | شروع نشده | — | — | — |
| P2.5 | مرور امنیتی PR | AGT-SEC-01 | شروع نشده | — | — | — |
| P2.6 | fixture / eval سبک | AGT-QA-01 | شروع نشده | — | — | — |
| P3.1 | Billing webhook حداقلی | AGT-API-01 | شروع نشده | — | — | — |
| P3.2 | Runbook + بکاپ spec | AGT-INF-01 | شروع نشده | — | — | — |
| P3.3 | پروفایل observability dev | AGT-DEVX-01 | شروع نشده | — | — | — |
| P3.4 | متن لندینگ قیمت | AGT-GTM-01 | شروع نشده | — | — | — |
| P3.5 | چک‌لیست pre-prod | AGT-SEC-01 | شروع نشده | — | — | — |

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
