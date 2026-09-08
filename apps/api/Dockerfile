# syntax=docker/dockerfile:1

###############################################################################
# Base
###############################################################################
FROM node:20-alpine AS base
WORKDIR /app
# python3/make/g++ are needed to compile argon2's native binding via
# node-gyp when no prebuilt binary matches this platform. Only the base
# stage (deps/build/prod-deps) needs them — the runtime stage below
# starts fresh from node:20-alpine, so these never reach the shipped image.
RUN apk add --no-cache libc6-compat openssl python3 make g++

###############################################################################
# Dependencies — root lockfile + every workspace's package.json, so npm can
# resolve the workspace graph. Context is the monorepo root.
###############################################################################
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-utils/package.json ./packages/shared-utils/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/shared-config/package.json ./packages/shared-config/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci

###############################################################################
# Build
###############################################################################
FROM deps AS build
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

###############################################################################
# Production dependencies only
###############################################################################
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-utils/package.json ./packages/shared-utils/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/shared-config/package.json ./packages/shared-config/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci --omit=dev
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

###############################################################################
# Runtime
###############################################################################
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001 \
  && mkdir -p /app/uploads \
  && chown nestjs:nodejs /app/uploads

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/package.json

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/ready || exit 1

# P0-D — `exec` here matters: without it, `node` runs as a CHILD of this
# shell (PID 1), and Alpine's ash does not forward SIGTERM to children by
# default — the container would sit until Docker's stop-grace-period
# expires and then get SIGKILLed, with the app never seeing the signal
# at all (confirmed the failure mode before this fix, not assumed).
# `exec` replaces the shell process image with `node`, so `node` itself
# becomes PID 1 and receives SIGTERM directly — required for
# app.enableShutdownHooks() (main.ts) to ever run.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && exec node apps/api/dist/src/main.js"]
