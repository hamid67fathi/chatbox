# اجرای سرویس‌ها — یک دستور per ترمینال

> **سرور نمونه:** `192.168.1.8`  
> هر بلوک زیر = **یک ترمینال SSH جدا** (یا یک pane در `tmux`). ترمینال‌ها را باز نگه دارید.

---

## ترمینال ۰ — دیتابیس و Redis

اگر `docker compose ps` نشان می‌دهد Postgres و Redis بالا هستند، این مرحله را رد کنید.

```bash
cd ~/chat-box
docker compose up -d
docker compose ps
```

---

## ترمینال ۱ — API (پورت 3001)

```bash
cd ~/chat-box
pnpm --filter api dev
```

منتظر بمانید تا ببینید: `Server listening at http://0.0.0.0:3001`

---

## ترمینال ۲ — AI Service (پورت 8000)

```bash
cd ~/chat-box/apps/ai-service
source .venv/bin/activate
./dev.sh
```

اگر `./dev.sh` خطای Permission denied داد:

```bash
bash dev.sh
```

منتظر بمانید: `Uvicorn running on http://0.0.0.0:8000`

---

## ترمینال ۳ — Dashboard (پورت 3000)

```bash
cd ~/chat-box
pnpm --filter dashboard dev
```

منتظر بمانید: `Ready` / `compiled`

---

## ترمینال ۴ — لندینگ پیج (پورت 3002، اختیاری)

```bash
cd ~/chat-box
pnpm --filter landing dev
```

بعد از `pnpm install` یک‌بار:

```bash
cp apps/landing/.env.example apps/landing/.env.local
```

مرورگر: http://192.168.1.8:3002

**صفحه billing در داشبورد:** http://192.168.1.8:3000/billing

---

## بعد از هر `git pull`

قبل از اجرای ترمینال‌های ۱–۳ (یک‌بار کافی است):

```bash
cd ~/chat-box
git pull
pnpm install --frozen-lockfile
```

اگر migration جدید بود:

```bash
pnpm --filter api db:push
```

بعد از pull، اگر وابستگی AI عوض شده (مثلاً langfuse):

```bash
cd ~/chat-box/apps/ai-service
source .venv/bin/activate
pip install -r requirements.txt
```

---

## تست سریع (ترمینال چهارم یا همان لپ‌تاپ)

```bash
curl -s http://192.168.1.8:3001/health
curl -s http://192.168.1.8:8000/health
```

خروجی API: `{"ok":true,"db":true}`  
خروجی AI: `"ok": true` در JSON

---

## مرورگر

| آدرس | کاربرد |
|------|--------|
| http://192.168.1.8:3000 | داشبورد — `admin@chatbox.local` / `chatbox123` |
| http://192.168.1.8:3001/chat.html | تست چت / ویجت |
| http://192.168.1.8:3001/widget-demo/demo.html | دمو embed ویجت |

داشبورد: **Hard refresh** (`Ctrl+Shift+R`) بعد از deploy داشبورد.

---

## خلاصه یک‌خطی

| ترمینال | دستور |
|---------|--------|
| ۰ | `cd ~/chat-box && docker compose up -d` |
| ۱ | `cd ~/chat-box && pnpm --filter api dev` |
| ۲ | `cd ~/chat-box/apps/ai-service && source .venv/bin/activate && ./dev.sh` |
| ۳ | `cd ~/chat-box && pnpm --filter dashboard dev` |
| ۴ | `cd ~/chat-box && pnpm --filter landing dev` (اختیاری) |

**نیاز به `sudo` نیست** برای هی‌کدام از این دستورات.

---

## اولین بار (فقط یک‌بار بعد از clone)

```bash
cd ~/chat-box
pnpm install --frozen-lockfile
docker compose up -d
pnpm --filter api db:push
pnpm --filter api db:seed

cd apps/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

داشبورد — `apps/dashboard/.env.local`:

```bash
cat > ~/chat-box/apps/dashboard/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://192.168.1.8:3001
NEXT_PUBLIC_WORKSPACE_ID=<WORKSPACE_UUID_FROM_SEED>
EOF
```

> `WORKSPACE_UUID` را از خروجی `db:seed` بردارید.

---

## (اختیاری) Observability

```bash
cd ~/chat-box
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

---

راهنمای کامل‌تر: [`STARTUP-AND-TEST.md`](./STARTUP-AND-TEST.md)
