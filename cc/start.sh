#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

COREPACK_ENABLE_STRICT=0 pnpm install
COREPACK_ENABLE_STRICT=0 pnpm exec wrangler d1 migrations apply cc --local
COREPACK_ENABLE_STRICT=0 pnpm dev
