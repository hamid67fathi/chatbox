# راهنمای اجرا و تست ChatBox

> **IP سرور:** `192.168.1.8` (تغییر دهید اگر متفاوت است)

---

## ۱. پیش‌نیازها (یک‌بار)

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

## ۳. تنظیم env فایل‌ها (یک‌بار)

```bash
# API — فایل .env در root (اگر نیست از example کپی کن)
cp ~/chat-box/.env.example ~/chat-box/.env

# AI Service
cp ~/chat-box/apps/ai-service/.env.example ~/chat-box/apps/ai-service/.env

# Dashboard — مهم! بدون این داشبورد کار نمی‌کنه
cat > ~/chat-box/apps/dashboard/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://192.168.1.8:3001
NEXT_PUBLIC_WORKSPACE_ID=c084d4e7-7770-4bfa-bdbd-806b963e9e77
EOF
```

> **توجه:** `NEXT_PUBLIC_WORKSPACE_ID` همان ID ایجاد شده از `db:seed` است.
> اگر seed جدید زدید، ID جدید را از خروجی seed بخوانید و جایگزین کنید.

---

## ۴. تنظیم AI Service (یک‌بار)

```bash
cd ~/chat-box/apps/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## ۵. بروزرسانی (بعد از هر push)

```bash
cd ~/chat-box
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter api db:push
```

---

## ۶. اجرای سرویس‌ها

> **چیت‌شیت کوتاه (فقط دستور هر ترمینال):** [`RUN-TERMINALS-FA.md`](./RUN-TERMINALS-FA.md)

> هر سرویس در یک ترمینال جداگانه اجرا کنید (۳ ترمینال SSH)

### ترمینال ۱ — API (پورت 3001)
```bash
cd ~/chat-box && pnpm --filter api dev
```
باید ببینید: `Server listening at http://0.0.0.0:3001`

### ترمینال ۲ — AI Service (پورت 8000)
```bash
cd ~/chat-box/apps/ai-service && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000
```
باید ببینید: `Uvicorn running on http://0.0.0.0:8000`

### ترمینال ۳ — Dashboard (پورت 3000)
```bash
cd ~/chat-box && pnpm --filter dashboard dev
```
باید ببینید: `Ready in ...ms`

### (اختیاری) ترمینال ۴ — Observability
```bash
cd ~/chat-box && docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

---

## ۷. آدرس‌های تست (مرورگر)

> **ترتیب پیشنهادی تست:**

### ابتدا سلامت سرویس‌ها:
1. http://192.168.1.8:3001/health — باید `{"ok":true,"db":true}` بدهد
2. http://192.168.1.8:8000/health — باید `{"status":"ok"}` بدهد

### صفحات اصلی:
3. **http://192.168.1.8:3001/chat.html** — صفحه چت تست (پیام بفرستید!)
4. **http://192.168.1.8:3000** — داشبورد مدیریت مکالمات

### صفحات دیگر:
5. http://192.168.1.8:3001/v1/billing/plans — لیست پلن‌ها و قیمت‌ها
6. http://192.168.1.8:3001/widget-demo/demo.html — دمو ویجت embed

### مانیتورینگ (اختیاری — فقط اگر مرحله ۴ اختیاری اجرا شده):
7. http://192.168.1.8:9090 — Prometheus
8. http://192.168.1.8:3333 — Grafana (ورود: admin / admin)

---

## ۸. تست سریع با curl

```bash
# سلامت API
curl -s http://192.168.1.8:3001/health | jq .

# سلامت AI
curl -s http://192.168.1.8:8000/health | jq .

# --- احراز هویت (P4) ---

# ثبت‌نام کاربر جدید
curl -s -X POST http://192.168.1.8:3001/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","fullName":"کاربر تست"}' | jq .

# ورود با حساب seed (توکن واقعی — YOUR_TOKEN ننویسید!)
TOKEN=$(curl -s -X POST http://192.168.1.8:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chatbox.local","password":"chatbox123"}' | jq -r '.access_token')
echo "TOKEN=$TOKEN"

WS_ID=$(curl -s http://192.168.1.8:3001/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq -r '.user.workspaces[0].id')
echo "WORKSPACE=$WS_ID"

# یا اسکript کامل:
# bash scripts/diag-inbox.sh

# دریافت اطلاعات کاربر
curl -s http://192.168.1.8:3001/v1/auth/me \
  -H "Authorization: Bearer {ACCESS_TOKEN}" | jq .

# رفرش توکن
curl -s -X POST http://192.168.1.8:3001/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"{REFRESH_TOKEN}"}' | jq .

# --- API‌های محافظت‌شده (نیاز به Bearer token) ---

# لیست پلن‌ها (بدون auth — عمومی)
curl -s http://192.168.1.8:3001/v1/billing/plans | jq .

# ساخت session ویجت (بدون auth — عمومی)
curl -s -X POST http://192.168.1.8:3001/widget/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"workspace_slug":"demo"}' | jq .
# ← visitor token را ذخیره کنید

# لیست مکالمات (نیاز به auth)
curl -s http://192.168.1.8:3001/v1/conversations?limit=50 \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "X-Workspace-Id: {WORKSPACE_ID}" | jq .

# ارسال پیام (نیاز به auth)
curl -s -X POST http://192.168.1.8:3001/v1/conversations/{CONV_ID}/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "X-Workspace-Id: {WORKSPACE_ID}" \
  -d '{"body":"سلام","sender_type":"agent"}' | jq .
```

---

## ۹. تست‌های خودکار

```bash
cd ~/chat-box
pnpm --filter api test
```

---

## ۱۰. خلاصه پورت‌ها

| پورت | سرویس | وضعیت |
|-------|--------|--------|
| 3000 | Dashboard (Next.js) | اجباری |
| 3001 | API (Fastify) | اجباری |
| 5432 | PostgreSQL (Docker) | اجباری |
| 6379 | Redis (Docker) | اجباری |
| 8000 | AI Service (FastAPI) | اجباری |
| 3100 | Loki | اختیاری |
| 3333 | Grafana | اختیاری |
| 9090 | Prometheus | اختیاری |

---

## ۱۱. عیب‌یابی

| مشکل | راه‌حل |
|-------|--------|
| `refused to connect` روی 3001 | API بالا نیست → ترمینال ۱ را چک کنید |
| `refused to connect` روی 3000 | Dashboard بالا نیست → ترمینال ۳ را چک کنید |
| `refused to connect` روی 8000 | AI Service بالا نیست → ترمینال ۲ را چک کنید |
| `NEXT_PUBLIC_WORKSPACE_ID تنظیم نشده` | فایل `.env.local` داشبورد را بسازید (مرحله ۳) |
| `type "vector" does not exist` | `docker compose down -v && docker compose up -d` بعد `db:push` |
| `fastify-plugin expected '5.x'` | `git pull` → نسخه‌های سازگار نصب شده |
| داشبورد مکالمه نشان نمی‌دهد | `NEXT_PUBLIC_API_URL` باید IP سرور باشد نه `localhost` |
| `401 Authentication required` | باید اول login کنید — در داشبورد به `/login` بروید |
| اطلاعات ورود seed | ایمیل: `admin@chatbox.local` — رمز: `chatbox123` |
