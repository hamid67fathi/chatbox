#!/usr/bin/env bash
# Quick inbox diagnostic — run on the server
set -euo pipefail

API="${API_URL:-http://127.0.0.1:3001}"
EMAIL="${1:-admin@chatbox.local}"
PASS="${2:-chatbox123}"

echo "=== Login ==="
LOGIN=$(curl -s -X POST "$API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

TOKEN=$(echo "$LOGIN" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed:"
  echo "$LOGIN" | jq .
  exit 1
fi
echo "Token OK (${#TOKEN} chars)"

WS_ID=$(echo "$LOGIN" | jq -r '.user.workspaces[0].id // empty')
if [ -z "$WS_ID" ] || [ "$WS_ID" = "null" ]; then
  echo "No workspace in login response — calling /v1/auth/me"
  ME=$(curl -s "$API/v1/auth/me" -H "Authorization: Bearer $TOKEN")
  WS_ID=$(echo "$ME" | jq -r '.user.workspaces[0].id // empty')
fi
echo "Workspace ID: $WS_ID"

echo ""
echo "=== Workspaces ==="
curl -s "$API/v1/workspaces" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== Conversations (latest 10) ==="
curl -s "$API/v1/conversations?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID" | jq .

echo ""
echo "=== Widget session (new visitor) ==="
SESSION=$(curl -s -X POST "$API/widget/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{"workspace_slug":"demo","visitor_id":"diag-'$(date +%s)'"}')
echo "$SESSION" | jq .
CONV_ID=$(echo "$SESSION" | jq -r '.conversation_id')
VISITOR_TOKEN=$(echo "$SESSION" | jq -r '.token')

echo ""
echo "=== Send contact message via widget ==="
curl -s -X POST "$API/widget/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VISITOR_TOKEN" \
  -d '{"body":"diag test message"}' | jq .

echo ""
echo "=== Conversations again (should include $CONV_ID) ==="
curl -s "$API/v1/conversations?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS_ID" | jq '.data[] | {id, channel, lastMessageAt, contactId}'
