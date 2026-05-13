# 🗺️ Roadmap & Execution Plan — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** Product — همسو با [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md)

---

## برچسب‌های فاز (الزامی برای هر آیتم)

| برچسب | معنی |
|--------|------|
| **MVP** | باید در ۹۰ روز اول برسد (ریسک حذف فقط با تصمیم Product صریح) |
| **Phase 2** | بعد از درآمد / validation؛ در کد optional یا feature flag |
| **North Star** | چشم‌انداز ۱۲–۲۴ ماه؛ مستند اما بدون تعهد زمانی MVP |

---

## Machine-readable summary (English — for AI)

```yaml
roadmap_id: 08-ROADMAP
horizon_days_mvp: 90
execution_model: solo_founder_plus_ai_agents
principle: vertical_slice_first
baseline_os: ubuntu_22.04_or_24.04_lts
mvp_definition_of_done:
  - one_workspace_end_to_end
  - widget_loads_and_sends_message
  - agent_inbox_receives_and_replies
  - ai_auto_reply_with_kb_minimal
  - billing_one_paid_plan_zarinpal
```

---

## فاز ۰ (هفته ۰–۲) — زیرساخت انسانیِ توسعه

| آیتم | نقش اصلی | MVP |
|------|-----------|-----|
| تکمیل مستندات ۰۰–۱۳ + ADR اولیه | Product / Eng | MVP |
| اسکلت monorepo طبق `07-PROJECT-STRUCTURE` | Engineering | MVP |
| CI پایه (lint, typecheck, unit smoke) | DevOps | MVP |
| محیط dev یکپارچه (docker-compose حداقلی) | DevOps | MVP |
| هم‌راستایی میزکار با **Ubuntu 22.04/24.04 LTS** (طبق سند ۱۵) | DevOps | MVP |

---

## فاز ۱ (هفته ۳–۶) — برش عمودی چت

| آیتم | نقش اصلی | MVP |
|------|-----------|-----|
| Auth + Workspace + invite | Engineering | MVP |
| WebSocket/Socket.io room per conversation | Engineering | MVP |
| Widget vanilla TS: ارسال/دریافت پیام | Engineering | MVP |
| Inbox dashboard: لیست مکالمه + اتصال realtime | Engineering / UX | MVP |
| پیام متنی + typing indicator | Engineering | MVP |
| ذخیرهٔ پیام در Postgres + RLS اولیه | Engineering | MVP |

---

## فاز ۲ (هفته ۷–۱۰) — AI حداقلی قابل فروش

| آیتم | نقش اصلی | MVP |
|------|-----------|-----|
| Knowledge Base: آپلود متن + chunk | AI_ML / Engineering | MVP |
| RAG + پاسخ خودکار با سقف confidence | AI_ML | MVP |
| Escalation به اپراتور + علامت‌گذاری | Product / AI_ML | MVP |
| Copilot پیشنهاد پاسخ (نسخه ساده) | AI_ML | MVP |
| Langfuse trace حداقلی | AI_ML / DevOps | MVP |

---

## فاز ۳ (هفته ۱۱–۱۳) — پول و پایداری

| آیتم | نقش اصلی | MVP |
|------|-----------|-----|
| زرین‌پال + ۲ پلن + فاکتور ساده | Engineering / GTM | MVP |
| Rate limit ویجت + abuse پایه | Security / Engineering | MVP |
| بکاپ DB زمان‌بندی‌شده + runbook بازیابی | DevOps | MVP |
| Sentry + لاگ همبسته (correlation id) | DevOps / Engineering | MVP |

---

## موارد عمداً به فاز ۲ منتقل شده (کاهش ریسک solo)

| آیتم | نقش | فاز |
|------|-----|-----|
| جدا کردن همه microservice‌ها از روز اول | Engineering | Phase 2 |
| اپ موبایل React Native | Engineering | Phase 2 |
| Kafka/Redpanda در مسیر حیاتی MVP | DevOps | Phase 2 |
| Elasticsearch / Qdrant | Engineering | Phase 2 |
| کانال واتساپ رسمی | Product / Engineering | North Star |

---

## وابستگی بین فازها (خلاصه)

```text
[فاز ۰ Repo + CI] → [فاز ۱ Realtime Chat] → [فاز ۲ AI+RAG] → [فاز ۳ Billing+SRE]
```

---

## معیارهای موفقیت MVP (قابل اندازه‌گیری)

- **TTV:** workspace جدید تا اولین پیام زنده &lt; ۶۰ دقیقه (خودسرویس).
- **قابلیت اطمینان:** uptime هدف داخلی MVP ≥ ۹۹٪ (بدون SLA عمومی سخت در روز اول).
- **AI:** حداقل ۴۰٪ سؤالات سطح FAQ بدون اپراتور (قابل سنجش در dashboard داخلی).

---

## مرجع‌های مرتبط

- [`01-PRD.md`](./01-PRD.md) — محدوده محصول
- [`07-PROJECT-STRUCTURE.md`](./07-PROJECT-STRUCTURE.md) — چیدمان کد
- [`09-AI-AGENT-GUIDE.md`](./09-AI-AGENT-GUIDE.md) — نحوه اجرا با Agent
