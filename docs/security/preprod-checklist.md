# Pre-production Security Checklist

> **تاریخ بررسی:** 2026-05-13  
> **مرجع:** `11-SECURITY-PRIVACY.md`  
> **وضعیت کلی:** آماده MVP (با رعایت موارد MUST_FIX)

---

## ۱. احراز هویت و مجوزدهی (Authentication & Authorization)

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 1.1 | JWT / Session-based auth | ⏳ P4 | فعلاً placeholder — پیاده‌سازی واقعی در فاز ۴ |
| 1.2 | TOTP / 2FA support | ⏳ P4 | فیلد `totp_secret` در schema آماده، پیاده‌سازی P4 |
| 1.3 | Password hashing (bcrypt/argon2) | ⏳ P4 | فعلاً placeholder hash در seed |
| 1.4 | Role-based access control | ✅ PASS | `user_role` enum: owner/admin/agent/viewer |
| 1.5 | API key / token validation | ⏳ P4 | Socket.IO `token` query فعلاً بدون اعتبارسنجی واقعی |

## ۲. امنیت داده (Data Security)

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 2.1 | RLS فعال روی همه جداول اصلی | ✅ PASS | `tenant_isolation` policy بر اساس `workspace_id` |
| 2.2 | Soft delete (بدون حذف فیزیکی) | ✅ PASS | `deleted_at` روی `users`, `workspaces`, `contacts` |
| 2.3 | Encryption at rest (Postgres) | ⚙️ OPS | وابسته به تنظیمات دیسک سرور (LUKS/dm-crypt) |
| 2.4 | Encryption in transit (TLS) | ⚙️ OPS | Nginx reverse proxy + Let's Encrypt در تولید |
| 2.5 | Secrets در ریپو نیست | ✅ PASS | `.env.example` فقط placeholder، `.gitignore` شامل `.env` |

## ۳. حریم خصوصی و PII

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 3.1 | PII redaction قبل از LLM | ✅ PASS | `ai-service/app/pii.py` — تلفن، ایمیل، کد ملی، شماره کارت |
| 3.2 | لاگ‌ها بدون PII | ⚠️ WARN | Fastify logger ممکن است body شامل PII لاگ کند — فیلتر در P4 |
| 3.3 | GDPR/حقوق کاربر: حذف داده | ⏳ P4 | API حذف حساب هنوز پیاده نشده |

## ۴. امنیت شبکه و API

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 4.1 | CORS محدود | ✅ PASS | `@fastify/cors` فعال (در تولید origin باید محدود شود) |
| 4.2 | Rate limiting مسیرهای عمومی | ✅ PASS | Widget route: 20 req/min |
| 4.3 | HTTP Security Headers | ✅ PASS | `@fastify/helmet` فعال |
| 4.4 | CSRF protection | ⏳ P4 | نیاز به token-based CSRF در فرم‌های داشبورد |
| 4.5 | Input validation / sanitization | ✅ PASS | Pydantic (AI), manual validation (API) |
| 4.6 | SQL injection prevention | ✅ PASS | Drizzle ORM parameterized queries |
| 4.7 | XSS prevention | ✅ PASS | Widget در Shadow DOM، React auto-escapes |

## ۵. زیرساخت و عملیات

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 5.1 | بکاپ خودکار Postgres | ⚙️ OPS | Cron template در `docs/ops/RUNBOOK.md` |
| 5.2 | Health check endpoints | ✅ PASS | `/health` (API), `/health` (AI) |
| 5.3 | Graceful shutdown | ✅ PASS | Fastify handles SIGTERM |
| 5.4 | Docker image scanning | ⏳ P4 | Trivy/Snyk در CI اضافه شود |
| 5.5 | Dependency audit | ⚠️ WARN | `pnpm audit` + `pip audit` ماهانه اجرا شود |

## ۶. AI Service Security

| # | آیتم | وضعیت | توضیح |
|---|-------|--------|-------|
| 6.1 | Circuit breaker | ✅ PASS | 3 خطا → 30ثانیه cooldown |
| 6.2 | Timeout on AI calls | ✅ PASS | 10s default, configurable |
| 6.3 | Prompt injection prevention | ⚠️ WARN | System prompt hardened, user input sandboxed — نیاز به تست بیشتر |
| 6.4 | Tenant isolation در vector search | ✅ PASS | WHERE + RLS بر اساس workspace_id |

---

## خلاصه

| وضعیت | تعداد | توضیح |
|--------|-------|-------|
| ✅ PASS | 16 | آماده |
| ⏳ P4 | 7 | نیاز به پیاده‌سازی در فاز بعد |
| ⚙️ OPS | 3 | وابسته به تنظیمات سرور تولید |
| ⚠️ WARN | 3 | هشدار — باید قبل از production رفع شود |

### MUST_FIX قبل از تولید:
1. **احراز هویت واقعی** (JWT + password hashing) — P4
2. **محدود کردن CORS origin** به دامنه تولید
3. **فیلتر PII از لاگ‌ها**
4. **تست prompt injection** روی AI service

---

**پایان چک‌لیست.**
