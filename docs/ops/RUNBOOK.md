# Runbook — ChatBox عملیات

> **نسخه:** 1.0 · مه 2026  
> **مالک:** DevOps / SRE

---

## ۱. بکاپ‌گیری (Backup Schedule)

### PostgreSQL

| آیتم | مقدار |
|------|-------|
| ابزار | `pg_dump` (logical) + WAL archiving (تولید) |
| فرکانس | هر ۶ ساعت (cron) |
| نگهداری | ۷ روز محلی، ۳۰ روز S3/MinIO |
| فشرده‌سازی | `gzip` |

```bash
# نمونه cron: هر ۶ ساعت
0 */6 * * * pg_dump -Fc -U chatbox chatbox | gzip > /backups/pg/chatbox_$(date +\%Y\%m\%d_\%H\%M).dump.gz
```

### Redis

| آیتم | مقدار |
|------|-------|
| مکانیزم | AOF (appendonly yes) + RDB snapshot |
| فرکانس RDB | هر ۱ ساعت |
| مسیر | `/data/dump.rdb` (داخل volume) |

```bash
# بکاپ دستی Redis
docker exec chatbox-redis redis-cli BGSAVE
docker cp chatbox-redis:/data/dump.rdb /backups/redis/
```

### AI Service Embeddings

- بکاپ embedding‌ها نیازی نیست — از kb_chunks در Postgres بازسازی می‌شوند.
- بکاپ مدل‌های محلی (اگر وجود دارد) در `/opt/ai-models/`.

---

## ۲. بازیابی (Restore Drill Checklist)

### پیش‌نیاز
- [ ] دسترسی SSH به سرور
- [ ] فایل بکاپ Postgres (`.dump.gz`)
- [ ] Docker Compose در حال اجرا

### مراحل بازیابی PostgreSQL

```bash
# ۱. توقف API
pm2 stop api || systemctl stop chatbox-api

# ۲. بازیابی
gunzip -c /backups/pg/chatbox_YYYYMMDD_HHMM.dump.gz | pg_restore -U chatbox -d chatbox --clean --if-exists

# ۳. اعمال migration‌های احتمالی جدید
cd ~/chat-box && pnpm --filter api db:push

# ۴. راه‌اندازی مجدد
pm2 start api || systemctl start chatbox-api

# ۵. تأیید
curl -s http://localhost:3001/health | jq .
```

### مراحل بازیابی Redis

```bash
# ۱. توقف Redis
docker compose stop redis

# ۲. جایگزینی dump
docker cp /backups/redis/dump.rdb chatbox-redis:/data/dump.rdb

# ۳. راه‌اندازی مجدد
docker compose start redis
```

### چک‌لیست تأیید بازیابی
- [ ] `GET /health` → `{"ok":true,"db":true}`
- [ ] آخرین مکالمه در dashboard قابل مشاهده است
- [ ] ویجت پیام جدید ارسال می‌کند
- [ ] Socket.IO متصل می‌شود
- [ ] AI Service → `GET /health` → `{"status":"ok"}`

---

## ۳. جدول متغیرهای محیطی (Production)

| متغیر | سرویس | مقدار نمونه | اجباری | توضیح |
|--------|--------|-------------|--------|-------|
| `DATABASE_URL` | API | `postgres://chatbox:***@localhost:5432/chatbox` | بله | Connection string پایگاه داده |
| `REDIS_URL` | API | `redis://localhost:6379` | بله | Connection string ردیس |
| `PORT` | API | `3001` | خیر | پورت HTTP سرور (پیش‌فرض 3001) |
| `NODE_ENV` | API | `production` | بله | محیط اجرا |
| `AI_SERVICE_URL` | API | `http://localhost:8000` | خیر | آدرس سرویس AI |
| `AI_TIMEOUT_MS` | API | `10000` | خیر | تایم‌اوت درخواست AI (میلی‌ثانیه) |
| `ZARINPAL_MERCHANT_ID` | API | `xxxxxxxx-xxxx-...` | خیر | شناسه مرچنت زرین‌پال (sandbox اگر خالی) |
| `ZARINPAL_CALLBACK_URL` | API | `https://app.example.com/v1/billing/verify` | خیر | URL بازگشت پرداخت |
| `OPENAI_API_KEY` | AI Service | `sk-...` | خیر | کلید OpenAI (stub mode اگر خالی) |
| `AI_MODE` | AI Service | `stub` / `openai` | خیر | حالت AI (پیش‌فرض stub) |
| `EMBEDDING_MODEL` | AI Service | `text-embedding-3-small` | خیر | مدل embedding |
| `LLM_MODEL` | AI Service | `gpt-4o-mini` | خیر | مدل LLM |
| `NEXT_PUBLIC_API_URL` | Dashboard | `https://api.example.com` | بله | آدرس API برای فرانت‌اند |

---

## ۴. مانیتورینگ سریع (بدون observability stack)

```bash
# وضعیت سرویس‌ها
docker compose ps
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:8000/health | jq .

# لاگ‌ها
docker compose logs --tail=50 postgres
docker compose logs --tail=50 redis
pm2 logs api --lines 50

# بار سیستم
htop
df -h
free -m
```

---

## ۵. روتین‌های نگهداری

| فرکانس | عملیات | دستور |
|---------|--------|-------|
| روزانه | بررسی لاگ خطاها | `pm2 logs api --err --lines 100` |
| هفتگی | پاکسازی بکاپ‌های قدیمی | `find /backups -mtime +30 -delete` |
| هفتگی | بررسی فضای دیسک | `df -h` |
| ماهانه | تست بازیابی | بخش ۲ این سند |
| ماهانه | بروزرسانی وابستگی‌ها | `pnpm update` + تست |

---

**پایان سند.**
