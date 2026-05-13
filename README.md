# Chat-Box

Multi-tenant live chat + AI (MVP in progress). Canonical specs live in [`docs/`](./docs/).

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20 LTS+ | `node -v` |
| **pnpm** | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Docker CE + Compose** | latest stable | Windows: Docker Desktop; Ubuntu: [docs.docker.com/engine/install/ubuntu](https://docs.docker.com/engine/install/ubuntu/) |
| **Git** | 2.x | |

**Local dev OS:** Windows 10/11 or Ubuntu 22.04/24.04 LTS.
**Server (staging/production):** Ubuntu 22.04/24.04 LTS — setup from scratch: [`docs/SERVER-DEV-FIRST-INSTALL-FA.md`](./docs/SERVER-DEV-FIRST-INSTALL-FA.md).

---

## Quick start

```bash
pnpm install
cp .env.example .env          # default values match docker-compose.yml
docker compose up -d           # starts Postgres + Redis
pnpm --filter api dev          # API on http://localhost:3001
```

Health check: `curl -s http://127.0.0.1:3001/health` → `{"ok":true}`

### Build & production-like run

```bash
pnpm build
pnpm --filter api start        # runs compiled dist/index.js
```

### Lint & type-check

```bash
pnpm lint
pnpm typecheck
```

---

## Ports & services

| Service | Port | URL / Connection | Source |
|---------|------|------------------|--------|
| **API** (Fastify) | 3001 | `http://localhost:3001` | `apps/api` |
| **PostgreSQL** | 5432 | `postgresql://chatbox:chatbox@localhost:5432/chatbox` | `docker-compose.yml` |
| **Redis** | 6379 | `redis://localhost:6379` | `docker-compose.yml` |

> Ports can be overridden via `.env` (copy from `.env.example`).

---

## Project structure

```
chat-box/
├── apps/
│   └── api/             # Fastify API server
├── packages/
│   └── config/          # Shared tsconfig / biome stubs
├── docs/                # Canonical specs (Persian + English)
├── scripts/             # Deploy helpers (Windows & Linux)
├── docker-compose.yml   # Postgres 16 + Redis 7
├── turbo.json           # Turborepo pipeline config
├── biome.json           # Linter / formatter
└── .env.example         # Environment template
```

Full structure spec: [`docs/07-PROJECT-STRUCTURE.md`](./docs/07-PROJECT-STRUCTURE.md)

---

## Sync local tree → remote Ubuntu

سرور staging: **`ssh -p 8022 user@178.33.138.231`** — مسیر روی سرور: **`/home/user/chat-box`**.

1. روی سرور یک‌بار Node / pnpm / Docker را طبق [`docs/SERVER-DEV-FIRST-INSTALL-FA.md`](./docs/SERVER-DEV-FIRST-INSTALL-FA.md) آماده کنید.
2. مقادیر پیش‌فرض در [`scripts/deploy.env.example`](./scripts/deploy.env.example) است؛ در صورت نیاز `cp scripts/deploy.env.example scripts/deploy.local.env` بزنید و فقط `deploy.local.env` را عوض کنید (این فایل commit نمی‌شود).
3. **Windows — استریم (بدون فایل میانی):** `.\scripts\deploy-sync-to-server.ps1`
4. **Windows — با `scp` (آرشیو):** `.\scripts\deploy-scp-to-server.ps1` یا دستورات دستی در [`docs/SERVER-DEV-FIRST-INSTALL-FA.md`](./docs/SERVER-DEV-FIRST-INSTALL-FA.md) بخش ۷.۱
5. **Git Bash / Linux:** `chmod +x scripts/deploy-sync-to-server.sh` سپس `./scripts/deploy-sync-to-server.sh`

---

## Docs & contributing

| Resource | Path |
|----------|------|
| Contributing guide | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Development guide (FA) | [`docs/15-DEVELOPMENT-GUIDE-FA.md`](./docs/15-DEVELOPMENT-GUIDE-FA.md) |
| Server setup from scratch (FA) | [`docs/SERVER-DEV-FIRST-INSTALL-FA.md`](./docs/SERVER-DEV-FIRST-INSTALL-FA.md) |
| Architecture | [`docs/02-ARCHITECTURE.md`](./docs/02-ARCHITECTURE.md) |
| API spec | [`docs/05-API-SPEC.md`](./docs/05-API-SPEC.md) |
| Roadmap | [`docs/08-ROADMAP.md`](./docs/08-ROADMAP.md) |
| Dev status tracker | [`docs/16-DEVELOPMENT-STATUS.md`](./docs/16-DEVELOPMENT-STATUS.md) |
