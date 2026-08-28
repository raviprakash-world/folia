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
| 0 | Foundation — NestJS, Prisma, Postgres, Redis, Docker, logging, validation, exception handling, Swagger, health checks, CI | In review |
| 1–10 | See the backend development brief | Not started |

## Known issues

See `apps/api/README.md`'s "Known issues" section for the one environment-
specific gap found during Phase 0 development (Prisma's binary CDN being
unreachable in the sandbox this was built in) and exactly what it does
and doesn't affect.
