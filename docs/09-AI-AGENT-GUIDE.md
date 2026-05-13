# 🤖 AI Agent Execution Guide — Chat-Box

> **نسخه:** 1.1 · مه 2026  
> **Audience:** Coding agents (Cursor, Claude, GPT, etc.) + human reviewer  
> **Primary role owner (doc):** Engineering

---

## Mandatory first reads (order)

1. [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md) — role contract + YAML enum  
2. [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md) — وضعیت مراحل `P…` در `roadmap_machine.md` (قبل از شروع کار، اینجا را بخوانید)  
3. [`08-ROADMAP.md`](./08-ROADMAP.md) — what is MVP vs Phase 2  
4. Task-specific: `05-API-SPEC.md` / `04-DATABASE-SCHEMA.md` / `06-AI-ARCHITECTURE.md` as applicable  

**Canonical spec language:** Markdown (`.md`) in `/docs`. HTML is a human view; on conflict, follow `.md` unless PR states otherwise.

---

## English — operational rules (machine-oriented)

```yaml
agent_rules:
  before_coding:
    - Confirm PRIMARY_ROLE for this task (ask human if missing).
    - Refuse to mix PRODUCT scope changes with ENGINEERING implementation in one PR unless EXCEPTION approved.
    - Assume shell commands target Ubuntu 22.04/24.04 LTS unless the task states otherwise.
  while_coding:
    - Match repo conventions in 07-PROJECT-STRUCTURE when repo exists.
    - Add or update tests for ENGINEERING tasks; add eval fixtures for AI_ML tasks.
    - Never commit secrets; use .env.example only.
  documentation:
    - Architecture-impacting decisions require a new file under docs/adr/ (see 13).
    - Update MD first; regenerate paired HTML with: python docs/scripts/build_doc_html.py <STEM>
    - After starting or finishing a roadmap_machine phase (P0.x, P1.x, ...), update docs/16-DEVELOPMENT-STATUS.md in the same PR or a follow-up PR.
  rtl_and_locale:
    - All user-facing Persian strings must be RTL-safe; avoid hard-coded LTR CSS in shared components.
```

---

## قواعد ویژهٔ توسعهٔ «فقط با AI»

1. **از کاربر بخواهید نقش را صریح کند** اگر Issue/PR بدون `PRIMARY_ROLE` بود.  
2. **حداکثر اندازهٔ PR:** ترجیحاً &lt; ۴۰۰ خط net تغییر؛ اگر بیشتر شد، در توضیح PR دلیل تجمیع را بنویسید.  
3. **تست:** هر feature ENGINEERING باید حداقل یک تست خودکار (unit یا integration سبک) داشته باشد؛ استثنا با برچسب `TEST_DEFERRED` + دلیل + issue پیگیری.  
4. **AI safety:** تغییر در prompt یا pipeline بدون اشاره به `06-AI-ARCHITECTURE.md` و بدون فکر به PII/redaction ممنوع است.

---

## نقش ↔ مسیر خواندن سند

| اگر PRIMARY_ROLE شما… | بخوانید |
|------------------------|---------|
| ENGINEERING (backend) | 02, 04, 05, 07 |
| ENGINEERING (frontend) | 01 (AC), 05 (WS contract), 07 |
| AI_ML | 06, 04 (جداول KB/embedding), 11 (privacy) |
| SECURITY | 11, 05 (rate limits), 02 (network boundary) |
| DEVOPS | 12, 14, 03, 02 |
| PRODUCT | 01, 08, 10 |
| GTM_MARKETING | 10, 01 (personas) |

---

## قالب پیشنهادی برای توضیح PR (کپی در بدنه PR)

```markdown
PRIMARY_ROLE: ENGINEERING
RELATED_DOCS: 05-API-SPEC.md § Conversations
MVP_LABEL: MVP
TEST: vitest apps/api/...
ROLLBACK: migration down / feature flag KEY
```

---

## مرجع‌های مرتبط

- [`roadmap_machine.md`](./roadmap_machine.md) — روال فازبندی، نام Agentها، پرامپت‌های آماده
- [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md)
- [`13-ARCHITECTURE-DECISION-RECORDS.md`](./13-ARCHITECTURE-DECISION-RECORDS.md)
