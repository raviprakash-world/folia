# Folia — System Architecture

Whole-monorepo view. For frontend-internal detail (routing, state management,
component structure), see `apps/web/ARCHITECTURE.md` — this file does not
duplicate it. For database detail, see `apps/api/DATABASE.md`. For deployment
mechanics, see `apps/api/DEPLOYMENT.md`.

## Topology

```
Browser
  │
  ▼
Vercel (static SPA host)
  │  same-origin rewrite: /api/* → Render API
  ▼
Render (NestJS API, Docker)
  │                    │
  ▼                    ▼
PostgreSQL 16      Redis (Key-Value)
(Prisma ORM)       │            │
                   rate limits  BullMQ connection
                                │
                                ▼
                        In-process job processor
                        (one real job: expired
                        reservation release, every 5 min)
```

- **Frontend:** Vite + React 19 SPA, no SSR/SSG. Deployed to Vercel as static
  assets; a `vercel.json` rewrite makes `/api/*` calls same-origin against the
  live Render backend (this matters for the httpOnly refresh-cookie flow, which
  would otherwise need cross-site cookie handling).
- **Backend:** NestJS 11, one Docker image, one Render web service. The BullMQ
  processor runs **in the same process** as the HTTP server — there is no
  separate worker service today (candidate for Phase 8).
- **Database:** PostgreSQL 16 via Prisma, 29 models, 2 migrations. Currently a
  Render free-tier instance (auto-deletes ~30 days after creation — see
  `PRODUCTION_STATUS.md`).
- **Redis:** used for `@nestjs/throttler` rate-limit counters and as the BullMQ
  connection. No application-level cache layer exists — this is a deliberate
  choice already documented elsewhere in the repo, not a gap.
- **Monorepo tooling:** Turborepo (`turbo.json`) — **currently non-functional**,
  see `PRODUCTION_STATUS.md` finding #1. Workspaces: `apps/api`, `apps/web`,
  `packages/shared-types`, `packages/shared-utils`, `packages/api-client`,
  `packages/shared-config`.

## Request lifecycle (the happy path that exists today)

1. Browser → Vercel → (rewrite) → Render → NestJS `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → controller → service → Prisma → Postgres.
2. Response retraces the same path. No CDN-level caching of API responses; static assets are Vercel-cached.

## What does *not* exist yet (architecturally, not just "unconfigured")

These aren't missing config values — there is no code path for them at all yet,
which is why they're phases in `PRODUCTION_ROADMAP.md` rather than settings to flip:

- No payment-provider client anywhere (Phase 1).
- No courier/logistics client anywhere (Phase 5).
- No outbound email/SMS client anywhere (Phase 3).
- No object-storage client anywhere — uploaded files go to local disk on the
  Render instance, which is ephemeral and not even served back over HTTP today
  (Phase 7).
- No separate worker process/service for BullMQ (candidate: Phase 8).
- No CI pipeline of any kind (Phase 8).

## Environments

| Environment | Frontend | API | Database | Notes |
|---|---|---|---|---|
| Local dev | `vite dev` (localhost:5173) | `nest start --watch` (localhost:3000) | Docker Compose Postgres 16 + Redis 7 | `docker-compose.yml` at repo root |
| Production (current) | Vercel | Render | Render free Postgres | Both on free tiers — see `PRODUCTION_STATUS.md` for the real constraints that implies |
