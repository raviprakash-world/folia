# Folia

A Turborepo monorepo containing the Folia e-commerce storefront and its
production backend.

```
apps/
  web/    React 19 + Vite storefront (Phases 1–9 — see apps/web/CHANGELOG.md)
  api/    NestJS backend (Phase 0 — see apps/api/README.md)
packages/
  shared-types/    Types shared between web and api (empty until Phase 1)
  api-client/      Typed client wrapping api calls (empty until Phase 1)
  shared-utils/    Genuinely shared pure utilities (empty — no overlap yet)
  shared-config/   Reserved for shared tooling config (empty — not enough overlap yet)
docker-compose.yml Postgres + Redis + api, wired for local/production use
.github/workflows/ CI — separate web and api jobs, api job runs against
                    real Postgres/Redis service containers
```

## Getting started

```bash
npm install                          # installs all workspaces
cp .env.example .env                 # for docker-compose
cp apps/api/.env.example apps/api/.env   # for running the api directly

# Frontend
cd apps/web && npm run dev

# Backend (needs Postgres + Redis reachable — see apps/api/README.md)
cd apps/api && npm run start:dev

# Or everything via Docker
docker compose up --build
```

## Frontend integration strategy

The frontend currently talks to a mock backend (MSW — see
`apps/web/ARCHITECTURE.md`). The plan, per the backend development brief:

1. Build and verify each backend module against its own test suite first.
2. Replace **one** frontend service file at a time (e.g.
   `apps/web/src/services/productService.ts`) to call the real API instead
   of MSW's mock handler for that resource — never a "big bang" cutover.
3. Verify that one integration works, then move to the next service.
4. Remove MSW only once every service has been migrated.

The backend's API contract is designed to make this low-friction: routes
are prefixed `/api` (matching `apps/web/src/services/apiClient.ts`'s
existing `baseURL: '/api'` exactly), and every error response is
normalized to `{ message: string, ... }` (matching
`apps/web/src/utils/apiError.ts`'s existing `extractApiErrorMessage`
exactly) — both confirmed by reading the actual frontend source before
designing the backend's conventions, not assumed compatible.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation — NestJS, Prisma, Postgres, Redis, Docker, logging, validation, exception handling, Swagger, health checks, CI | Complete |
| 1 | Authentication & Users — register/login/logout/refresh/password reset/email verification/profile/avatar/RBAC/sessions | Complete |
| 2 | Product Catalog — products/categories/collections/brands/variants/images/specs/tags, real catalog data migrated from the frontend | Complete |
| 3 | Inventory — warehouses, stock tracking, reservations, SKU management, real-time availability | Complete |
| 4 | Cart & Wishlist — guest/user cart with merge-on-login, wishlist, coupons, shipping estimate | Complete |
| 5 | Checkout — addresses, delivery methods, mock payment processing, order creation | Complete |
| 6 | Order Management — cancellation, returns, simulated real-time tracking | Complete |
| 7 | Search — product/category ranking, did-you-mean, real trending searches | Complete |
| 8 | Recommendations + Analytics Foundation — similar/FBT/personalized, real event-driven analytics | Complete |
| 9 | Admin Dashboard + Admin Operations — real CRUD for products/orders/inventory/users, audit logging | Complete |
| 10 | Frontend↔Backend Integration — auth domain only, deliberately scoped; see INTEGRATION.md | Partial — see below |
| 11 | Production Hardening — real checkout idempotency, payload limits, N+1 fix, index verification | Complete |
| 12 | Observability + Background Processing — liveness/readiness split, request-ID logging, real BullMQ job | Complete |
| 13 | Final Production Release — full readiness audit; see PRODUCTION_READINESS.md | Complete — **not** a "production ready" declaration |

**This project is not production-ready as-is.** `PRODUCTION_READINESS.md`
at the repo root is the honest, itemized account of exactly why, and
exactly what would need to happen first (starting with `prisma
generate`, which has been blocked in every sandbox this was built in).
Also see `apps/api/DATABASE.md`, `apps/api/SECURITY.md`, and
`apps/api/DEPLOYMENT.md` for the detail behind that report's summary
table, and `INTEGRATION.md` for the frontend-integration-specific
account.

**Phase 10 note:** this phase's central claim ("frontend correctly
talks to the real backend") cannot be verified in this environment — it
needs a live-booted backend, blocked since Phase 0 by the same
`prisma generate` network restriction. Rather than write unverifiable
code across all 18 domains the phase covers, only the auth domain was
built, with an explicit, honest accounting of what's actually verified
(static: compiles, lints, builds, matches the backend's real contract)
versus what isn't (runtime: an actual login round-trip against a live
backend). Full detail, plus a manual verification checklist for anyone
with a working environment, in `INTEGRATION.md`.

## Known issues

See `apps/api/README.md`'s "Known issues" section for the one environment-
specific gap found during Phase 0 development (Prisma's binary CDN being
unreachable in the sandbox this was built in) and exactly what it does
and doesn't affect.
