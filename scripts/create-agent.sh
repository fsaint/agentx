#!/bin/bash
# Quick script to create an agent via the API (bypasses the form)
#
# Usage:
#   # Pass your session cookie from the browser:
#   SESSION_TOKEN="your-authjs.session-token-value" ./scripts/create-agent.sh
#
#   # Or override the URL:
#   AGENTX_URL=http://localhost:6401 ./scripts/create-agent.sh

set -e

BASE_URL="${AGENTX_URL:-https://agentx-web.fly.dev}"

if [ -z "$SESSION_TOKEN" ]; then
  echo "ERROR: Set SESSION_TOKEN to your authjs.session-token cookie value."
  echo ""
  echo "To get it: open $BASE_URL in your browser, open DevTools > Application > Cookies,"
  echo "copy the value of 'authjs.session-token', then run:"
  echo ""
  echo "  SESSION_TOKEN=\"paste-here\" ./scripts/create-agent.sh"
  exit 1
fi

# Verify session
echo "Verifying session..."
SESSION_CHECK=$(curl -s -b "authjs.session-token=$SESSION_TOKEN" "$BASE_URL/api/auth/session")
USER_EMAIL=$(echo "$SESSION_CHECK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('email',''))" 2>/dev/null)

if [ -z "$USER_EMAIL" ]; then
  echo "ERROR: Invalid or expired session token."
  exit 1
fi
echo "Authenticated as: $USER_EMAIL"

# Generate a random name
ADJECTIVES=(swift bold calm keen wise brave quick sharp cool bright)
NOUNS=(falcon wolf hawk tiger eagle fox lynx bear raven otter)
ADJ=${ADJECTIVES[$RANDOM % ${#ADJECTIVES[@]}]}
NOUN=${NOUNS[$RANDOM % ${#NOUNS[@]}]}
AGENT_NAME="${ADJ}-${NOUN}-$(date +%s | tail -c 5)"

echo "Creating agent: $AGENT_NAME"

# Build JSON payload with python3 to avoid shell escaping issues
PAYLOAD=$(python3 -c "
import json
print(json.dumps({
    'name': '$AGENT_NAME',
    'telegramToken': '8693656584:AAFYTAaF6MR1kZltuTChWFoAlbtDiX8QJks',
    'telegramUserId': '5982613183',
    'mcpConfig': json.dumps([
        {
            'name': 'reins-openclaw-assistant',
            'type': 'url',
            'url': 'https://reins.btv.pw/mcp/lgCOZv-ScAftr7_FlQfUK'
        }
    ]),
    'soulMd': '''# Soul

You are a helpful, friendly AI assistant.

## Personality

- Be concise and direct
- Be helpful and proactive
- Ask clarifying questions when the request is ambiguous
- Respect the user's time
'''
}))
")

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -b "authjs.session-token=$SESSION_TOKEN" \
  -X POST "$BASE_URL/api/agents" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "Status: $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" = "201" ]; then
  AGENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  echo ""
  echo "Agent created! View at: $BASE_URL/agents/$AGENT_ID"
fi
