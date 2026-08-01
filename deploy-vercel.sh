#!/usr/bin/env bash
# One-shot Vercel production deploy for rah-midland.com
# Usage: VERCEL_TOKEN=<token> ./deploy-vercel.sh
# Or:    ./deploy-vercel.sh <token>
#
# Requires: npx available, project root = right-at-home-bnb/

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOKEN="${VERCEL_TOKEN:-${1:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: No VERCEL_TOKEN found."
  echo "Get one at https://vercel.com/account/tokens then run:"
  echo "  VERCEL_TOKEN=<token> ./deploy-vercel.sh"
  exit 1
fi

echo "=== rah-midland Vercel production deploy ==="
echo "Repo: $REPO_ROOT"
echo "Project: prj_jzQB3wfbYluy9v38uGYr8AzF7lWB (team: team_zltGa4jWp6vVNl2t98Z35wu3)"
echo ""

cd "$REPO_ROOT"
echo "Deploying from: $(git log --oneline -1)"
echo ""

npx vercel@latest deploy --prod --yes --token="$TOKEN"

echo ""
echo "=== Verifying deployment ==="
sleep 15
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://rah-midland.com/api/weather)
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "SUCCESS: /api/weather returns 200"
else
  echo "WARNING: /api/weather returned $HTTP_STATUS (may still be propagating)"
fi

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://rah-midland.com/api/health)
echo "Health check: /api/health = $HEALTH"
