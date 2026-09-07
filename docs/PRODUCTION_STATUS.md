# Folia — Production Status

**Baseline established:** 2026-09-06 · Phase 0
**Last updated:** 2026-09-07 · after Phase 6 gate passed
**Rollback checkpoint (Phase 0 baseline):** `b617b9a` (origin/main, clean working tree at time of baseline)

This document is the single source of truth for "does it actually work right now."
It is regenerated at the end of every phase in `PRODUCTION_ROADMAP.md`. Nothing in
this file is claimed without having been run or read directly during this pass —
see `PRODUCTION_READINESS.md` at the repo root for why that discipline matters
here specifically (it documents claims, e.g. a working CI pipeline, that turned
out not to exist).

> **P0-A/P0-B/P0-C update (2026-09-07/08)**: a separate, later production-
> engineering pass (audit → tooling/CI → security, tracked outside this
> file's own Phase-N numbering) superseded the build/lint/test state
> this table originally described. The table below is corrected to
> match current reality; the rest of this document's Phase 1–6
> narrative (payments/shipping/refunds/admin features) is untouched by
> that pass and still describes those features' own state accurately as
> of when each was written — only the tooling/lint/CI/security facts
> below were stale.

## Build / lint / typecheck / test — corrected by P0-B/P0-C, see note above

| Workspace | Build | Typecheck | Lint | Test |
|---|---|---|---|---|
| `apps/api` | ✅ pass | ✅ pass | ✅ **0 errors, 0 warnings** (fixed P0-B — was 33 errors/20 warnings) | ✅ 830/830 pass (unit, mocked Prisma — P0-C added 13 new security-regression tests: register-throttle e2e, changePassword session revocation, seller-suspension authorization) |
| `apps/api` (e2e) | — | — | — | ✅ **FIXED (P0-B)** — 6/6 pass, including a real e2e proof that register/login/forgot-password/reset-password all genuinely return 429 on their (N+1)th request (`test/auth-rate-limit.e2e-spec.ts`, P0-C) |
| `apps/web` | ✅ pass | ✅ pass | ✅ pass | ⚠️ **NO TEST SCRIPT / NO RUNNER** (unchanged — installing one was judged out of scope for a tooling/security phase; the P0-C demo-credential regression check is instead a CI-level production-bundle grep, not a unit test) |
| `packages/*` | n/a | ⚠️ only `shared-types` has a `typecheck` script; `api-client`/`shared-utils` have none | — | — |
| root (`turbo run *`) | ✅ **FIXED (P0-B)** — `packageManager` field added, all workspaces resolve | — | — | — |
| CI | — | — | — | ✅ **NEW (P0-B)** — `.github/workflows/ci.yml`, real Postgres/Redis service containers, gates every PR + push to `main` |
| `npm audit` | — | — | — | ✅ **0 vulnerabilities** (fixed P0-B, re-confirmed P0-C) |

## Phase 1 (Payments) + Phase 2 (Inventory concurrency) — what changed

Both gates passed — see `PRODUCTION_ROADMAP.md` for the full gate reports. Net
effect on the "does it actually work" picture below:

- **Payments**: no longer mocked. Real Razorpay Orders/verification/webhook/
  refund integration exists and is unit-tested plus live-verified for COD and
  for the "gateway not configured" failure path. **The real gateway success
  path (an actual captured charge) has never been exercised** — no sandbox
  Razorpay credentials exist in this environment. Do not read "Razorpay
  integration exists" as "payments are proven to work end-to-end" — see
  `API_INTEGRATION_STATUS.md`.
- **Inventory concurrency**: the race condition called out below as a known
  gap is **fixed**. `InventoryService` now uses real `SELECT ... FOR UPDATE`
  row locking, proven live against real Postgres: two concurrent checkouts for
  a single last-unit-in-stock item resolve to exactly one order, not two.
- **Checkout is now atomic by construction**: an `Order` row only ever exists
  once payment has actually resolved (reserve → pay → confirm → commit →
  create order → clear cart), closing the "stock gone, no order" and "order
  exists, never paid" gaps the original Phase 0 audit flagged.

## Phase 3 (Customer communications) — what changed

Gate passed — full report in `PRODUCTION_ROADMAP.md`.

- **Email is no longer nonexistent.** Real Resend integration exists behind
  an `EmailService` interface, unit-tested, and live-verified for the
  *attempt* to send on every wired trigger (registration, password reset,
  checkout, cancellation) — every one succeeds normally and logs a clear
  warning with no real key configured, never breaking the request that
  triggered it. **No email has actually been delivered** — see
  `API_INTEGRATION_STATUS.md`.
- **Production password reset — previously completely broken, now fixed.**
  This was this project's single most concrete "does not work at all in
  production" finding (see the prior `SECURITY_STATUS.md` entry, now
  updated). The token was always generated correctly; nothing ever
  delivered it. It's delivered now.
- **Email verification** gets the identical backend fix, plus a frontend
  page (`/account/verify-email`) that didn't exist before — the backend
  endpoint was real but nothing on the frontend could ever complete a
  verification link.
- **Order lifecycle notifications gained email**, and the previously
  dead-code confirmed/shipped/delivered notification path (real code,
  explicitly documented as never invoked because nothing fired its event)
  is now wired to a real trigger — `OrdersService.adminUpdateStatus`.

## Phase 4 (Real admin frontend) — what changed

Gate passed — full report in `PRODUCTION_ROADMAP.md`.

- **Admin dashboards are no longer disconnected from the real backend.** A backend gap was found and closed first — `AnalyticsService` had no daily revenue/order time series and no real best/worst-seller endpoint — then all six admin pages (`Overview`, `Revenue`, `Orders`, `Products`, `Customers`, `Search`) were wired to it behind a new `VITE_REAL_ADMIN_API` flag, unit-tested and live-verified (real `curl` calls against Docker Postgres, then driven through the actual running app in a browser as the seeded admin user).
- **Every metric the real backend genuinely can't compute is honestly labeled, not fabricated.** Revenue's discount/shipping breakdown, active/new-customer counts, lifetime value, wishlist/return/co-purchase analytics, and per-search-term counts all have no real backend equivalent — real mode hides or relabels each of these ("Not yet tracked server-side") rather than rendering a fabricated zero or an empty mock-shaped table.
- **Net-new management UI that never existed before this phase**, even though the backend endpoints and audit logging were already real: order fulfillment-status changes, full product create/edit/delete (with a real category picker), and user role/deactivate management — all three live-verified end-to-end, including confirming each write produced a real `audit_logs` row.
- **A real pre-existing bug was found and fixed along the way**: the shared `Modal` component (also used by the storefront's `AddressForm`) had no scroll handling, making its submit button permanently unreachable once its content exceeded the viewport height. Fixed with `max-h-[90vh] overflow-y-auto`, confirmed live in-browser before and after.
- **Known gap, stated plainly**: the admin product-management table reuses the public catalog endpoints, which are gated by the separate `VITE_REAL_CATALOG_API` flag rather than `VITE_REAL_ADMIN_API` — both happen to be `true` in this repo's `.env`, but a deployment that sets one without the other will silently fall back to mock catalog data in the admin panel.

## Phase 5 (Shipping + fulfillment) — what changed

Gate passed — full report in `PRODUCTION_ROADMAP.md`.

- **Shipping/tracking are no longer fully simulated.** A dedicated investigation pass found zero real I/O anywhere in the shipping/tracking stack — no HTTP calls, no `Shipment` data model, courier + tracking number deterministically hashed at checkout before any real courier existed. A new `ShiprocketProvider` (behind a `ShippingProviderClient` interface, matching the existing Payment/Email provider pattern) now backs the cart-page rate estimate, trying a real Shiprocket serviceability check first and falling back to the existing heuristic on any failure — never breaking that public, unauthenticated endpoint.
- **Real net-new admin fulfillment action**: "ship this order" creates an actual shipment via the provider and only then assigns a real courier name, AWB, and tracking link — replacing the old fake, checkout-time courier assignment. `CONFIRMED → SHIPPED` was removed from the generic bare-status-flip endpoint entirely, so an admin can no longer mark an order shipped with no real shipment behind it.
- **Real schema migration, verified both ways**: `Order.courierId` moved from a fixed 5-fictional-courier Postgres enum to nullable free text (a real aggregator returns dozens of different real courier names), plus a new `trackingUrl`/`shippedAt`. Verified against the existing dev database (zero data loss — old fictional values preserved as text) and a fresh database from zero migrations.
- **Tracking is now honest about what it doesn't know**: an order with no courier assigned yet returns a genuine "awaiting fulfillment" response (only the first stage complete) instead of simulating in-transit progress for a shipment that doesn't exist.
- **A real bug was found and fixed during live verification**: the admin "ship" button's error handling let a raw Axios error through instead of the backend's actual message — the UI showed a generic "Request failed with status code 500" instead of the real "Shiprocket is not configured" text. Fixed and confirmed live in the same browser session.
- **Known gap, stated plainly**: no real Shiprocket account has ever been configured in this environment — every provider-dependent path (real rate lookup, shipment creation, tracking fetch) is unit-tested against a mocked HTTP layer and live-verified only for its "not configured"/graceful-fallback behavior. **An actual real shipment, AWB, or live tracking fetch has never been exercised.** Same honest posture as Razorpay (Phase 1) and Resend (Phase 3).

## Phase 6 (Refunds + returns + order lifecycle) — what changed

Gate passed — full report in `PRODUCTION_ROADMAP.md`; per-sub-phase design notes in `docs/PHASE_6D_MIGRATION_DESIGN.md`.

- **Refunds/cancellations/returns are no longer ad hoc.** Ten gated sub-phases (6A, 6B, 6D-1 through 6D-4H) replaced a fake cancellation-refund flip and a nonexistent return system with: a real race-safe refund/cancellation path; a from-scratch return/DOA/replacement/store-credit data model; a real return-policy engine deriving eligibility from actual order/product data; customer claim filing with evidence upload; admin approve/reject/resolve; real replacement-order creation reusing the same inventory primitives as checkout; reverse-logistics gating; safe prepaid-refund retry; notification delivery; refund-webhook reconciliation at both the payment and returns layers; and, finally, the first frontend (customer + admin) any of this ever had.
- **A real, previously-invisible bug was found and fixed via live browser verification** (not caught by any of the extensive unit-test coverage that preceded it): the old pre-Phase-6 `Order.returnRequest` field read the same database row Phase 6D's claim system now owns, through dead logic simulating a fake "refunded" status from elapsed time — actively contradicting a real claim's real status. Fixed; the dead mapping is gone.
- **A real migration-tooling incident was handled correctly, not worked around destructively.** `prisma migrate dev` offered to reset the entire dev database over unrelated pre-existing checksum drift; refused, and fixed with a targeted single-row SQL correction instead.
- **A post-gate UI gap was found and fixed while closing out this phase**: the mobile account nav had no logout control at all (desktop-only). Fixed.
- **Known gaps, stated plainly**: Razorpay webhook signature verification has still never been exercised against a real webhook (no sandbox credentials in this environment — same root cause as the Phase 1 gap); evidence-file upload was UI-verified but not exercised with a real file through the browser tool used for this pass; **none of this phase's work is merged to `main` or deployed** — the live Render deployment is still running pre-Phase-6 code.

### New findings this session (not in the prior audit)

1. **Turbo can't run.** `npx turbo run build` fails immediately with `Could not resolve workspace: Missing devEngines.packageManager or legacy packageManager field`. Every `npm run <script>` at the root that delegates to Turbo (`build`, `dev`, `lint`, `test`, `test:e2e`, `typecheck`) is currently broken. Every verification in this document was run per-workspace directly instead. **Fix:** add a `packageManager` field to root `package.json` (e.g. `"packageManager": "npm@10.x.x"`). Trivial, not yet applied — deferred to whichever phase touches root tooling (candidate: Phase 8).
2. **Backend lint currently fails outright.** 34 `@typescript-eslint/no-unnecessary-type-assertion` errors + 27 unused-`eslint-disable`-directive warnings, spread across ~15 service files (`users.service.ts`, `sessions.service.ts`, `warehouses.service.ts`, `wishlist.service.ts`, `roles.service.ts`, `reviews.service.ts`, and others). Pattern suggests a TypeScript version bump narrowed types enough that old `as` assertions and their accompanying `eslint-disable` comments became unnecessary. Fixable via `eslint --fix` per the tool's own output. Not fixed in Phase 0 (inspection-only); a real gate item before any phase claims a lint-clean state.
3. **The E2E suite is broken independent of database access**, not merely "blocked by environment" as previously assumed. `test/jest-e2e.json` has no `transformIgnorePatterns` override; loading the full `AppModule` pulls in `@nestjs/event-emitter`, which ships ESM-only output, and ts-jest fails on `SyntaxError: Unexpected token 'export'`. The equivalent unit-test Jest config (in `apps/api/package.json`) has a working `transformIgnorePatterns` for `@nestjs/bullmq`/`@nestjs/bull-shared` but was never extended to cover `@nestjs/event-emitter` for the e2e config. This was verified directly: local Docker Postgres/Redis are live and reachable (`prisma migrate status` confirms schema is up to date against them), so a real DB was available and the failure is purely a Jest config gap, not an environment limitation.
4. **`packages/api-client` and `packages/shared-utils` have no scripts at all** — not even a `typecheck`. Only `packages/shared-types` does.

### Carried forward from the pre-Phase-0 audit (full detail: see the published Folia Readiness Audit artifact from this session)

- Payments: **no longer mocked as of Phase 1** — real Razorpay integration exists; see the Phase 1/2 summary above and `API_INTEGRATION_STATUS.md` for exactly what is and isn't live-verified.
- Shipping/tracking: **the rate estimate and fulfillment are no longer mocked as of Phase 5** — real Shiprocket integration exists behind a swappable provider interface; see the Phase 5 summary above and `API_INTEGRATION_STATUS.md` for exactly what is and isn't live-verified (the real success path — an actual shipment/AWB — is not). Delivery-availability-by-postal-code (`deliveryService.checkDeliveryAvailability`, used by the checkout Delivery step and address book) remains **mocked**, with no backend endpoint at all — not touched by Phase 5, left as an explicit, honestly-stated gap for a future pass.
- Inventory: **the race condition is fixed as of Phase 2** — real `SELECT ... FOR UPDATE` row locking, live-proven against concurrent checkouts. See the Phase 1/2 summary above.
- Admin frontend: **wired to the real, RBAC-guarded admin API as of Phase 4** — see the Phase 4 summary above for exactly which metrics stayed honestly mock/unavailable rather than fabricated.
- Refunds/cancellations/returns: **no longer ad hoc as of Phase 6** — real race-safe refunds, a real return/DOA/replacement/store-credit system with admin + customer UI, reverse-logistics gating, and refund-webhook reconciliation all exist. See the Phase 6 summary above; the real Razorpay webhook success path remains unverified (same root cause as the Phase 1 gap), and none of it is merged/deployed yet.
- Notifications: real in-app records, plus a real email channel as of Phase 3 (code complete, not live-delivery-verified — see the Phase 3 summary above), extended in Phase 6 to cover return-lifecycle events. SMS still has no provider anywhere.
- Reviews: read-only API, no submission endpoint, all seed data.
- CI/CD: **fixed as of P0-B** (2026-09-07/08, see the note at the top of this document) — a real GitHub Actions pipeline now exists (`.github/workflows/ci.yml`), simulated end-to-end against ephemeral Postgres/Redis before being trusted, not just written and assumed correct. Prior to that, this bullet was accurate: `PRODUCTION_READINESS.md`/`apps/api/CHANGELOG.md` described a pipeline that didn't actually exist.
- Backup/DR: no plan exists; the live production Postgres (Render free tier) auto-deletes ~30 days after creation.
- Graceful shutdown: `app.enableShutdownHooks()` is never called; Dockerfile `CMD` shape likely prevents SIGTERM from reaching Node at all.
- Zero product photography anywhere in the frontend.
- India-market shape is wrong throughout: USD currency, mock GSTIN, flat non-slab tax rate, US ZIP validation instead of Indian PIN codes.

## Live deployment state

- Frontend: `https://web-drab-mu-24.vercel.app` (Vercel, Hobby/free)
- API: `https://folia-api.onrender.com` (Render, free web service + free Postgres 16 + free Key-Value/Redis)
- `GET /api/health/ready` → `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}` (confirmed live after Phase 1/2 merged to `main`)
- Confirmed the live deployment is actually running Phase 2's code, not stale: the old `POST /payments/orders/:orderId/retry` route returns 404 (removed in Phase 2) and the new `POST /payments/:id/retry` route returns 401 (exists, requires auth) — and since the container's own startup command is `prisma migrate deploy && node dist/main.js` (see `apps/api/Dockerfile`), a healthy DB connection here means the Phase 2 migration applied cleanly against the live production database too, not just the local dev one.
- Free Postgres created ~2026-09-03, auto-deletes ~2026-10-03 without a plan upgrade.
- **Razorpay keys are NOT set on the live Render service** (`render.yaml` declares them `sync: false`, prompted-for in the dashboard, never committed) — real card/UPI/net-banking/wallet checkout will fail loudly with "not available right now" on the live site until the business owner adds real keys there. COD works end-to-end live.
- **This section was last confirmed current as of Phase 2** (the "actually running Phase 2's code" check above) and was not re-verified for Phases 3–5. **Phase 6 is confirmed NOT live**: its branch (`feat/phase-6a-refund-race-fix`) is 15 commits ahead of `origin/main` and has never been merged, so none of the returns/refund/replacement work — or its migrations — exists on the live Render deployment.

## Git safety

- Working tree was clean before the Phase 0 baseline; `docs/` additions were the only change that phase.
- Phase 0 rollback point: `b617b9a`.
- `origin/main` currently sits at `ccf5813` (Phase 5's merge — Phases 0–5 are all merged; this line was last updated after Phase 2 and undercounted Phases 3–5, corrected here).
- Phase 6 (`93db0cc`..`c70cb9b`, 15 commits) is **not merged** — it lives on `feat/phase-6a-refund-race-fix`, 15 commits ahead of `origin/main`.
