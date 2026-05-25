# syntax=docker/dockerfile:1
FROM node:22-slim AS base

# Build prerequisites for better-sqlite3 prebuilds + native fallback
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── deps ─────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ─── build ────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── runtime ──────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# Just what we need to run
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/schema.sql ./dist/db/schema.sql

# Fly volume mounts to /data
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/agentbank.db
EXPOSE 8080

CMD ["node", "dist/index.js"]
