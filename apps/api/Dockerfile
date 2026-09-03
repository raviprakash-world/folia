# syntax=docker/dockerfile:1

###############################################################################
# Base
###############################################################################
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

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
  && adduser -S nestjs -u 1001

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/package.json

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/ready || exit 1

CMD ["node", "apps/api/dist/main.js"]
