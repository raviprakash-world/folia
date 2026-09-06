# Folia — Production Status

**Baseline established:** 2026-09-06 · Phase 0
**Rollback checkpoint:** `b617b9a` (origin/main, clean working tree at time of baseline)

This document is the single source of truth for "does it actually work right now."
It is regenerated at the end of every phase in `PRODUCTION_ROADMAP.md`. Nothing in
this file is claimed without having been run or read directly during this pass —
see `PRODUCTION_READINESS.md` at the repo root for why that discipline matters
here specifically (it documents claims, e.g. a working CI pipeline, that turned
out not to exist).

## Build / lint / typecheck / test — measured this session, not inherited

| Workspace | Build | Typecheck | Lint | Test |
|---|---|---|---|---|
| `apps/api` | ✅ pass | ✅ pass | ❌ **FAIL** — 34 errors, 27 warnings (`--max-warnings 0`) | ✅ 375/375 pass (unit, mocked Prisma) |
| `apps/api` (e2e) | — | — | — | ❌ **FAIL** — config bug, not an environment limitation (see below) |
| `apps/web` | ✅ pass | ✅ pass | ✅ pass | ⚠️ **NO TEST SCRIPT / NO RUNNER** |
| `packages/*` | n/a | ⚠️ only `shared-types` has a `typecheck` script; `api-client`/`shared-utils` have none | — | — |
| root (`turbo run *`) | ❌ **FAILS TO RESOLVE** — root `package.json` has no `packageManager` field, so Turbo can't resolve the workspace at all | — | — | — |

### New findings this session (not in the prior audit)

1. **Turbo can't run.** `npx turbo run build` fails immediately with `Could not resolve workspace: Missing devEngines.packageManager or legacy packageManager field`. Every `npm run <script>` at the root that delegates to Turbo (`build`, `dev`, `lint`, `test`, `test:e2e`, `typecheck`) is currently broken. Every verification in this document was run per-workspace directly instead. **Fix:** add a `packageManager` field to root `package.json` (e.g. `"packageManager": "npm@10.x.x"`). Trivial, not yet applied — deferred to whichever phase touches root tooling (candidate: Phase 8).
2. **Backend lint currently fails outright.** 34 `@typescript-eslint/no-unnecessary-type-assertion` errors + 27 unused-`eslint-disable`-directive warnings, spread across ~15 service files (`users.service.ts`, `sessions.service.ts`, `warehouses.service.ts`, `wishlist.service.ts`, `roles.service.ts`, `reviews.service.ts`, and others). Pattern suggests a TypeScript version bump narrowed types enough that old `as` assertions and their accompanying `eslint-disable` comments became unnecessary. Fixable via `eslint --fix` per the tool's own output. Not fixed in Phase 0 (inspection-only); a real gate item before any phase claims a lint-clean state.
3. **The E2E suite is broken independent of database access**, not merely "blocked by environment" as previously assumed. `test/jest-e2e.json` has no `transformIgnorePatterns` override; loading the full `AppModule` pulls in `@nestjs/event-emitter`, which ships ESM-only output, and ts-jest fails on `SyntaxError: Unexpected token 'export'`. The equivalent unit-test Jest config (in `apps/api/package.json`) has a working `transformIgnorePatterns` for `@nestjs/bullmq`/`@nestjs/bull-shared` but was never extended to cover `@nestjs/event-emitter` for the e2e config. This was verified directly: local Docker Postgres/Redis are live and reachable (`prisma migrate status` confirms schema is up to date against them), so a real DB was available and the failure is purely a Jest config gap, not an environment limitation.
4. **`packages/api-client` and `packages/shared-utils` have no scripts at all** — not even a `typecheck`. Only `packages/shared-types` does.

### Carried forward from the pre-Phase-0 audit (full detail: see the published Folia Readiness Audit artifact from this session)

- Payments, shipping, tracking, delivery-availability: **mocked**, by explicit design, both frontend and backend.
- Inventory: real schema, but checkout's actual decrement path has a confirmed, code-acknowledged race condition (no row lock / optimistic concurrency).
- Admin frontend: fully disconnected from the real, RBAC-guarded admin API — reads a client-side mock baseline instead.
- Notifications: real in-app records, zero outbound delivery channel (no email/SMS provider anywhere).
- Reviews: read-only API, no submission endpoint, all seed data.
- CI/CD: **does not exist** despite `PRODUCTION_READINESS.md` and `apps/api/CHANGELOG.md` both describing a working GitHub Actions pipeline.
- Backup/DR: no plan exists; the live production Postgres (Render free tier) auto-deletes ~30 days after creation.
- Graceful shutdown: `app.enableShutdownHooks()` is never called; Dockerfile `CMD` shape likely prevents SIGTERM from reaching Node at all.
- Zero product photography anywhere in the frontend.
- India-market shape is wrong throughout: USD currency, mock GSTIN, flat non-slab tax rate, US ZIP validation instead of Indian PIN codes.

## Live deployment state (as of this baseline)

- Frontend: `https://web-drab-mu-24.vercel.app` (Vercel, Hobby/free)
- API: `https://folia-api.onrender.com` (Render, free web service + free Postgres 16 + free Key-Value/Redis)
- `GET /api/health/ready` → `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}` (confirmed live)
- Free Postgres created ~2026-09-03, auto-deletes ~2026-10-03 without a plan upgrade.

## Git safety

- Working tree was clean before this baseline; `docs/` additions are the only change this phase.
- Rollback point: `b617b9a`.
