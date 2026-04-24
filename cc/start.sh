# pnpm wrangler d1 create cc
# pnpm db:migrate

pnpm wrangler secret put TELEGRAM_BOT_TOKEN
pnpm wrangler secret put TELEGRAM_WEBHOOK_SECRET_TOKEN
pnpm wrangler secret put TELEGRAM_ALLOWED_CHAT_ID
pnpm wrangler secret put ELEVENLABS_API_KEY
pnpm wrangler secret put WEB_AUTH_TOKEN

# curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
#     -d "url=https://cc.<your-subdomain>.workers.dev/telegram/webhook" \
#     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET_TOKEN>"