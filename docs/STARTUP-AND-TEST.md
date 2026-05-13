# راهنمای اجرا و تست ChatBox

> **IP سرور:** `192.168.1.8` (تغییر دهید اگر متفاوت است)

---

## ۱. پیش‌نیازها

```bash
# Docker (Postgres + Redis)
cd ~/chat-box
docker compose up -d

# بررسی وضعیت
docker compose ps
```

---

## ۲. اولین بار (بعد از clone)

```bash
cd ~/chat-box
pnpm install --frozen-lockfile
pnpm --filter api db:push       # ساخت جداول
pnpm --filter api db:seed       # داده اولیه
```

---

## ۳. بروزرسانی (بعد از هر push)

```bash
cd ~/chat-box
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter api db:push
```

---

## ۴. اجرای سرویس‌ها (هر سرویس در یک ترمینال)

### ترمینال ۱ — API (پورت 3001)
```bash
cd ~/chat-box && pnpm --filter api dev
```

### ترمینال ۲ — AI Service (پورت 8000)
```bash
cd ~/chat-box/apps/ai-service && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### ترمینال ۳ — Dashboard (پورت 3000)
```bash
cd ~/chat-box && pnpm --filter dashboard dev
```

### (اختیاری) ترمینال ۴ — Observability (Prometheus + Grafana + Loki)
```bash
cd ~/chat-box && docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

---

## ۵. آدرس‌های تست

| سرویس | آدرس | توضیح |
|--------|-------|--------|
| صفحه چت (تست) | http://192.168.1.8:3001/chat.html | **صفحه چت کامل** — پیام بفرستید و پاسخ AI ببینید |
| API Health | http://192.168.1.8:3001/health | بررسی سلامت API و دیتابیس |
| پلن‌های قیمت | http://192.168.1.8:3001/v1/billing/plans | لیست پلن‌ها و قیمت |
| Widget Demo | http://192.168.1.8:3001/widget-demo/demo.html | دمو ویجت (embed در سایت) |
| داشبورد | http://192.168.1.8:3000 | پنل مدیریت مکالمات |
| AI Service | http://192.168.1.8:8000/health | سلامت سرویس هوش مصنوعی |
| Prometheus | http://192.168.1.8:9090 | مانیتورینگ (اختیاری) |
| Grafana | http://192.168.1.8:3333 | داشبورد مانیتورینگ (admin/admin) |

---

## ۶. تست سریع با curl

```bash
# سلامت API
curl -s http://192.168.1.8:3001/health | jq .

# سلامت AI
curl -s http://192.168.1.8:8000/health | jq .

# لیست پلن‌ها
curl -s http://192.168.1.8:3001/v1/billing/plans | jq .

# ساخت session ویجت
curl -s -X POST http://192.168.1.8:3001/widget/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"workspace_slug":"demo"}' | jq .

# ارسال پیام
curl -s -X POST http://192.168.1.8:3001/v1/conversations/{CONV_ID}/messages \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: {WORKSPACE_ID}" \
  -d '{"body":"سلام","sender_type":"contact","sender_contact_id":"{CONTACT_ID}"}' | jq .

# شروع پرداخت (sandbox)
curl -s -X POST http://192.168.1.8:3001/v1/billing/{WORKSPACE_ID}/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan":"starter"}' | jq .
```

---

## ۷. تست‌های خودکار

```bash
cd ~/chat-box
pnpm --filter api test
```

---

## ۸. پورت‌ها

| پورت | سرویس |
|-------|--------|
| 3000 | Dashboard (Next.js) |
| 3001 | API (Fastify) |
| 3100 | Loki (اختیاری) |
| 3333 | Grafana (اختیاری) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 8000 | AI Service (FastAPI) |
| 9090 | Prometheus (اختیاری) |
