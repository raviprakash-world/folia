# Deployment

## What exists and is real

- `Dockerfile` — multi-stage (deps → build → prod-deps → runtime),
  non-root user, `HEALTHCHECK` against the real readiness endpoint
  (`/api/health/ready`, Phase 12), production `node_modules` installed
  separately from dev tooling so eslint/jest/ts-node never ship.
- `docker-compose.yml` (repo root) — Postgres 16, Redis 7, and the API,
  with real `depends_on: condition: service_healthy` gating (the API
  container won't start accepting the "ready" state until Postgres and
  Redis are both actually reachable), and required secrets enforced via
  `${VAR:?message}` — `docker compose up` fails loudly with a clear
  message if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` aren't set, rather
  than silently starting with an empty/dev secret.
- `.env.example` — every required environment variable, with inline
  guidance (e.g. `openssl rand -base64 48` for generating real JWT
  secrets).
- `.github/workflows/ci.yml` — real Postgres + Redis services, runs
  `prisma generate` → `migrate deploy` → typecheck → lint → build →
  test (with coverage) → e2e, on every push/PR to `main`.

## What has NOT been verified, and why

**None of the above has actually been run in this project's
development environment.** `docker compose build`/`up`,
`npx prisma generate`/`migrate deploy`, and the CI workflow itself have
never executed here — the sandbox this was built in has no Docker
daemon and no network access to `binaries.prisma.sh` (see the root
README's "Known Issues," restated in every phase's changelog that
touched this). This is not a gap being glossed over: every file above
was written and reviewed carefully (Dockerfile stage-by-stage
correctness, compose health-gating logic, CI job ordering) but **"looks
correct on careful review" is a different, weaker claim than "has been
run and confirmed to work,"** and this document does not conflate the
two.

## First real deployment — a genuine checklist, not assumed to just work

1. `cd apps/api && npx prisma generate` — the very first command that
   needs to actually succeed anywhere in this project's history. If
   this fails, nothing downstream can be trusted regardless of how
   carefully the code was reviewed.
2. `npx prisma migrate dev --name init` (or `migrate deploy` against a
   pre-existing empty database) — produces the actual migration files;
   none exist yet (see `DATABASE.md`).
3. `npm run prisma:seed` — real catalog/demo-account data.
4. `npm run build && npm run test -- --coverage` — confirm the 359
   unit tests (as of Phase 12) still pass in a real environment, not
   just this sandbox's.
5. `npm run test:e2e` — confirm this actually passes. Only
   `health.e2e-spec.ts` exists as of Phase 13; this step will run
   without error but does not cover the roadmap's full E2E user-journey
   list (see this repo's production-readiness report,
   `PRODUCTION_READINESS.md`, for the honest accounting of that gap).
6. `docker compose build && docker compose up` — the actual first real
   test of the Dockerfile and compose config.
7. `curl http://localhost:3000/api/health/ready` — should report both
   Postgres and Redis as up.
8. Only after all of the above genuinely pass: consider running the CI
   workflow for real (push to a branch, watch it execute) before
   trusting it as a gate for future changes.

## Environment variables

See `.env.example` for the full list with inline documentation. Two
worth calling out specifically:

- `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` — `docker-compose.yml`
  refuses to start without these being explicitly set (no silent
  fallback to a dev value in that path); generate real random values
  (`openssl rand -base64 48`) for anything beyond local development.
- `CORS_ORIGINS` — comma-separated; must include the real frontend
  origin(s) that will call this API, or every browser request will be
  rejected by CORS regardless of authentication being otherwise
  correct.

## Rollback

No rollback tooling beyond standard `prisma migrate` mechanics exists.
Given no migration has ever actually been generated or run (see above),
this is untested in both directions, not just forward.
