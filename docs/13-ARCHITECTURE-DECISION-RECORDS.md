# 📝 Architecture Decision Records (ADR) — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** Engineering

---

## چرا ADR؟

تصمیم‌های معماری که **به‌سادگی برگردانده نمی‌شوند** (زبان runtime، message bus، ORM،…) باید در قالب یک فایل کوتاه، تاریخ‌دار و قابل جستجو ثبت شوند تا AI و انسان بعداً بدانند **چرا** این انتخاب شده است.

---

## English — ADR policy (machine-readable)

```yaml
adr_policy:
  location: docs/adr/
  filename_pattern: "ADR-{number:05d}-{slug}.md"
  required_when:
    - new_microservice_boundary
    - new_external_data_processor
    - breaking_api_change
    - security_model_change
  lifecycle: accepted | superseded | deprecated
  link_from_pr: true
```

---

## قالب فایل ADR (کپی کنید برای ADR جدید)

```markdown
# ADR-XXXX: عنوان کوتاه تصمیم

## وضعیت

پیشنهادی | پذیرفته‌شده | جایگزین‌شده توسط ADR-YYYY

## زمینه

مشکل چیست؟

## تصمیم

چه انتخابی کردیم؟

## گزینه‌ها

- گزینه A — مزایا / معایب
- گزینه B — مزایا / معایب

## پیامدها

مثبت، منفی، risks

## پیوندها

PR، issues، اسناد مرتبط
```

---

## فهرست ADRها

| شماره | عنوان | وضعیت |
|--------|--------|--------|
| [00001](./adr/ADR-00001-use-adrs-for-significant-decisions.md) | استفاده از ADR برای تصمیم‌های مهم | پذیرفته‌شده |

---

## مرجع‌های مرتبط

- [`00-GOVERNANCE-ROLES.md`](./00-GOVERNANCE-ROLES.md)  
- [`02-ARCHITECTURE.md`](./02-ARCHITECTURE.md)  
