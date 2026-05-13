# نصب از صفر — سرور Ubuntu روی اینترنت (توسعهٔ Chat-Box)

> **مخاطب:** سرور **Ubuntu Server 22.04 یا 24.04 LTS** با SSH؛ شما **از قبل یک کاربر غیر root** با `sudo` دارید (ساخت کاربر جدید در این سند نیست).  
> **جریان کار:** توسعه روی **Windows**؛ انتقال به سرور با **`scripts/deploy-sync-to-server.ps1`** (PowerShell) یا **`scripts/deploy-sync-to-server.sh`** (Git Bash / Linux).  
> **فرض:** اینترنت آزاد (بدون پروکسی سازمانی در این سند).  
> **هم‌راستا با:** [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md)، [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md).

---

## ۰) ورود به سرور (از لپ‌تاپ)

```bash
ssh -p 8022 user@178.33.138.231
```

---

## ۱) به‌روزرسانی سیستم و ابزار پایه

**بعد از اتصال SSH** (روی همان سرور):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates gnupg lsb-release software-properties-common build-essential rsync
```

---

## ۲) زمان و منطقهٔ زمانی (برای لاگ و TLS)

```bash
sudo timedatectl set-timezone Asia/Tehran
timedatectl status
```

(در صورت نیاز منطقه را عوض کنید.)

---

## ۳) Node.js 20 LTS (از مخزن NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

باید نسخهٔ **v20.x** ببینید.

---

## ۴) pnpm از طریق Corepack

```bash
sudo corepack enable
corepack prepare pnpm@9 --activate
pnpm -v
```

اگر `corepack prepare` بدون `sudo` خطای دسترسی داد، یک بار `sudo corepack prepare pnpm@9 --activate` بزنید.

اگر `corepack` روی سرور نبود:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
# سپس طبق خروجی اسکریپت PATH را تنظیم کنید یا دوباره SSH بزنید.
```

---

## ۵) Docker Engine + پلاگین Compose (رسمی Docker)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

**یک بار** از SSH خارج شوید و دوباره وارد شوید تا گروه `docker` اعمال شود؛ سپس:

```bash
ssh -p 8022 user@178.33.138.231
docker run --rm hello-world
docker compose version
```

اگر **`permission denied`** روی **`/var/run/docker.sock`** می‌بینید، یعنی گروه **`docker`** هنوز روی نشست فعلی اعمال نشده یا کاربر عضو نیست:

```bash
sudo usermod -aG docker "$USER"
# حتماً یک بار از SSH خارج شوید و دوباره وارد شوید (یا در همین نشست:)
newgrp docker
docker run --rm hello-world
```

تا وقتی عضو گروه نشده‌اید، موقت می‌توانید بزنید: **`sudo docker compose up -d`** (برای توسعه قابل قبول است؛ برای سرویس systemd بعداً همان کاربر باید بدون sudo به Docker دسترسی داشته باشد یا سرویس را با تنظیمات دیگر اجرا کنید).

---

## ۶) یک‌بار آماده‌سازی مسیر روی سرور

روی سرور (کاربر **`user`**):

```bash
mkdir -p /home/user/chat-box
```

مسیر روی سرور همان **`/home/user/chat-box`** است که در [`../scripts/deploy.env.example`](../scripts/deploy.env.example) برای همگام‌سازی ست شده است.

اولین بار بعد از اولین sync از لوکال، روی سرور:

```bash
ssh -p 8022 user@178.33.138.231
cd /home/user/chat-box
cp .env.example .env
# مقادیر واقعی را در .env بگذارید؛ این فایل با اسکریپت deploy به سرور کپی نمی‌شود.
pnpm install
docker compose up -d
```

اگر **`docker compose`** بدون sudo خطای **`permission denied ... docker.sock`** داد، بخش **۵** (پایان: `usermod` + خروج و ورود دوبارهٔ SSH یا `newgrp docker`) را انجام دهید، یا موقت **`sudo docker compose up -d`**.

---

## ۷) همگام‌سازی از لوکال به سرور (هر بار بعد از توسعه)

مقادیر پیش‌فرض **`ssh -p 8022 user@178.33.138.231`** و مسیر **`/home/user/chat-box`** در [`../scripts/deploy.env.example`](../scripts/deploy.env.example) هست. اگر همان را می‌خواهید، می‌توانید مستقیم از همان فایل بخوانید یا یک بار `cp scripts/deploy.env.example scripts/deploy.local.env` بزنید و فقط در صورت نیاز تغییر دهید (`deploy.local.env` در git نیست).

**روی Windows (PowerShell)** از ریشهٔ پوشهٔ ریپو (همان جایی که `package.json` است):

```powershell
cd <مسیر-کلون-ریپو-روی-ویندوز>
.\scripts\deploy-sync-to-server.ps1
```

**روی Linux / Git Bash:**

```bash
cd /path/to/chat-box
chmod +x scripts/deploy-sync-to-server.sh
./scripts/deploy-sync-to-server.sh
```

### ۷.۱ از ویندوز با `scp` (آرشیو + یک `scp`)

`scp -r` کل پوشه را **با `node_modules`** هم می‌فرستد و عملاً غیرقابل‌استفاده است. الگوی درست: **یک `.tgz` بسازید → با `scp` بفرستید → روی سرور با `ssh` باز کنید.**

**چهار دستور در PowerShell** (از ریشهٔ ریپو؛ `cd` را با مسیر واقعی ریپو روی ویندوز عوض کنید):

```powershell
cd C:\Github\chat-box
tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=.turbo --exclude=.pnpm-store -czf $env:TEMP\chat-box-sync.tgz .
scp -P 8022 $env:TEMP\chat-box-sync.tgz user@178.33.138.231:/home/user/chat-box/
ssh -p 8022 user@178.33.138.231 "bash -lc 'cd /home/user/chat-box && tar xzf chat-box-sync.tgz && rm -f chat-box-sync.tgz'"
Remove-Item $env:TEMP\chat-box-sync.tgz
```

> برای **`scp`** روی OpenSSH ویندوز پورت غیراستاندارد با **`-P` بزرگ** است؛ برای **`ssh`** همان پورت با **`-p` کوچک**.

**یا یک اسکریپت** (همان منطق + حذف خودکار آرشیو موقت):

```powershell
cd C:\Github\chat-box
.\scripts\deploy-scp-to-server.ps1
```

**بعد از هر انتقال** روی سرور:

```bash
ssh -p 8022 user@178.33.138.231
cd /home/user/chat-box
pnpm install --frozen-lockfile
docker compose up -d
```

اگر **`docker compose`** بدون sudo به **`docker.sock`** گیر کرد، همان راه‌حل بخش **۵** (`usermod` + خروج/ورود SSH یا `newgrp docker`) یا موقت **`sudo docker compose up -d`**.

اگر می‌خواهید بعد از هر **همگام‌سازی (tar/rsync)** روی سرور خودکار **`pnpm install --frozen-lockfile`** و **`docker compose up -d`** اجرا شود، در `deploy.local.env` بگذارید:

```bash
export RUN_REMOTE_AFTER_SYNC=1
```

---

## ۸) اجرای API (حالت توسعه — موقت روی سرور)

```bash
ssh -p 8022 user@178.33.138.231
cd /home/user/chat-box
pnpm --filter api dev
```

ترمینال دوم (دوباره به همان سرور):

```bash
ssh -p 8022 user@178.33.138.231
curl -s http://127.0.0.1:3001/health
```

انتظار: `{"ok":true}` — برای متوقف کردن: `Ctrl+C`.

---

## ۹) اجرای پایدار (build + systemd)

```bash
ssh -p 8022 user@178.33.138.231
cd /home/user/chat-box
pnpm --filter api build
```

فایل سرویس (کاربر **`user`**، مسیر **`/home/user/chat-box`**):

```bash
sudo tee /etc/systemd/system/chatbox-api.service > /dev/null << 'EOF'
[Unit]
Description=Chat-Box API (Fastify)
After=network.target docker.service

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/chat-box
EnvironmentFile=/home/user/chat-box/.env
ExecStart=/usr/bin/node /home/user/chat-box/apps/api/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chatbox-api
sudo systemctl status chatbox-api
curl -s http://127.0.0.1:3001/health
```

---

## ۱۰) امنیت تکمیلی (اختیاری ولی توصیه‌شده)

```bash
ssh -p 8022 user@178.33.138.231
sudo apt install -y fail2ban unattended-upgrades
```

طبق [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md) بخش امنیت پایه را کامل کنید.

---

## ۱۱) بعد از نصب

- توسعهٔ روزمره روی **Windows**: [`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md)  
- وضعیت مراحل پروژه: [`16-DEVELOPMENT-STATUS.md`](./16-DEVELOPMENT-STATUS.md)

---

**پایان سند.**
