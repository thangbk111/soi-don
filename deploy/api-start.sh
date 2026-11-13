#!/bin/sh
# Chạy migration và seed danh mục (idempotent) trước khi mở API.
set -e
cd /repo/packages/db
pnpm exec prisma migrate deploy
pnpm exec tsx prisma/seed.ts
cd /repo/apps/api
exec node dist/main.js
