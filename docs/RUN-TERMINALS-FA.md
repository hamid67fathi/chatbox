# اجرای کامل Chat-Box — همه دستورات

> **سرور نمونه:** `192.168.1.8`  
> **مسیر پروژه:** `~/chat-box`  
> هر بخش «ترمینال N» = یک SSH session جدا (یا pane در `tmux`).  
> **sudo لازم نیست.**

---

## A) هر بار که سرور را روشن می‌کنید (ترتیب)

### ۱. بروزرسانی کد (اختیاری ولی توصیه می‌شود)

```bash
cd ~/chat-box
git pull
pnpm install --frozen-lockfile
```

اگر migration جدید بود (روی سرور معمولاً **`db:push`** کافی است):

```bash
cd ~/chat-box
pnpm --filter api db:push
```

فقط جدول توکن API (FL-02) و `db:migrate` خطا می‌دهد:

```bash
pnpm --filter api db:ensure-api-tokens
```

view گزارش اپراتور (`agent_performance_daily`) و migrationهای 0012–0020:

```bash
pnpm --filter api db:ensure-pending
```

> **`db:migrate` روی سروری که قبلاً با `db:push` ساخته شده** ممکن است با exit 1 قطع شود (اسکیما از قبل وجود دارد ولی جدول `drizzle.__drizzle_migrations` هم‌خوان نیست). در این حالت از `db:push` + `db:ensure-pending` (یا `db:ensure-api-tokens`) استفاده کنید، نه `db:migrate`.

اگر `apps/ai-service/requirements.txt` عوض شده:

```bash
cd ~/chat-box/apps/ai-service
source .venv/bin/activate
pip install -r requirements.txt
```

---

### ۲. ترمینال ۰ — Postgres + Redis

```bash
cd ~/chat-box
docker compose up -d
docker compose ps
```

---

### ۳. ترمینال ۱ — API (پورت 3001)

```bash
cd ~/chat-box
pnpm --filter api dev
```

✓ منتظر: `Server listening at http://0.0.0.0:3001`

---

### ۴. ترمینال ۲ — AI Service (پورت 8000)

```bash
cd ~/chat-box/apps/ai-service
source .venv/bin/activate
./dev.sh
```

اگر `Permission denied`:

```bash
bash dev.sh
```

✓ منتظر: `Uvicorn running on http://0.0.0.0:8000`

---

### ۵. ترمینال ۳ — Dashboard (پورت 3000)

```bash
cd ~/chat-box
pnpm --filter dashboard dev
```

✓ منتظر: `Ready`

---

### ۶. ترمینال ۴ — لندینگ (پورت 3002)

```bash
cd ~/chat-box
pnpm --filter landing dev
```

✓ مرورگر: http://192.168.1.8:3002

---

## B) اولین نصب (فقط یک‌بار)

```bash
cd ~/chat-box
git clone https://github.com/hamid67fathi/chatbox.git .
# یا اگر قبلاً clone کرده‌اید: git pull

pnpm install --frozen-lockfile

docker compose up -d

pnpm --filter api db:push
pnpm --filter api db:seed
```

خروجی `db:seed` را نگه دارید — **Workspace ID** را می‌خواهید.

**AI Service:**

```bash
cd ~/chat-box/apps/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# در .env در صورت نیاز OPENAI_API_KEY و ... را بگذارید
chmod +x dev.sh
```

**env ریشه (API):**

```bash
cp ~/chat-box/.env.example ~/chat-box/.env
```

**داشبورد:**

```bash
cat > ~/chat-box/apps/dashboard/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://192.168.1.8:3001
NEXT_PUBLIC_WORKSPACE_ID=WORKSPACE_ID_FROM_LOGIN_OR_SEED
EOF
```

> **مهم:** `WORKSPACE_ID` را از خروجی login بگیرید (فیلد `user.workspaces[0].id`)، نه از docs قدیمی.

**لندینگ:**

```bash
cp ~/chat-box/apps/landing/.env.example ~/chat-box/apps/landing/.env.local
```

**Billing — در `~/chat-box/.env`:**

```bash
ZARINPAL_SANDBOX=true
ZARINPAL_CALLBACK_URL=http://192.168.1.8:3001/v1/billing/verify
DASHBOARD_URL=http://192.168.1.8:3000
# برای production: ZARINPAL_SANDBOX=false و ZARINPAL_MERCHANT_ID واقعی
```

**ویجت (اگر دکمه چت لود نشد):**

```bash
cd ~/chat-box
pnpm build:widget
```

---

## C) جدول خلاصه ترمینال‌ها

| ترمینال | پورت | دستور |
|---------|------|--------|
| ۰ | 5432 / 6379 | `cd ~/chat-box && docker compose up -d` |
| ۱ | 3001 | `cd ~/chat-box && pnpm --filter api dev` |
| ۲ | 8000 | `cd ~/chat-box/apps/ai-service && source .venv/bin/activate && ./dev.sh` |
| ۳ | 3000 | `cd ~/chat-box && pnpm --filter dashboard dev` |
| ۴ | 3002 | `cd ~/chat-box && pnpm --filter landing dev` |

---

## D) تست سلامت (curl)

```bash
curl -s http://192.168.1.8:3001/health
curl -s http://192.168.1.8:8000/health
```

اگر **«سرویس پیشنهاد پاسخ در دسترس نیست»** در inbox دیدید:

1. ترمینال ۲ (ai-service) باید روشن باشد — `curl` بالا برای `:8000` باید `ok` برگرداند.
2. در `~/chat-box/.env` مقدار `AI_SERVICE_URL=http://127.0.0.1:8000` (یا IP سرور) باشد؛ بعد از تغییر API را restart کنید.
3. اعتبار AI workspace تمام نشده باشد — بنر قرمز بالای inbox یا `GET .../ai-usage`.

---

## E) لاگین API و گرفتن TOKEN + Workspace ID

```bash
RESP=$(curl -s -X POST http://192.168.1.8:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chatbox.local","password":"chatbox123"}')

echo "$RESP"

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
WS_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['workspaces'][0]['id'])")

echo "TOKEN=$TOKEN"
echo "WS_ID=$WS_ID"
```

**مصرف AI:**

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID" \
  "http://192.168.1.8:3001/v1/workspaces/$WS_ID/ai-usage"
```

**پلن‌های billing:**

```bash
curl -s http://192.168.1.8:3001/v1/billing/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID"
```

**اشتراک workspace:**

```bash
curl -s "http://192.168.1.8:3001/v1/billing/$WS_ID/subscription" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID"
```

---

## F) آدرس‌های مرورگر

| آدرس | توضیح |
|------|--------|
| http://192.168.1.8:3000 | داشبورد inbox |
| http://192.168.1.8:3000/login | ورود |
| http://192.168.1.8:3000/register | ثبت‌نام |
| http://192.168.1.8:3000/billing | اشتراک، پرداخت، فاکتور PDF |
| http://192.168.1.8:3002 | لندینگ (خانه) |
| http://192.168.1.8:3002/pricing/ | قیمت‌ها |
| http://192.168.1.8:3001/chat.html | تست چت |
| http://192.168.1.8:3001/widget-demo/demo.html | دمو ویجت |

**ورود دمو:** `admin@chatbox.local` / `chatbox123`

بعد از تغییر UI داشبورد: **Hard refresh** (`Ctrl+Shift+R`)

---

## G) Observability (اختیاری)

```bash
cd ~/chat-box
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- Prometheus: http://192.168.1.8:9090  
- Grafana: http://192.168.1.8:3003  

---

## H) توقف سرویس‌ها

در هر ترمینال dev: `Ctrl+C`

Docker:

```bash
cd ~/chat-box
docker compose down
```

---

راهنمای بیشتر: [`STARTUP-AND-TEST.md`](./STARTUP-AND-TEST.md)
