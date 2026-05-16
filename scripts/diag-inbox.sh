#!/usr/bin/env bash
# Quick inbox diagnostic — run on the server (API must be running)
API="${API_URL:-http://127.0.0.1:3001}"
EMAIL="${1:-admin@chatbox.local}"
PASS="${2:-chatbox123}"

echo "=== 1. API health ==="
HEALTH=$(curl -sS -w "\nHTTP_CODE:%{http_code}" "$API/health" 2>&1) || true
echo "$HEALTH"
if ! echo "$HEALTH" | grep -q '"ok":true'; then
  echo ""
  echo "ERROR: API is not running on $API"
  echo "Start it:  cd ~/chat-box && docker compose up -d && pnpm --filter api dev"
  exit 1
fi

echo ""
echo "=== 2. Login ($EMAIL) ==="
LOGIN=$(curl -sS -X POST "$API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>&1) || true

if [ -z "$LOGIN" ]; then
  echo "ERROR: empty response from login"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Raw login response (install jq for parsing: sudo apt install -y jq):"
  echo "$LOGIN"
  exit 1
fi

TOKEN=$(echo "$LOGIN" | jq -r '.access_token // empty' 2>/dev/null || true)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed. Raw response:"
  echo "$LOGIN" | jq . 2>/dev/null || echo "$LOGIN"
  echo ""
  echo "Try: pnpm --filter api db:seed   (password: chatbox123)"
  exit 1
fi
echo "Token OK (${#TOKEN} chars)"

WS_ID=$(echo "$LOGIN" | jq -r '.user.workspaces[0].id // empty')
if [ -z "$WS_ID" ] || [ "$WS_ID" = "null" ]; then
  echo "Fetching workspace from /v1/auth/me ..."
  ME=$(curl -sS "$API/v1/auth/me" -H "Authorization: Bearer $TOKEN")
  WS_ID=$(echo "$ME" | jq -r '.user.workspaces[0].id // empty')
fi
if [ -z "$WS_ID" ] || [ "$WS_ID" = "null" ]; then
  echo "ERROR: no workspace for user. Run db:seed or login again after git pull."
  exit 1
fi
echo "Workspace ID: $WS_ID"

echo ""
echo "=== 3. Workspaces ==="
curl -sS "$API/v1/workspaces" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4. Conversations (latest 10) ==="
curl -sS "$API/v1/conversations?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID" | jq .

echo ""
echo "=== 5. Widget session (new visitor) ==="
SESSION=$(curl -sS -X POST "$API/widget/v1/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_slug\":\"demo\",\"visitor_id\":\"diag-$(date +%s)\"}")
echo "$SESSION" | jq .
CONV_ID=$(echo "$SESSION" | jq -r '.conversation_id')
VISITOR_TOKEN=$(echo "$SESSION" | jq -r '.token')

echo ""
echo "=== 6. Send contact message ==="
curl -sS -X POST "$API/widget/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VISITOR_TOKEN" \
  -d '{"body":"diag test message"}' | jq .

echo ""
echo "=== 7. Conversations again (should include $CONV_ID) ==="
curl -sS "$API/v1/conversations?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID" | jq '.data[] | {id, channel, lastMessageAt, contactId}'

echo ""
echo "DONE — if step 7 shows the new conversation, API is OK; refresh dashboard."
