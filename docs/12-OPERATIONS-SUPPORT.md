# 🛠️ Operations, SRE & Customer Support — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** DevOps (+ Support برای بخش مشتری)

---

## خلاصه (فارسی)

این سند **چگونگی نگه‌داشتن سرویس زنده** و **چگونگی پاسخ به مشتری** را مشخص می‌کند: SLO داخلی، بکاپ، بازیابی، و ماکروهای پشتیبانی. با [`11-SECURITY-PRIVACY.md`](./11-SECURITY-PRIVACY.md) برای حادثهٔ امنیتی هم‌پوشانی دارد.

---

## Machine-readable (English)

```yaml
operations_doc_id: 12-OPERATIONS-SUPPORT
slo_mvp_internal:
  api_availability_target: "99.0%"
  p95_rest_read_ms: 300
  note: separate_ws_and_ai_slo_from_product_marketing_numbers
backup:
  postgres: daily_logical_plus_wal_policy_tbd
  clickhouse_when_adopted: weekly
  restore_drill: monthly
on_call_mvp:
  model: founder_led_no_pagerduty_required
  escalation: phone_list_in_runbook_private_repo
customer_support:
  channels: [email, in_app_ticket_future]
  first_response_sla_hours_business: 24
  macros_versioned: support/macros/ # path TBD when repo exists
```

---

## Runbook — قطع PostgreSQL (مثال)

1. بررسی health از LB و Grafana.  
2. اگر single-primary down: failover به replica (در صورت وجود) طبق playbook میزبان.  
3. اعلام statuspage داخلی / توییتر در صورت تأثیر کاربر.  
4. بعد از بازگشت: بررسی replication lag و یکپارچگی.

*(جزئیات دستورات وقتی زیرساخت قطعی شد در appendix همین سند یا wiki خصوصی اضافه شود.)*

---

## Runbook — هزینهٔ LLM غیرعادی

1. Langfuse / dashboard هزینه را باز کنید.  
2. workspace پرمصرف را شناسایی کنید.  
3. موقت: کاهش سقف `ai_credits` یا fallback به مدل ارزان‌تر (طبق `06`).  
4. ریشه‌یابی: حلقهٔ retry؟ prompt injection طولانی؟  

---

## پشتیبانی مشتری (Support)

| نوع درخواست | اولویت | مسیر |
|-------------|--------|------|
| ویجت لود نمی‌شود | P1 | چک CDN، کلید ویجت، CSP سایت مشتری |
| پرداخت ناموفق | P1 | لاگ زرین‌پال، وضعیت subscription |
| سؤال «چطور AI آموزش بدهم؟» | P2 | لینک به docs + ویدیو آینده |

---

## مرجع‌های مرتبط

- [`03-TECH-STACK.md`](./03-TECH-STACK.md) — ابزار observability  
- [`08-ROADMAP.md`](./08-ROADMAP.md) — زمانی که SRE رسمی می‌شود  
- [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md) — سرور، شبکه، کانفیگ و GitOps
