# 📚 Chat-Box — Technical & Product Documentation

> **فارسی:** نمای انسانی و فهرست فارسی در [`index.html`](./index.html). جدول نقش‌ها و قواعد در [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md).

> **English:** Markdown (`.md`) is canonical for machines and engineers; HTML (`.html`) is the Persian human view.

**Baseline OS:** development and launch paths in this repo are documented for **Ubuntu 22.04 or 24.04 LTS** (see [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md) and [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md)).

---

## Document map & role ownership

| # | Markdown (AI / source of truth) | HTML (فارسی — انسان) | Primary owner role |
|---|--------------------------------|----------------------|-------------------|
| 00 | [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md) | [`00-GOVERNANCE-ROLES.html`](./00-GOVERNANCE-ROLES.html) | Product |
| 01 | [`01-PRD.md`](./01-PRD.md) | [`01-PRD.html`](./01-PRD.html) | Product |
| 02 | [`02-ARCHITECTURE.md`](./02-ARCHITECTURE.md) | [`02-ARCHITECTURE.html`](./02-ARCHITECTURE.html) | Engineering |
| 03 | [`03-TECH-STACK.md`](./03-TECH-STACK.md) | [`03-TECH-STACK.html`](./03-TECH-STACK.html) | Engineering |
| 04 | [`04-DATABASE-SCHEMA.md`](./04-DATABASE-SCHEMA.md) | [`04-DATABASE-SCHEMA.html`](./04-DATABASE-SCHEMA.html) | Engineering |
| 05 | [`05-API-SPEC.md`](./05-API-SPEC.md) | [`05-API-SPEC.html`](./05-API-SPEC.html) | Engineering |
| 06 | [`06-AI-ARCHITECTURE.md`](./06-AI-ARCHITECTURE.md) | [`06-AI-ARCHITECTURE.html`](./06-AI-ARCHITECTURE.html) | AI / ML |
| 07 | [`07-PROJECT-STRUCTURE.md`](./07-PROJECT-STRUCTURE.md) | [`07-PROJECT-STRUCTURE.html`](./07-PROJECT-STRUCTURE.html) | Engineering |
| 08 | [`08-ROADMAP.md`](./08-ROADMAP.md) | [`08-ROADMAP.html`](./08-ROADMAP.html) | Product |
| 09 | [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md) | [`09-AI-AGENT-GUIDE.html`](./09-AI-AGENT-GUIDE.html) | Engineering |
| 10 | [`10-GTM-PRICING-MARKETING.md`](./10-GTM-PRICING-MARKETING.md) | [`10-GTM-PRICING-MARKETING.html`](./10-GTM-PRICING-MARKETING.html) | GTM / Marketing |
| 11 | [`11-SECURITY-PRIVACY.md`](./11-SECURITY-PRIVACY.md) | [`11-SECURITY-PRIVACY.html`](./11-SECURITY-PRIVACY.html) | Security |
| 12 | [`12-OPERATIONS-SUPPORT.md`](./12-OPERATIONS-SUPPORT.md) | [`12-OPERATIONS-SUPPORT.html`](./12-OPERATIONS-SUPPORT.html) | DevOps |
| 13 | [`13-ARCHITECTURE-DECISION-RECORDS.md`](./13-ARCHITECTURE-DECISION-RECORDS.md) | [`13-ARCHITECTURE-DECISION-RECORDS.html`](./13-ARCHITECTURE-DECISION-RECORDS.html) | Engineering |
| 14 | [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md) | [`14-INFRASTRUCTURE.html`](./14-INFRASTRUCTURE.html) | DevOps |
| 15 | [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md) | [`15-DEVELOPMENT-GUIDE-FA.html`](./15-DEVELOPMENT-GUIDE-FA.html) | Engineering |
| 16 | [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md) | [`16-DEVELOPMENT-STATUS.html`](./16-DEVELOPMENT-STATUS.html) | Engineering |
| ADR | [`docs/adr/`](./adr/) | — | Engineering |

**Repo (بدون شمارهٔ سند):** [`CONTRIBUTING.md`](../CONTRIBUTING.md) (ریشهٔ ریپو) · [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) · [`BRANCHING.md`](./BRANCHING.md) · [`SERVER-DEV-FIRST-INSTALL-FA.md`](./SERVER-DEV-FIRST-INSTALL-FA.md) (نصب سرور Ubuntu از صفر)

**Rule:** If Persian HTML and English-heavy MD diverge, **`.md` wins** unless a PR explicitly documents an intentional exception ([`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md)).

---

## Recommended read order

| Reader | Start here |
|--------|------------|
| **AI coding agent** | `00` → `09` → [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md) (وضعیت مراحل) → [`roadmap_machine.md`](./roadmap_machine.md) → `08` → task-specific (`04`–`07`, `05`, `06`, `14`) |
| **Human new to project** | [`index.html`](./index.html) → [`16-DEVELOPMENT-STATUS.html`](./16-DEVELOPMENT-STATUS.html) (کجای مسیر هستیم) → [`15-DEVELOPMENT-GUIDE-FA.html`](./15-DEVELOPMENT-GUIDE-FA.html) (گام‌های فنی) → `01` PRD |
| **Implementing code** | `07` + `08` + `05` + `04` + `14` (infra) |

---

## Project summary

**Product:** Chat-Box — multi-tenant SaaS, live chat + AI engagement  
**Primary market:** Iran (phase 1)  
**MVP horizon:** 90 days  
**Team model:** Solo founder + AI agents  

---

## Regenerating human HTML from Markdown

Documents **00** and **03–16** can be regenerated so the Persian `.html` stays aligned with the canonical `.md`:

```bash
pip install markdown
python docs/scripts/build_doc_html.py
```

This rebuilds **00** and **03–16** only (it does **not** overwrite **01-PRD** or **02-ARCHITECTURE** by default).

Rebuild a single stem (example):

```bash
python docs/scripts/build_doc_html.py 04-DATABASE-SCHEMA
```

To regenerate **01-PRD** or **02-ARCHITECTURE** from Markdown (overwrites hand-authored HTML), pass that stem explicitly.

---

## Status

| Field | Value |
|-------|-------|
| Version | 1.1.0 |
| Last updated | May 2026 |
| Maintainer | CTO |
| Status | Active — living documents |

Significant architecture changes must include an ADR under [`docs/adr/`](./adr/) and a PR that updates the relevant `.md` first.
