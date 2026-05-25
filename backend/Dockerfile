# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

# ─── build stage: install deps + compile TS + prune devDeps ──
FROM node:${NODE_VERSION}-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# ─── runtime stage: slim, deps already compiled ─────────────
FROM node:${NODE_VERSION}-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/agentbank.db
EXPOSE 8080

CMD ["node", "dist/index.js"]
