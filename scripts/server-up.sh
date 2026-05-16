#!/usr/bin/env bash
# Start ChatBox stack on Ubuntu server (run from repo root)
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">>> Docker (Postgres + Redis)"
docker compose up -d
docker compose ps

echo ">>> Install deps (if needed)"
pnpm install

echo ">>> DB schema + seed"
pnpm --filter api db:push
pnpm --filter api db:seed

echo ""
echo ">>> Ready. Open 3 terminals:"
echo "  T1: pnpm --filter api dev"
echo "  T2: cd apps/ai-service && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "  T3: pnpm --filter dashboard dev"
echo ""
echo "Test: curl -s http://127.0.0.1:3001/health"
