# syntax=docker/dockerfile:1

###############################################################################
# Base — shared setup for both the build and runtime stages
###############################################################################
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

###############################################################################
# Dependencies — installed once, cached separately from source changes
###############################################################################
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

###############################################################################
# Build — compiles TypeScript and generates the Prisma client
###############################################################################
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

###############################################################################
# Production dependencies only — no dev tooling (eslint, jest, ts-node, etc.)
# in the shipped image
###############################################################################
FROM base AS prod-deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

###############################################################################
# Runtime — the actual image that ships
###############################################################################
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3000

# Targets the version-neutral health path (see health.controller.ts) —
# deliberately not /api/v1/health, since infra probes shouldn't need to
# track API versions.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
