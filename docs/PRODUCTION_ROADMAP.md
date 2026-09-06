# Folia — Production Conversion Roadmap

Tracks the 12-phase production-conversion program. One phase is active at a time;
a phase does not start until the previous phase's gate has passed and been
recorded here. See `PRODUCTION_STATUS.md` for the underlying evidence and
`API_INTEGRATION_STATUS.md` for external-provider state specifically.

Status legend: 🟡 in progress · ⏸ not started · ✅ gate passed · 🛑 gate failed (blocked)

| Phase | Name | Status | Depends on |
|---|---|---|---|
| 0 | Baseline + safety | 🟡 in progress | — |
| 1 | Payment infrastructure | ⏸ not started | Phase 0; a payment provider account + sandbox API keys from the business owner |
| 2 | Inventory concurrency + atomic checkout | ⏸ not started | Phase 0 |
| 3 | Customer communications | ⏸ not started | Phase 0; a transactional email provider account |
| 4 | Real admin frontend | ⏸ not started | Phase 0 (backend admin API already exists) |
| 5 | Shipping + fulfillment | ⏸ not started | Phase 2; a courier/aggregator account + API keys |
| 6 | Refunds + returns + order lifecycle | ⏸ not started | Phase 1, Phase 5 |
| 7 | Media + product catalog + India commerce | ⏸ not started | Phase 0; an object-storage (S3-compatible) account; real product photography; real GST/business details |
| 8 | DevOps + CI/CD + backups + observability | ⏸ not started | Phase 0 |
| 9 | Testing + security hardening | ⏸ not started | Phases 1–6 (tests the features they add) |
| 10 | Search + performance + SEO | ⏸ not started | Phase 0 |
| 11 | UI/UX remediation | ⏸ not started | Phases 1–7 (nothing to polish that doesn't exist yet) |
| 12 | Final production certification | ⏸ not started | All prior phases |

## Phase 0 — Baseline + safety

**Objective:** know, precisely, what currently works — not what the repo claims works.

**Done this pass:**
- Inspected git state, branch, remote, commit history — clean, `main`, up to date, rollback point `b617b9a`.
- Ran build/typecheck/lint/test for `apps/api`, `apps/web`, and `packages/*` directly (Turbo itself is broken — see finding below).
- Ran `prisma validate` and `prisma migrate status` against the real local Postgres (Docker containers from earlier work in this environment are still live) — schema valid, 2 migrations, database up to date.
- Attempted the one existing E2E spec against real local Postgres+Redis — failed on a Jest config bug, not a missing dependency.
- Created/updated the five docs this phase requires (this file plus `PRODUCTION_STATUS.md`, `ARCHITECTURE.md`, `API_INTEGRATION_STATUS.md`, `SECURITY_STATUS.md`).

**New findings this pass (not in the prior audit):**
1. Root `package.json` is missing `packageManager`, so `turbo run *` cannot resolve the workspace at all — every root-level script is currently broken.
2. `apps/api` lint fails outright (34 errors, 27 warnings) under `--max-warnings 0` — likely TypeScript-version drift making old `as` assertions unnecessary.
3. The E2E test config (`apps/api/test/jest-e2e.json`) is missing a `transformIgnorePatterns` entry for `@nestjs/event-emitter` (ESM-only) — it fails on a syntax error before ever touching the database, independent of environment availability.
4. `packages/api-client` and `packages/shared-utils` have no scripts at all, not even `typecheck`.

None of the above were fixed in this phase — Phase 0 is inspection and safety only. They are gate blockers for later phases (the Turbo fix and lint fix belong naturally to Phase 8/9; nothing in Phases 1–7 depends on either).

**Gate:** see the Phase 0 gate report delivered alongside this roadmap update.

## Phases 1–12 — scope reference

Full phase-by-phase scope (objective, backend/frontend/database work, required
tests, and acceptance criteria) is as specified in the governing production-
conversion brief for this project. This roadmap file tracks *status and
findings*, not a restatement of that scope — re-deriving it here would drift out
of sync with the source brief. Each phase's own gate report (appended below as
phases complete) is the authoritative record of what was actually done.

### Phase gate reports

<!-- Each completed phase appends its PHASE STATUS block below this line. -->
