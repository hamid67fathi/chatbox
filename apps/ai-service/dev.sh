#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
	echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
	exit 1
fi
# shellcheck source=/dev/null
source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
