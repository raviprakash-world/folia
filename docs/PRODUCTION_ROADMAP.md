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
| 3 | Customer communications | ✅ gate passed (with a stated gap — see below) | Phase 0; a transactional email provider account |
| 4 | Real admin frontend | ✅ gate passed | Phase 0 (backend admin API already exists) |
| 5 | Shipping + fulfillment | ✅ gate passed (with a stated gap — see below) | Phase 2; a courier/aggregator account + API keys |
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

## Phase 3 — Customer communications

**Objective:** real transactional email — no infrastructure for this existed at all before this phase (confirmed by a dedicated inspection pass: no EmailService, no provider SDK, every reference was a comment marking the gap).

**Done this phase:**
- Real Resend integration behind an `EmailService` interface (same shape as `storage.interface.ts`'s existing `StorageService` pattern) — `ResendProvider` is the only implementation, constructed lazily so the app boots with no key configured, failing loudly only at the point a real send is attempted (same convention as `RazorpayProvider`).
- **The highest-value real fix**: password reset was completely broken in production (the token was generated correctly but nothing ever delivered it — `docs/SECURITY_STATUS.md` said so explicitly). It now sends a real email regardless of environment; the dev-only token-in-response convenience is unchanged for local testing without a configured provider.
- Email verification gets the identical fix, plus a frontend page that didn't exist before this phase (`/account/verify-email`) — the backend endpoint was already there, but nothing on the frontend could ever complete the flow a verification link pointed at.
- Order lifecycle emails (placed, cancelled, return requested) reuse the exact event hooks already firing for in-app notifications — no new plumbing, just a second listener.
- Order status change (confirmed/shipped/delivered) emails required a genuinely new event: the admin status-transition endpoint worked but nothing had ever observed it (explicitly called out as dead-code-if-listened-to in the original notification listener's own comment). Now emitted from `OrdersService.adminUpdateStatus` and consumed by both the existing notification listener and the new email listener.
- Payment-failed emails off the existing (already-emitted, previously unobserved) `PAYMENT_EVENTS.FAILED` hook.
- Every email send is wrapped so a down/unconfigured provider can never break the request that triggered it (registration, checkout, cancellation, etc.) — logged and swallowed, never thrown upstream. Live-verified, not just asserted: registration, password reset, checkout, and cancellation were all exercised against the real backend (Docker, real Postgres) with no Resend key configured, and every one of them succeeded normally while logging a clear "could not send" warning.

**Known gap, stated plainly:** no real Resend API key has been configured in this environment (neither locally nor on the live Render deployment) — every email-sending code path is unit-tested against a mocked provider client, and the *attempt* to send (provider lookup, template building, error handling) is live-verified end-to-end for password-reset, email-verification, order-placed, and order-cancelled. **An actual delivered email has never been sent or received.** This is IMPLEMENTED BUT UNVERIFIED for real delivery, not VERIFIED, per this project's own evidence standard — same honest posture as Razorpay in Phase 1.

**Gate: passed, with that gap carried forward explicitly**, matching Phase 1's precedent for the same class of external-dependency gap.

## Phase 4 — Real admin frontend

**Objective:** replace the admin dashboards' mock/session-only data with the real backend, and add the order/product/user management actions that had backend endpoints but no frontend at all.

**Done this phase:**
- **Backend gap found and closed first**: `AnalyticsService` had no daily time-series or real best/worst-seller endpoint — added `getDailyOrderMetrics()` (raw-SQL `date_trunc('day', "createdAt")` grouping, since Prisma's query builder can't group by a transformed column) and `getTopSellingProducts()` (real `OrderItem.groupBy` on `quantity`, not view-event counts), plus two new `AnalyticsController` routes (`GET /analytics/daily`, `GET /analytics/top-products`). `toPublicCategory()` now includes the category `id` (previously deliberately withheld) — the admin product form's category picker needs a real id, since `AdminProductInputDto` takes one, not a slug. All net-new backend logic is unit-tested (17 passing `AnalyticsService` tests, updated `product.types.spec.ts`).
- New `VITE_REAL_ADMIN_API` flag (frontend convention: env flag + `vite.config.ts` proxy block + service layer), covering both the analytics reads and the admin management writes — one real feature from the frontend's point of view, never toggled independently, matching this repo's existing `VITE_REAL_ORDERS_API` precedent for checkout+payments.
- `useAdminAnalytics.ts` rewritten with an explicit real/mock branch per hook (`useRevenueAnalytics`, `useOrdersAnalytics`, `useProductAnalytics`, `useCustomerAnalytics`, `useSearchAnalytics`), each backed by `useQuery`. **The harder, more important part of this phase was deciding what NOT to fabricate**: the real backend has no gross/net/discount/shipping revenue breakdown (only one total per day), no active/new-customer or lifetime-value tracking, no wishlist/return/co-purchase analytics, and no per-search-term counts or click-through tracking. Every one of those is honestly omitted or relabeled in real mode — `AdminRevenue.tsx` hides the discount/shipping cards and the granularity selector (the real endpoint is daily-only) rather than showing fabricated zeros; `AdminProducts.tsx` labels the wishlist/returned/co-purchase panels "Not yet tracked server-side" instead of rendering an empty mock-shaped table; `AdminSearch.tsx` drops the count column and shows trending terms as plain badges instead of a bar chart with fake zero counts; `AdminCustomers.tsx`/`AdminOverview.tsx` swap in the real repeat-customer/repeat-purchase-rate stats in place of the mock-only active/new-customer and lifetime-value/click-through cards.
- **Net-new management UI that didn't exist at all before this phase** (this was pure UI gap — the backend endpoints, DTOs, and audit logging were already there and untouched): an order fulfillment-status changer in `AdminOrders.tsx` (forward transitions only — processing→confirmed→shipped→delivered — matching the backend's own `canTransitionStatus`, which deliberately excludes cancel/return); full product create/edit/delete in `AdminProducts.tsx` via a new `ProductForm` component (react-hook-form + zod, mirroring `AddressForm`'s established convention) in a `Modal`, with a real category picker; a user list with role toggle and deactivate in `AdminCustomers.tsx`, with a self-protection guard disabling both actions on the signed-in admin's own row.
- **Real bug found and fixed along the way**: `Modal.tsx` (a pre-existing shared component, also used by `AddressForm`) had no `max-height`/`overflow-y-auto` on its dialog panel — any form tall enough to exceed the viewport (the new product form; `AddressForm` was already at risk) made its own submit button permanently unreachable, with no scroll affordance. Fixed by adding `max-h-[90vh] overflow-y-auto` to the dialog panel. Confirmed to fix the actual failure live in-browser (see below) before and after.

**Live-verified against Docker (real Postgres), not just unit tests:**
- Backend, via direct authenticated `curl`: `GET /analytics/daily`, `GET /analytics/top-products` (both directions), `GET /categories` (now returning `id`), `PUT /admin/orders/:id/status`, `POST`/`PUT`/`DELETE /admin/products`, `PUT /admin/users/:id/role`, `DELETE /admin/users/:id` — every write confirmed to actually persist (re-fetched afterward) and to produce a real `audit_logs` row (`ORDER_STATUS_UPDATE`, `PRODUCT_CREATE`/`UPDATE`/`DELETE`, `USER_ROLE_UPDATE`, `USER_DEACTIVATE`), inspected directly in Postgres.
- Frontend, by driving the actual running app in a browser as the seeded admin user: all six admin pages load real data with the honest copy described above (confirmed via rendered page text, not just code inspection); the order table's "Mark confirmed"/"Mark shipped" action was clicked and the row's status updated in place after query invalidation; a real product was created through the new form (including the category dropdown), edited (prefill confirmed correct), and deleted through the confirm-modal flow — all three round-tripped correctly against the real backend; the user-management table's self-protection guard was confirmed disabled (via DOM inspection) specifically on the signed-in admin's own row.
- `npx tsc -b` (project-reference build mode, which caught a real `zod`/`react-hook-form` resolver type mismatch that a plain `tsc --noEmit` missed) and `vite build` both succeed; `eslint . --max-warnings 0` passes across the whole frontend.
- Test data created during verification (one product, one temporary user) was deleted afterward; the one legitimate order-status transition made during verification was left in place as real demonstrated state rather than reverted.

**Known gap, stated plainly:** the admin product-management table reuses the public `GET /products`/`GET /categories` endpoints (no separate admin list endpoint exists server-side) via `productService.ts`/`categoryService.ts`, which are gated by the separate `VITE_REAL_CATALOG_API` flag. In this repo's `.env` both flags are already `true`, so this works correctly here, but the dependency is real: if a future deployment sets `VITE_REAL_ADMIN_API=true` without also setting `VITE_REAL_CATALOG_API=true`, the product-management table and category picker will silently show mock data instead of the real catalog. Documented in code comments at the call site; not fixed structurally (would mean either a new admin-scoped list endpoint or collapsing the two flags into one, both out of this phase's scope).

**Gate: passed.** Both halves of the phase's stated scope (real dashboards, net-new management UI) are done, live-verified end-to-end, and every metric with no real backend equivalent is honestly labeled rather than fabricated.

## Phase 5 — Shipping + fulfillment

**Objective:** replace the fully-simulated shipping-rate/tracking logic with a real courier aggregator (Shiprocket, chosen per the user's explicit direction, behind a swappable provider interface so a second courier is a new class, not a rewrite), and add the real fulfillment action (assigning a courier, creating a shipment, generating a tracking number) that never existed at all — Phase 4's audit found only a bare status flip behind "mark shipped."

**Investigation first, per this project's discipline:** a dedicated read-only pass over `apps/api/src/shipping/*`, `apps/api/src/tracking/*`, and every related frontend service confirmed shipping/tracking were 100% pure, synchronous, zero-I/O computation — no real HTTP call anywhere, no `Shipment` data model (courier/tracking lived as flat scalar columns directly on `Order`), and courier + tracking number were assigned via a deterministic hash *at checkout time*, before any real courier was ever chosen. `TrackingService.simulate`'s own proof-of-delivery output literally strings the words "no real courier integration exists behind this record."

**Done this phase:**
- New `ShippingProviderClient` interface (`checkServiceability`/`createShipment`/`trackShipment`) + injection token, matching this codebase's established `PaymentProviderClient`/`EmailService` abstraction exactly. `ShiprocketProvider` is the one real implementation — Shiprocket has no official Node SDK, so this talks to its REST API directly via the platform's native `fetch` (no new HTTP-client dependency for one provider), with real email/password login, in-memory bearer-token caching, and an automatic single retry-with-fresh-login on a 401.
- `ShippingService.estimate()` (the cart-page rate widget) now tries a real Shiprocket serviceability/rate check first, falling back to the existing flat-rate heuristic on any failure or missing configuration — a public, unauthenticated, constantly-hit endpoint must never break over a missing courier account. The admin "ship this order" action deliberately does NOT get this treatment: a real, failable side effect (an actual courier shipment) must fail loudly, not silently no-op.
- **Real net-new admin fulfillment action**: `POST /admin/orders/:id/ship` creates an actual shipment via the configured provider, then — and only on success — assigns the real courier name, AWB (tracking number), and tracking link, and moves the order to SHIPPED. `CONFIRMED → SHIPPED` was removed from the generic status-only admin endpoint entirely (same reasoning this codebase already applied to CANCELLED/RETURNED: a real side effect needs a real endpoint, not a bare status PUT).
- **Real schema change, migrated correctly**: `Order.courierId` (a fixed 5-fictional-courier Postgres enum, assigned deterministically at checkout) is now free text — a real aggregator can return dozens of different real courier names — and, along with `trackingNumber`, is nullable: an Order is created the moment payment resolves, genuinely before any courier has been chosen. Added `trackingUrl` (a real deep link to the courier's own tracking page) and `shippedAt` (so tracking simulation counts from actual ship time, not order placement). Migration verified against both the existing dev database (all prior fictional courier values preserved as text, zero data loss) and a fresh database from zero migrations.
- `OrdersService.getTracking()` now returns an honest "awaiting fulfillment" response (only the first tracking stage marked complete, no fabricated in-transit progress) for any order with no courier assigned yet, instead of simulating transit for a shipment that doesn't exist.
- Frontend: `Order.courierId`/`trackingNumber` are now `string | null`; `TrackingTimeline.tsx` shows an honest "being prepared" state pre-shipment, a real "track on carrier site" link once shipped, and no longer mislabels an unrecognized real courier name as the fictional "SwiftPost" (the pre-existing `getCourier()` fallback, found and fixed during this phase). The cart-page shipping-estimate widget now validates a 6-digit Indian PIN code instead of a 5-digit US ZIP (forced by integrating a real India-only courier aggregator) — a genuinely new admin "Ship via courier" action replaces the old bare "Mark shipped" button.

**Verified so far:**
- 452/452 backend unit tests pass (up from 442), including new `ShiprocketProvider`/`ShippingService`/`OrdersService.shipOrder` coverage (real login → bearer-token flow with mocked `fetch`, the 401-retry-once behavior, every "not configured" failure path, the estimate's real-quote-vs-fallback branching, and the ship action's success/failure/wrong-status paths).
- Frontend `tsc -b`, `vite build`, and `eslint . --max-warnings 0` all pass.
- The Prisma migration itself was verified end-to-end (existing DB + fresh DB), per this project's migration discipline.

**Live-verified against Docker (real Postgres), not just unit tests** (after the host's disk-space issue was resolved and the API image rebuilt):
- The app boots clean and healthy with no `SHIPROCKET_*` variables set at all.
- `POST /shipping/estimate`: a valid 6-digit PIN returns the graceful-fallback flat rate with a clear logged warning ("Real shipping estimate unavailable, falling back to the flat-rate heuristic: Shiprocket is not configured…"); an old 5-digit ZIP now correctly rejects with 400; the free-shipping threshold still applies on top of the fallback.
- **A real end-to-end checkout** (fresh user, fresh address, real COD order) produced an Order with `courierId`/`trackingNumber`/`trackingUrl` all `null` — confirmed no courier is ever fabricated at checkout time anymore.
- `GET /orders/:id/tracking` on that unshipped order returned the honest "awaiting fulfillment" shape: only the `order-placed` stage marked complete, everything else pending, no fabricated location/ETA/proof-of-delivery.
- The admin ship action (`POST /admin/orders/:id/ship`) on a `CONFIRMED` order failed loudly with the exact "Shiprocket is not configured" error and left the order's status/courier/tracking fields completely untouched — confirmed via a direct re-fetch. Attempting to ship a `PROCESSING` order was rejected before ever reaching the provider ("must be CONFIRMED first"). The generic `PUT :id/status` endpoint now rejects `SHIPPED` outright (`"status must be one of the following values: CONFIRMED, DELIVERED"`), and the `audit_logs` table correctly shows zero `ORDER_SHIP` rows — no phantom success was ever recorded.
- Existing pre-Phase-5 orders (created before the migration, with the old fictional courier enum values) came through the migration with their `courierId`/`trackingNumber` intact as plain text, confirmed via `GET /admin/orders`.
- Frontend, driven in a real browser: the cart-page shipping estimator now asks for a "PIN code" and round-trips a real `₹6.50 shipping to 560001 — 2–4 business days` result through the real endpoint; the admin Orders page shows "Ship via courier" instead of the old bare "Mark shipped" button for confirmed orders, and clicking it surfaces the real, specific backend error inline per-row. **A real bug was found and fixed during this pass**: `adminApiService.ts`'s `shipAdminOrder` was letting the raw Axios error through instead of extracting the backend's actual message (the UI showed a generic "Request failed with status code 500" instead of "Shiprocket is not configured…") — fixed to match the same error-passthrough pattern already used by `couponService.ts`/`shippingService.ts`, and confirmed fixed live in the same browser session.
- Test data (the throwaway user, address, and order created for this pass) was deleted afterward.

**Known gap, stated plainly:** no real Shiprocket account has ever been configured in this environment — every provider-dependent code path (real rate lookup, real shipment creation, real tracking fetch) is unit-tested against a mocked HTTP layer and live-verified for its "not configured" / graceful-fallback behavior only. **An actual real shipment, AWB, or live tracking fetch has never been exercised.** This is IMPLEMENTED BUT UNVERIFIED for the real success path, not VERIFIED, per this project's own evidence standard — same honest posture as Razorpay in Phase 1 and Resend in Phase 3. Also carried forward: the admin product-management table's dependency on `VITE_REAL_CATALOG_API` (noted in Phase 4) is unrelated and unaffected; and the cart-page shipping estimate and actual checkout pricing still use two independent rate tables (noted during this phase's investigation, not unified — out of scope here).

**Gate: passed, with that gap carried forward explicitly**, matching Phase 1/3's precedent for the same class of external-dependency gap.

## Phases 6–12 — scope reference

Full phase-by-phase scope (objective, backend/frontend/database work, required
tests, and acceptance criteria) is as specified in the governing production-
conversion brief for this project. This roadmap file tracks *status and
findings*, not a restatement of that scope — re-deriving it here would drift out
of sync with the source brief. Each phase's own gate report (appended below as
phases complete) is the authoritative record of what was actually done.

### Phase gate reports

<!-- Each completed phase appends its PHASE STATUS block below this line. -->
