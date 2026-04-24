#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .dev.vars ]]; then
  echo "missing .dev.vars — copy .env.template to .dev.vars and fill it in" >&2
  exit 1
fi

export COREPACK_ENABLE_STRICT=0

pnpm install

# Apply remote D1 migrations. Assumes `wrangler d1 create cc` has been run
# and the returned database_id is pasted into wrangler.json.
pnpm exec wrangler d1 migrations apply cc --remote

# Upload every KEY=VALUE line from .dev.vars as a Worker secret.
# Lines that are blank, comments, or have an empty value are skipped.
while IFS='=' read -r key value; do
  [[ -z "${key:-}" || "${key:0:1}" == "#" || -z "${value:-}" ]] && continue
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "$value" | pnpm exec wrangler secret put "$key"
done < .dev.vars

pnpm exec wrangler deploy

echo
echo "deployed. set the telegram webhook with:"
echo '  curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \'
echo '    -d "url=https://cc.<subdomain>.workers.dev/telegram/webhook" \'
echo '    -d "secret_token=<TELEGRAM_WEBHOOK_SECRET_TOKEN>"'
