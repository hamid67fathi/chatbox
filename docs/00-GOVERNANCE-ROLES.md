# ⚖️ Governance & Role Charter — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **هدف:** توسعهٔ کامل محصول با AI، بدون قاطی شدن نقش‌ها در یک PR یا یک چت.

---

## خلاصه (فارسی)

در این پروژه **یک انسان** ممکن است مالک چند نقش باشد، اما **هر قطعه کار** باید دقیقاً مشخص کند نقش اصلی آن چیست. نقش‌ها **حقوق و خروجی** دارند، نه فقط عنوان. AI Agent باید قبل از تغییر کد، نقش فعال را از کاربر بگیرد یا از برچسب PR/Issue استنبط کند و **از مخلوط کردن تصمیم محصول با پیاده‌سازی** در یک مرحله پرهیز کند. **میزبان استاندارد** مستندات و اسکریپت‌های عملیاتی: **Ubuntu 22.04 یا 24.04 LTS**.

---

## Machine-readable contract (English — for AI agents)

```yaml
doc_id: 00-GOVERNANCE-ROLES
version: 1.0.0
audience: [human-founder, ai-coding-agent, ai-review-agent]
host_docs_baseline_os: ubuntu-22.04-or-24.04-lts
rules:
  - id: single-primary-role
    statement: >
      Every PR, branch, or task MUST declare exactly one PRIMARY_ROLE
      from the enum below. Secondary roles may be listed but must not
      expand scope beyond the primary role's deliverable.
  - id: no-mixed-signoff
    statement: >
      A PR that changes product scope (Product) AND database schema (Backend)
      without an explicit ADR or PR split is INVALID unless labeled EXCEPTION
      with human approval in the PR body.
  - id: doc-ownership
    statement: >
      Each numbered markdown doc has a DOCUMENT_OWNER_ROLE. Changes to that
      doc should be reviewed with that role's lens (can be the same human).
primary_role_enum:
  - PRODUCT        # scope, PRD, acceptance criteria, prioritization
  - UX_CONTENT     # copy, RTL UX notes, empty states, tone
  - ENGINEERING    # implementation, refactors, tests, APIs
  - AI_ML          # prompts, RAG, eval, model routing, Langfuse
  - SECURITY       # threat model, secrets, RLS review, widget CSP
  - DEVOPS         # CI/CD, runbooks, infra, SLO, backups
  - GTM_MARKETING  # pricing page copy, ICP, campaigns (not app logic)
  - LEGAL_COMPLIANCE # privacy text, DPA checklist, retention policy text
  - SUPPORT_CS     # help macros, SLA to customers, refund process
document_owner_role_map:
  "01-PRD.md": PRODUCT
  "02-ARCHITECTURE.md": ENGINEERING
  "03-TECH-STACK.md": ENGINEERING
  "04-DATABASE-SCHEMA.md": ENGINEERING
  "05-API-SPEC.md": ENGINEERING
  "06-AI-ARCHITECTURE.md": AI_ML
  "07-PROJECT-STRUCTURE.md": ENGINEERING
  "08-ROADMAP.md": PRODUCT
  "09-AI-AGENT-GUIDE.md": ENGINEERING
  "10-GTM-PRICING-MARKETING.md": GTM_MARKETING
  "11-SECURITY-PRIVACY.md": SECURITY
  "12-OPERATIONS-SUPPORT.md": DEVOPS
  "13-ARCHITECTURE-DECISION-RECORDS.md": ENGINEERING
  "14-INFRASTRUCTURE.md": DEVOPS
  "15-DEVELOPMENT-GUIDE-FA.md": ENGINEERING
  "16-DEVELOPMENT-STATUS.md": ENGINEERING
  "00-GOVERNANCE-ROLES.md": PRODUCT
role_deliverables:
  PRODUCT:
    outputs: [PRD updates, user stories, prioritization, MVP scope labels]
    must_not: [change production secrets, deploy infra]
  ENGINEERING:
    outputs: [code, tests, migrations, API implementation]
    must_not: [unilateral pricing changes, legal commitments in UI]
  AI_ML:
    outputs: [pipelines, prompts, eval sets, cost dashboards spec]
    must_not: [bypass safety filters without SECURITY review]
  GTM_MARKETING:
    outputs: [landing copy, plan matrix, SEO list]
    must_not: [alter auth flows for tracking without SECURITY review]
```

---

## نقش‌ها و تعریف خروجی (جدول مرجع)

| نقش | سوال اصلی که جواب می‌دهد | خروجی قابل تحویل در ریپو |
|-----|---------------------------|---------------------------|
| **Product** | *چه چیزی بسازیم و چه چیزی نه؟* | PRD، Roadmap، برچسب MVP/Phase2، AC |
| **UX / Content** | *کاربر چه می‌بیند و چه می‌خواند؟* | متن UI، الگوهای RTL، onboarding کپی |
| **Engineering** | *چطور درست و تست‌شده پیاده کنیم؟* | کد، تست، OpenAPI هم‌تراز، migration |
| **AI / ML** | *مدل و داده چطور جواب امن بدهند؟* | pipeline، eval، prompt نسخه‌دار |
| **Security** | *چه چیزی نباید لو برود؟* | threat model، RLS review، ویجت CSP |
| **DevOps** | *چطور پایدار استقرار و بازیابی کنیم؟* | CI، runbook، backup، SLO |
| **GTM / Marketing** | *چطور دیده شویم و بفروشیم؟* | pricing، ICP، کانال اکتساب |
| **Legal / Compliance** | *حدود قانونی چیست؟* | چک‌لیست قرارداد، retention متن |
| **Support / CS** | *بعد از فروش چه تجربه‌ای است؟* | FAQ، macro، SLA پاسخ به مشتری |

---

## قواعد همکاری انسان + AI

1. **یک PR = یک نقش اصلی.** اگر دو نقش لازم است، PR را بشکنید یا ADR بزنید.
2. **برچسب در بدنه PR:** `PRIMARY_ROLE: ENGINEERING` (یا مقدار معتبر دیگر از enum).
3. **سند زنده:** تغییر معماری مهم → ابتدا یا همزمان با `docs/adr/ADR-*.md`.
4. **زبان سند:** فایل‌های `.md` مرجع کاننیکال برای AI و مهندس؛ `.html` نمای انسانی فارسی — اگر تناقض باشد، **md برنده است** مگر اینکه PR صریح خلاف آن بنویسد.

---

## مرجع‌های مرتبط

- [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md) — اجرای عملیاتی قواعد برای Agent
- [`13-ARCHITECTURE-DECISION-RECORDS.md`](./13-ARCHITECTURE-DECISION-RECORDS.md) — ثبت تصمیم‌های مرزی
- [`08-ROADMAP.md`](./08-ROADMAP.md) — اولویت‌بندی با برچسب نقش/فاز
