# Folia — Production Conversion Roadmap

Tracks the 12-phase production-conversion program. One phase is active at a time;
a phase does not start until the previous phase's gate has passed and been
recorded here. See `PRODUCTION_STATUS.md` for the underlying evidence and
`API_INTEGRATION_STATUS.md` for external-provider state specifically.

Status legend: 🟡 in progress · ⏸ not started · ✅ gate passed · 🛑 gate failed (blocked)

| Phase | Name | Status | Depends on |
|---|---|---|---|
| 0 | Baseline + safety | ✅ gate passed | — |
| 1 | Payment infrastructure | ✅ gate passed (with a stated gap — see below) | Phase 0; a payment provider account + sandbox API keys from the business owner |
| 2 | Inventory concurrency + atomic checkout | ✅ gate passed | Phase 0 |
| 3 | Customer communications | 🟡 in progress | Phase 0; a transactional email provider account |
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

**Gate: passed.** Baseline established, findings documented, nothing hidden. None of Phase 0's findings blocked Phase 1/2 from starting (neither touches Turbo or the pre-existing lint debt).

## Phase 1 — Payment infrastructure

**Objective:** replace the `Math.random()` payment-decline mock with a real gateway integration (Razorpay), without ever trusting client-reported payment status.

**Done this phase:**
- Real `RazorpayProvider` (Orders API, payment/signature verification, refunds), wired behind a `PaymentProviderClient` interface.
- `PaymentsService`: COD as a genuine (never auto-"paid") payment record; gateway payments verified two independent ways — the client's Checkout.js callback (`verify()`) and the authoritative webhook (`handleWebhookEvent()`), both converging on one idempotent `confirmCapture`. Neither trusts frontend-reported status or amount; both independently re-fetch the payment from Razorpay.
- Idempotent webhook processing via a DB-unique-constraint on `providerEventId`, not an in-memory guard.
- A scheduled sweep (`expireStalePayments`) for payments that never resolve.
- Two real bugs found only by running this end-to-end against live Docker Postgres (not caught by unit tests alone): a missing Jest `transformIgnorePatterns` entry for `@nestjs/event-emitter`, and an orphaned-order/lost-stock bug on gateway-creation failure — both fixed, both now regression-tested.

**Known gap, stated plainly:** no real Razorpay sandbox credentials were ever configured in this environment. Every code path — signature verification, amount-mismatch rejection, webhook idempotency, refunds — is unit-tested against a mocked provider client, and the COD path and the "Razorpay not configured" failure path are both live-verified against real Postgres. **The actual gateway success path (a real card/UPI charge captured by Razorpay) has never been exercised.** This is IMPLEMENTED BUT UNVERIFIED, not VERIFIED, per this project's own evidence standard — it stays that way until real sandbox keys are added to `apps/api/.env` and a real Checkout.js flow is run through.

**Gate: passed, with that gap carried forward explicitly** (not silently) into Phase 2's rearchitecture and restated here rather than upgraded to VERIFIED without evidence.

## Phase 2 — Inventory concurrency + atomic checkout

**Objective:** make checkout safe under real concurrent access, and route it through a target flow of reserve → pay → confirm → commit → create order → clear cart.

**Done this phase:**
- Found and fixed the real bug: `InventoryService.reserve()`/`commitReservation()`/`releaseReservation()` were wrapped in a Prisma `$transaction` but Postgres's default READ COMMITTED isolation does not serialize concurrent access on that basis alone. Every mutation now goes through real `SELECT ... FOR UPDATE` row locking.
- Rearchitected checkout: an `Order` row is now only ever created once payment has actually resolved (`PaymentsService.confirmAndCreateOrder`), driven by a frozen `Payment.checkoutSnapshot` computed at cart time — closing both the "stock decremented, no order to show for it" and "order exists before payment resolves" gaps Phase 1 left open.
- Reservation commit + Order creation + `Payment.orderId` update share one transaction, so a crash mid-sequence can't leave inventory committed with no order behind it.
- Real Prisma migration, verified against both the existing dev database (after a one-row data-cleanup step for a leftover Phase-1-era test order) and a brand-new database from zero migrations.
- **Mandatory concurrency proof, live against real Postgres, not just mocks**: two concurrent checkout attempts for a single last-unit-in-stock item resolved to exactly one real order and zero oversell, confirmed by direct database inspection. Also live-verified: a failed gateway-payment attempt releases its reservation instead of leaking held stock; a repeated `Idempotency-Key` replays the same order rather than creating a second one; cross-user payment access returns 403.
- Frontend updated to the new contract, including two real bugs found by clicking through the live flow (not introduced by this phase, but living in this exact code path): `OrderConfirmation` never read real orders at all, and a react-router/Zustand race could redirect a successful checkout to `/cart` instead of the confirmation page.

**Known gaps, stated plainly:**
- The gateway (Razorpay) *success* path is still not live-verified — same root cause as Phase 1 (no sandbox keys configured).
- The 20-minute wall-clock reservation-expiry sweep is unit-tested with atomic conditional updates (proven race-safe against a concurrent capture), and its underlying commit/release primitives are proven live — but the scheduled job actually firing after real elapsed time was not separately observed in this session.

**Gate: passed.** All five mandatory Phase 2 gate criteria (overselling test, transaction behavior, reservation expiry logic, duplicate-checkout safety, inventory consistency) have direct evidence — see `PR #9` and its test-plan checklist for the itemized list.

## Phases 3–12 — scope reference

Full phase-by-phase scope (objective, backend/frontend/database work, required
tests, and acceptance criteria) is as specified in the governing production-
conversion brief for this project. This roadmap file tracks *status and
findings*, not a restatement of that scope — re-deriving it here would drift out
of sync with the source brief. Each phase's own gate report (appended below as
phases complete) is the authoritative record of what was actually done.

### Phase gate reports

<!-- Each completed phase appends its PHASE STATUS block below this line. -->
