# 🔐 Security & Privacy — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** Security (+ Engineering برای اجرا)

---

## خلاصهٔ تهدیدمدل (فارسی)

سطح حمله: **ویجت عمومی** (قابل تزریق در سایت‌های ناشناس)، **داشبورد اپراتور** (نشست طولانی)، **APIهای LLM خارجی** (نشت دادهٔ حساس)، **چندمستأجری** (عبور داده بین workspaceها). کنترل‌ها: RLS در Postgres، rate limit روی ویجت و API عمومی، حداقل‌سازی PII به سرویس LLM، audit log برای اقدامات ادمین.

---

## Machine-readable (English)

```yaml
security_doc_id: 11-SECURITY-PRIVACY
stride_focus:
  - Spoofing: session_fixation_mitigations_lucia_patterns
  - Tampering: signed_widget_config_optional_future
  - Repudiation: audit_log_admin_actions
  - Information_disclosure: rls_workspace_id_all_tenant_tables
  - Denial_of_service: rate_limits_per_ip_and_per_widget_key
  - Elevation_of_privilege: rbac_admin_agent_viewer
data_residency:
  primary: iran
  dr: eu_hetzner_example
  llm_providers: external_review_each_subprocessor
widget_security:
  - csp_guideline_for_customer_site_documented
  - postmessage_origin_allowlist
pii_to_llm:
  default: redact_before_external_inference
  exception_requires: security_ticket_and_adr_reference
```

---

## چک‌لیست MVP (اجرایی)

- [ ] RLS فعال روی جداول حساس + تست خودکار cross-tenant  
- [ ] Rate limit: `/widget/*` و `/api/public/*`  
- [ ] Secretها فقط از vault/env سرور — هرگز در ریپو  
- [ ] `SameSite` + `HttpOnly` برای کوکی نشست داشبورد  
- [ ] Security headers پایه (در gateway یا framework)  
- [ ] سیاست نگهداری پیام و حذف/خروجی داده (متن حقوقی با Legal)  

---

## حریم خصوصی (Outline برای متن حقوقی)

1. چه داده‌ای جمع می‌شود (مکالمه، متادیتا، IP، فایل).  
2. هدف پردازش (ارائهٔ سرویس، بهبود AI با **opt-in** آموزش).  
3. اشخاص ثالث (LLM، میزبان، درگاه).  
4. حق کاربر (دسترسی، حذف، شکایت).  
5. مدت نگهداری (هم‌تراز `04-DATABASE-SCHEMA.md` بخش retention).

---

## واکنش به حادثه (خلاصه)

1. تشخیص (alert / گزارش کاربر)  
2. مهار (غیرفعال کردن کلید API در معرض / block IP)  
3. ارزیابی دامنهٔ نشت  
4. اطلاع‌رسانی طبق تعهدات قراردادی  
5. postmortem داخلی + ADR در صورت تغییر معماری  

جزئیات کامل در [`12-OPERATIONS-SUPPORT.md`](./12-OPERATIONS-SUPPORT.md).

---

## مرجع‌های مرتبط

- [`02-ARCHITECTURE.md`](./02-ARCHITECTURE.md) — مرز شبکه  
- [`05-API-SPEC.md`](./05-API-SPEC.md) — rate limit و auth  
- [`06-AI-ARCHITECTURE.md`](./06-AI-ARCHITECTURE.md) — فیلتر PII و safety  
