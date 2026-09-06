# Folia — Production Status

**Baseline established:** 2026-09-06 · Phase 0
**Last updated:** 2026-09-06 · after Phase 5 gate passed
**Rollback checkpoint (Phase 0 baseline):** `b617b9a` (origin/main, clean working tree at time of baseline)

This document is the single source of truth for "does it actually work right now."
It is regenerated at the end of every phase in `PRODUCTION_ROADMAP.md`. Nothing in
this file is claimed without having been run or read directly during this pass —
see `PRODUCTION_READINESS.md` at the repo root for why that discipline matters
here specifically (it documents claims, e.g. a working CI pipeline, that turned
out not to exist).

## Build / lint / typecheck / test — measured this session, not inherited

| Workspace | Build | Typecheck | Lint | Test |
|---|---|---|---|---|
| `apps/api` | ✅ pass | ✅ pass | ❌ **FAIL** — 34 errors, 27 warnings (`--max-warnings 0`) in pre-existing files, unchanged since Phase 0; every file Phases 1–5 touched is separately confirmed lint-clean | ✅ 452/452 pass (unit, mocked Prisma; up from 375 at Phase 0 — Phases 1–5 added payments, inventory-locking, checkout-flow, email, analytics, and shipping-provider tests) |
| `apps/api` (e2e) | — | — | — | ❌ **FAIL** — same Jest config bug as Phase 0, still not fixed (out of scope for Phases 1–3) |
| `apps/web` | ✅ pass | ✅ pass | ✅ pass | ⚠️ **NO TEST SCRIPT / NO RUNNER** (unchanged since Phase 0) |
| `packages/*` | n/a | ⚠️ only `shared-types` has a `typecheck` script; `api-client`/`shared-utils` have none | — | — |
| root (`turbo run *`) | ❌ **FAILS TO RESOLVE** — root `package.json` has no `packageManager` field, so Turbo can't resolve the workspace at all | — | — | — |

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
- Notifications: real in-app records, plus a real email channel as of Phase 3 (code complete, not live-delivery-verified — see the Phase 3 summary above). SMS still has no provider anywhere.
- Reviews: read-only API, no submission endpoint, all seed data.
- CI/CD: **does not exist** despite `PRODUCTION_READINESS.md` and `apps/api/CHANGELOG.md` both describing a working GitHub Actions pipeline.
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

## Git safety

- Working tree was clean before the Phase 0 baseline; `docs/` additions were the only change that phase.
- Phase 0 rollback point: `b617b9a`.
- Current `main` after Phase 0 + Phase 1 + Phase 2 all merged: `4180b98`.
