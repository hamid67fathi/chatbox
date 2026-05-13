#!/usr/bin/env bash
# همگام‌سازی ریپوی لوکال با سرور Ubuntu از طریق SSH + rsync.
# پیش‌نیاز (روی ماشین لوکال): rsync و ssh در PATH (Git Bash / Linux / macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/scripts/deploy.local.env}"
if [[ ! -f "$ENV_FILE" && -f "$ROOT/scripts/deploy.env.example" ]]; then
	ENV_FILE="$ROOT/scripts/deploy.env.example"
fi
if [[ -f "$ENV_FILE" ]]; then
	# shellcheck disable=SC1090
	set -a && source "$ENV_FILE" && set +a
else
	echo "Missing deploy config: create scripts/deploy.local.env (see scripts/deploy.env.example)." >&2
	exit 1
fi

: "${DEPLOY_SSH_USER:?Set DEPLOY_SSH_USER in scripts/deploy.env.example or deploy.local.env}"
: "${DEPLOY_SSH_HOST:?Set DEPLOY_SSH_HOST in scripts/deploy.env.example or deploy.local.env}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
: "${DEPLOY_REMOTE_PATH:?Set DEPLOY_REMOTE_PATH in scripts/deploy.env.example or deploy.local.env}"

EXCLUDES_FILE="$ROOT/scripts/deploy-rsync-excludes.txt"
if [[ ! -f "$EXCLUDES_FILE" ]]; then
	echo "Missing $EXCLUDES_FILE" >&2
	exit 1
fi

SSH_BASE=(ssh -p "$DEPLOY_SSH_PORT" -o StrictHostKeyChecking=accept-new "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}")
RSYNC_RSH="ssh -p $DEPLOY_SSH_PORT -o StrictHostKeyChecking=accept-new"
TARGET="${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_PATH}/"

echo "==> Ensure remote directory exists"
"${SSH_BASE[@]}" "mkdir -p \"${DEPLOY_REMOTE_PATH}\""

echo "==> rsync $ROOT/ -> $TARGET"
rsync -avz \
	-e "$RSYNC_RSH" \
	--exclude-from="$EXCLUDES_FILE" \
	./ "$TARGET"

if [[ "${RUN_REMOTE_AFTER_SYNC:-0}" == "1" ]]; then
	echo "==> Remote: pnpm install + docker compose up -d"
	"${SSH_BASE[@]}" "bash -lc 'set -e; cd \"${DEPLOY_REMOTE_PATH}\"; command -v pnpm >/dev/null || { echo pnpm not found on server; exit 1; }; pnpm install --frozen-lockfile; docker compose up -d'"
fi

echo "Done."
