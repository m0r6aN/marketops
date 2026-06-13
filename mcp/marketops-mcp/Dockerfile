# syntax=docker/dockerfile:1.7
# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    MARKETOPS_MCP_MODE=stdio \
    DOCS_AS_MARKETING_STRICT_JSON=true

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=build /app/dist ./dist

# MCP servers communicate over stdio by default; no port to expose.
ENTRYPOINT ["node", "dist/index.js"]
