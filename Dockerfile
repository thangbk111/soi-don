# syntax=docker/dockerfile:1
# Một Dockerfile, hai target: `web` và `api`. Build từ gốc monorepo:
#   docker build --target api -t soidon-api .
#   docker build --target web -t soidon-web .
# Không chỉ định target → `api` (stage cuối), là thứ Railway build.

FROM node:24-bookworm-slim AS base
# Prisma engine cần openssl.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.15.0
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Web gọi API qua cùng origin (`/api`, Caddy chuyển tiếp) nên một image chạy được với mọi tên miền.
ENV NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# API giữ nguyên node_modules của workspace: cần Prisma CLI (migrate deploy) và tsx (seed danh mục).
FROM base AS api
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "/repo/deploy/api-start.sh"]
