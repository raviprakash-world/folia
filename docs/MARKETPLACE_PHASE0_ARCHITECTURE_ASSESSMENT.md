# Folia Marketplace — Phase 0 Architecture Assessment

**Status:** reconnaissance only. No application code was modified to produce this
document — per the governing brief's Phase 0 rule, this is inspection output,
not implementation. This is a **new initiative**, separate from the existing
12-phase `PRODUCTION_ROADMAP.md` (which is mid-flight at Phase 6/Phase 7) — its
own Phase 0–23 numbering, as given in the brief, is used throughout this
document and any future marketplace work, and is not the same numbering as
`PRODUCTION_ROADMAP.md`'s Phases 1–12. The two efforts touch overlapping code
(Product, Order, Payment) and should be reconciled explicitly before Phase 1
starts writing migrations — see §11.

Evidence for this assessment: a full direct read of `apps/api/prisma/schema.prisma`
(1369 lines, all 40 models/enums), plus two focused research passes across
`apps/api/src/*` (RBAC, storage, payments, shipping, notifications, audit, test
inventory) and `apps/web/src/*` (product/cart/checkout, admin pattern, design
tokens, auth store, service/hook conventions).

---

## 1. Current architecture

**Backend:** NestJS 11 modular monolith, one module per business domain
(`products`, `orders` — which also owns cancellation/returns/tracking,
`payments`, `cart`, `inventory`, `shipping`, `notifications`, `email`, `audit`,
`roles`/`auth`, `storage`, `analytics`, `search`, `recommendations`,
`warehouses`, `wishlist`, `categories`, `coupons`, `sessions`, `users`,
`addresses`, `health`, `jobs`, `tracking`). Single Prisma schema, single
PostgreSQL database — no multi-tenancy, no per-tenant schema/database
separation anywhere. Redis backs BullMQ jobs and the throttler.

**Authentication/RBAC:** JWT access token + hashed-refresh-token `Session`
rows; `JwtStrategy.validate()` re-queries the DB on every request (not just
decoding the JWT) so a role change or deactivation takes effect immediately.
`Role`/`Permission` are real, seeded, many-to-many DB rows — never free-text
strings compared ad hoc. Two decorators: `@Roles(...)` (checked by
`RolesGuard` against a *single* `user.role` string) and
`@RequirePermissions(...)` (checked against the flattened permission set from
the user's one `Role`). `RolesGuard` passes through unrestricted when neither
decorator is present — it only *narrows* on top of the separate, global
"must be authenticated" guard.

**Ownership scoping** (whose orders/payments/addresses can a request see) is
**hand-rolled per service**, not a generic guard: every customer-facing
controller method takes `@CurrentUser() user` and threads `user.id` into the
service call (`ordersService.findAllForUser(user.id)`,
`paymentsService.findOwnedOrThrow(id, user.id)`, etc.). A wrong-owner lookup
returns the same 404 as "doesn't exist" — never a distinguishing error, by
explicit convention (see `orders.controller.ts`'s own doc comment). **There is
no generic ownership-guard abstraction to reuse** — this pattern must be
hand-replicated for sellers, exactly as it already is for buyers.

**Payments:** `PaymentProviderClient` interface
(`createOrder`/`verifyPaymentSignature`/`fetchPayment`/`refund`/`verifyWebhookSignature`),
one real implementation (`RazorpayProvider`), COD handled by branching
directly in `PaymentsService` (deliberately not behind the interface — COD
never makes a real gateway round-trip). Checkout order is
**Reserve → Pay → Confirm → Commit → Create Order → Clear Cart**: a `Payment`
row is created first (idempotency-anchored on `(userId, idempotencyKey)`), and
an `Order` row is created **only once payment is confirmed**
(`confirmAndCreateOrder`) — there is no "order exists but unpaid" state.
Capture is race-safe via an atomic conditional `updateMany` (not
read-then-write), verified independently against Razorpay's own API (never
trusting the frontend callback's status/amount). Webhook dedup is a real DB
unique constraint on `providerEventId` — not an in-memory guard, so it's safe
across multiple server instances. Refund claims are reserved (`PENDING`)
*before* the external gateway call, so two concurrent refund requests can't
together claim more than the payment's remaining refundable amount; a crash
between "gateway succeeded" and "local row updated" is recoverable via
`reconcileRefundEvent`, triggered by Razorpay's own refund webhooks, matching
conservatively by `(payment, exact pending amount)` and backing off (never
guessing) when more than one candidate matches.

**Inventory:** real `SELECT ... FOR UPDATE` row locking on `InventoryItem`,
proven live against concurrent checkouts (Phase 2 of the existing roadmap). A
`StockReservation` row (with `referenceType: CART | ORDER | PAYMENT` +
`referenceId`) represents a hold; commit/release are both atomic conditional
updates.

**Returns (existing Phase 6D):** `ReturnRequest` (one per order, admin-decided
status machine) + `ReturnRequestItem` (partial-quantity, per-order-line
claims) + `ReturnEvidence` + `StoreCreditEntry` (a real, append-only,
derive-don't-cache ledger — the closest existing precedent for the seller
ledger this initiative needs). Three resolution types (`REFUND`,
`REPLACEMENT`, `FOLIA_STORE_CREDIT`), a frozen-at-approval-time
`refundAmount`, a dedicated `refundAttemptState` enum for safe prepaid-refund
retry, and webhook reconciliation at **both** the payment layer
(`PaymentsService.reconcileRefundEvent`) and the returns layer
(`ReturnsService.handlePaymentRefunded`, closing a documented crash-recovery
gap).

**Shipping:** `ShippingProviderClient` interface
(`checkServiceability`/`createShipment`/`trackShipment`), real
`ShiprocketProvider`. **Load-bearing constraint for this initiative:**
`createShipment`'s input already takes an `items: ShipmentItem[]` array (not
a whole-Order reference — the interface itself doesn't prevent a partial
shipment), but the **persistence layer assumes exactly one shipment per
order**: `courierId`/`trackingNumber`/`trackingUrl`/`shippedAt` are singular
scalar columns directly on `Order`, and `OrdersService.shipOrder()` is
written as a single `CONFIRMED → SHIPPED` transition over the *entire* order.
Multi-seller shipment splitting needs real schema + service work here, not a
parameter change (detailed in §6).

**Notifications/email:** `@nestjs/event-emitter`'s `EventEmitter2`. One
real occurrence emits one event; independent listener classes
(`NotificationEventListener`, `EmailEventListener`) both subscribe to the
same event name — adding a new channel is a new listener class, not a change
to the emit site. Convention: a dedicated `<module>.events.ts` file exporting
a `'notification.<snake_case>'` string constant + a paired `XxxPayload`
interface, with zero imports from the module that will consume it (so any
emitter has no hard dependency on any listener).

**Audit:** `AuditService.log({ actorId, action, resource, resourceId?,
metadata?, ipAddress? })` — free-text `action`/`resource` strings (not
enums), automatic secret-scrubbing on `metadata`, and a design that never
throws (a logging failure must never break the real request it's auditing).

**Storage:** `StorageService` interface (`upload`/`delete`), one real
implementation (`LocalStorageService`, explicitly designed as an
S3-swappable abstraction — the doc comment frames this directly). Two current
consumers: avatar upload (loose validation — MIME-type prefix only) and
return-evidence upload (strict — MIME + extension + **magic-byte signature**
all cross-checked, 10MB/file, 5 files max, via `evidence-file.util.ts`). The
evidence path, not the avatar path, is the correct template to copy for
seller-submitted images/documents.

**Frontend:** Vite + React 18 + TypeScript. Single route table
(`routes/index.tsx`) with `lazy()` + `Suspense`. One axios `apiClient`
singleton (`withCredentials`, Bearer token, one-shot 401 refresh-retry
interceptor). TanStack Query for all server state; Zustand for local/ephemeral
state (theme, some mock-mode state). A real/mock dual-implementation
convention gated by `VITE_REAL_*_API` env flags threads through nearly every
domain — both flags are `true` in this repo's `.env` today. Tailwind v4,
CSS-first (`@theme` block in `index.css`, no `tailwind.config.*` file), dark
mode via a `.dark` class + `@custom-variant`, no component library — a small
set of hand-built primitives (`Button`, `Modal`, `Tag`, `Alert`, `FormField`,
`TableWidget`, `Pagination`) used everywhere. Admin pages follow one
consistent shape: a list page (`TableWidget` + one `useMutation` per row
action + `queryClient.invalidateQueries`) and a detail page (one custom hook
returning the entity plus exposed mutations, `Modal`-based action forms).

**The single-vendor assumption is baked in at the type level, throughout:**
`Product` has no vendor/seller field at all (`grep` for
`vendor|brand|seller` across the whole frontend `src/` returns nothing
product-related). `CartItem` has no `sellerId`. `Order` is modeled as one
indivisible shippable unit (singular `courierId`/`trackingNumber`/
`status` columns). The checkout `POST /checkout` payload carries no
line-item/seller breakdown at all — the backend reads the cart server-side
and the frontend payload is just address/delivery/payment selections. None
of this is a defect — it's a correct, deliberate design for a single-seller
storefront — but it means the marketplace initiative is a real, structural
extension in the order/checkout/shipping seam, not just an additive feature
bolted on the side.

---

## 2. Existing reusable components — what to build ON, not around

| Concern | Reuse directly | Notes |
|---|---|---|
| RBAC seeding | `Role`/`Permission` upsert pattern in `seed.ts` | Additive: new `PERMISSIONS` entries + a `SELLER_PERMISSIONS` array + one more `role.upsert({ name: 'seller', ... })`. Zero schema change — `Role`/`Permission` are already name-keyed many-to-many. |
| Role-gating | `@Roles('seller')` + `RolesGuard` | Works immediately, zero guard code changes, same as `@Roles('admin')` today. |
| File uploads | `StorageService` (`STORAGE_SERVICE` DI token) | Reuse as-is for seller logos/product images/verification docs — just a new `directory` value (`'seller-logos'`, `'seller-verification'`, etc.). Copy `evidence-file.util.ts`'s magic-byte validation pattern, not the looser avatar path — seller-submitted files are untrusted input at the same trust level as return evidence. |
| Payments | `PaymentProviderClient`, `RazorpayProvider`, `PaymentsService` | Reused **unmodified** for the marketplace — see §7. Commission/payout are downstream bookkeeping on top of a payment that still settles to Folia's own Razorpay account in one piece; they are not a second payment integration. |
| Inventory | `InventoryService` reserve/commit/release, row-locked `InventoryItem` | A seller's inventory is just `InventoryItem` rows whose `Product` happens to have `ownerType: SELLER_OWNED` — no second inventory mechanism, no schema change needed here at all. |
| Events | `EventEmitter2` + `<module>.events.ts` convention | New constants (`SELLER_APPLIED`, `SELLER_APPROVED`, `PRODUCT_SUBMITTED`, `PRODUCT_APPROVED`, …) + one `@OnEvent` handler per existing listener class. |
| Audit | `AuditService.log()` | Free-text `action`/`resource` already fits — `action: 'SELLER_APPROVED', resource: 'seller'` needs no service change. |
| Admin UI shape | List+detail page pattern, `TableWidget`, `Pagination`, `Modal`-based actions | `AdminSellers.tsx`/`AdminSellerDetail.tsx` follow `AdminReturns.tsx`/`AdminReturnDetail.tsx` almost line for line. |
| Design system | All existing tokens/components | Zero new design system work — dark mode, responsive rules, `Button`/`Tag`/`Modal`/`Alert`/`FormField` all apply unchanged. |
| Read-mapping pattern | `ReturnsService.toAdminRecord()` + `getMyClaim()`'s destructure-and-strip technique | Exact template for a `toAdminSellerRecord()`/`toPublicSellerRecord()` pair — one mapping function, admin gets everything, public/customer views destructure out the sensitive fields (bank info, verification docs, internal notes) rather than maintaining two parallel queries. |
| Notifications/email | `NotificationEventListener`, `EmailEventListener` | New `@OnEvent` handlers for seller lifecycle events, same one-event-many-listeners shape. |

**Nothing reusable exists for:** non-admin resource ownership scoping (no
generic guard — see §10), multi-shipment-per-order persistence (singular
columns on `Order` — see §6), or admin-surface test coverage (there are
**zero** `admin/*.spec.ts` files today — a seller-approval admin flow starts
that convention from scratch, not by following one).

---

## 3. Required schema changes

All additions below are **additive and nullable-safe** — no existing column
is removed or narrowed, per the brief's non-destructive-migration rule (full
migration-risk detail in §11).

**New models:**

- **`Seller`** — `id`, `userId` (1:1 → `User`), `slug` (unique, for
  `/sellers/:slug`), `displayName`, `description`, `logoUrl?`,
  `contactEmail`, `contactPhone`, `status: SellerStatus`, `appliedAt`,
  `approvedAt?`, `suspendedAt?`, `createdAt`, `updatedAt`.
- **`SellerStatus` enum** — `APPLIED | UNDER_REVIEW | APPROVED | ACTIVE |
  SUSPENDED | DEACTIVATED` (exactly the brief's lifecycle).
- **`SellerVerification`** — `id`, `sellerId`, `documentType`, `documentUrl`
  (via `StorageService`, **never** returned by any public/customer API),
  `status`, `reviewedBy?`, `reviewedAt?`, `note?`. Kept as its own table
  (not columns on `Seller`) so a routine `GET seller profile` never
  incidentally joins in verification-document URLs.
- **`SellerAddress`** — mirrors `Address`'s existing shape (business address,
  not a customer shipping address) — reuse the same field set rather than
  inventing a second address shape.
- **`SellerBankAccount`** — **deliberately minimal**, see §9's payout
  strategy for why this must NOT store a raw account number if it can be
  avoided.
- **`SellerCommission`** — `id`, `sellerId?` (null = marketplace default),
  `ratePercent: Decimal`, `effectiveFrom`, `createdAt`. **Versioned, never
  mutated in place** — a rate change is a new row, not an `UPDATE`, matching
  this schema's existing "never silently alter a historical record" pattern
  (`ReturnRequest.refundAmount` is frozen at approval for the identical
  reason). The rate actually charged is resolved once at order-creation time
  and frozen onto the order (see below) — never recomputed later even if the
  configured rate subsequently changes.
- **`SellerLedgerEntry`** — `id`, `sellerId`, `type: SALE | COMMISSION |
  REFUND | ADJUSTMENT | PAYOUT`, `amount: Decimal` (signed), `referenceType`
  + `referenceId` (a polymorphic pointer — reusing `StockReservation`'s
  existing `referenceType`/`referenceId` convention — since a ledger entry's
  source varies: an order-item sale, a return refund, a payout, a manual
  admin adjustment), `createdAt`. **A seller's balance is
  `SUM(amount) WHERE sellerId = ...`, computed on read — never a cached
  `seller.balance` column** (the brief is explicit about this; it also
  matches `StoreCreditEntry`'s existing derive-don't-cache design exactly).
- **`SellerPayout`** — `id`, `sellerId`, `status: PENDING | PROCESSING |
  PAID | FAILED | CANCELLED`, `amount`, `idempotencyKey`, `createdAt`,
  `processedAt?`, `failureReason?`.
- **`SellerPayoutItem`** — `id`, `payoutId`, `ledgerEntryId` (unique — a
  ledger entry can be claimed by at most one payout, enforced at the DB
  level, the same idempotency-via-unique-constraint idiom
  `StoreCreditEntry.returnRequestId` already uses).

**New enum:**

- **`ProductOwnerType`** — `FOLIA_OWNED | SELLER_OWNED`.
- **`ProductApprovalStatus`** — `DRAFT | SUBMITTED | UNDER_REVIEW | REJECTED
  | APPROVED | ACTIVE | ARCHIVED` (exactly the brief's product lifecycle).

**Extended existing models:**

- **`Product`** gains `sellerId String?` (nullable FK → `Seller`, **never**
  silently ownerless — see backfill strategy below), `ownerType
  ProductOwnerType` (default `FOLIA_OWNED` for the migration, so every
  existing row is unambiguous immediately, never null/undetermined), and
  `approvalStatus ProductApprovalStatus` (default `ACTIVE` for the same
  reason — an existing live product is, by definition, already
  approved/active; it does not re-enter moderation on migration day).
  `rejectionNote String?` for the admin reject/request-changes flow.
- **`OrderItem`** gains `sellerId String?` (a **snapshot**, denormalized —
  matching this model's existing philosophy exactly: `name`/`price`/
  `categorySlug` are already point-in-time snapshots on this row for the
  identical reason, so a later change to a product's ownership never
  retroactively rewrites a past order's attribution) and
  `commissionRatePercent Decimal?` + `commissionAmount Decimal?` (frozen at
  order-creation time — the actual rate charged for this line, never
  recomputed if `SellerCommission` later changes).
- **`User`** gains an optional `seller Seller?` back-relation. **`role`
  gains a `'seller'` value** — see §10 for why this is additive-safe rather
  than a breaking change to the existing `'customer' | 'admin'` union, and
  why it does not block a seller from also shopping as a normal customer.

**New per-seller fulfillment entity (the order-splitting seam — full
reasoning in §6):**

- **`OrderSellerGroup`** — `id`, `orderId`, `sellerId String?` (**null**
  represents the Folia-fulfilled portion of the order, using the exact same
  nullable-ownership convention as `Product.sellerId` — this avoids a
  separate code path for "Folia's own items" vs. "a seller's items"),
  `status` (mirrors `OrderStatus`'s existing values —
  `PROCESSING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED/RETURNED`, scoped to
  just this group's items), `courierId?`, `trackingNumber?`, `trackingUrl?`,
  `shippedAt?`, `subtotal` (this group's item subtotal), `commissionTotal`,
  `sellerEarning`. `OrderItem` gains `orderSellerGroupId String?` — every
  order-item belongs to exactly one group (its own seller's group, or the
  null-seller Folia group).

This design means: a single-seller-cart order (the current, 100%-Folia
common case, and the only case that exists until Phase 5 of this initiative
ships) produces exactly one `OrderSellerGroup` row with `sellerId: null` —
**structurally identical in shape to today's single-shipment order**, just
represented through the new table instead of scalar columns directly on
`Order`. This is the backward-compatibility hinge point — detailed in §12.

---

## 4. Required API changes

**New seller-facing controllers** (all deriving identity server-side via a
new `@CurrentSeller()` decorator — see §10, never accepting a client-supplied
`sellerId`):

- `POST /sellers/apply`, `GET /sellers/me`, `PATCH /sellers/me` (profile,
  while status allows editing)
- `POST /sellers/me/products`, `PATCH /sellers/me/products/:id`,
  `POST /sellers/me/products/:id/submit`, `POST
  /sellers/me/products/:id/archive`, media upload endpoints reusing
  `StorageService`
- `GET /sellers/me/orders`, `GET /sellers/me/orders/:groupId` (scoped to
  `OrderSellerGroup`, never the full parent `Order` — a seller must never see
  another seller's line items on the same customer order)
- `GET /sellers/me/returns` (return claims touching this seller's order
  items only)
- `GET /sellers/me/ledger`, `GET /sellers/me/payouts`

**New public endpoints:**

- `GET /sellers/:slug` (storefront — active seller + active products only)
- Product listing/detail endpoints gain an optional `sellerId`/`sellerSlug`
  filter, and (after the backfill in §3) a uniform
  `WHERE approvalStatus = 'ACTIVE'` filter applies to **every** product read,
  Folia-owned or seller-owned alike — no owner-type branch needed in the
  query itself.

**New admin endpoints** (mirroring `admin-returns.controller.ts`'s existing
shape exactly): seller list/detail/approve/reject/suspend/reactivate; product
moderation queue/approve/reject/deactivate; seller finance views (earnings,
commission, payouts, payout failures) — all `@Roles('admin')`, all
`AuditService.log()`-backed.

**Changed existing endpoints:**

- `POST /checkout` — no payload shape change (the backend already reads the
  cart server-side); the *response* and the *order-creation logic* change to
  produce `OrderSellerGroup` rows instead of writing courier/tracking fields
  directly onto `Order` (this is the one genuinely structural touch to the existing
  checkout code path — see §6 for exactly how it stays atomic).
- `POST /admin/orders/:id/ship` — becomes `POST
  /admin/orders/:orderId/groups/:groupId/ship` (Folia's own admin can still
  ship the Folia-fulfilled group of a mixed order); a new seller-scoped `POST
  /sellers/me/orders/:groupId/ship` covers a seller shipping their own group.
  Both call the same underlying `ShippingService`/`ShippingProviderClient` —
  no new shipping integration, just a narrower target than "the whole
  order."
- `GET /orders/:id` (customer-facing) — the response gains a per-group
  breakdown (courier/tracking/status per seller) instead of one flat
  courier/tracking pair, so `AccountOrderDetail` can render "grouped by
  seller fulfillment" as the brief requires.

---

## 5. Required frontend changes

**New seller dashboard** (`/seller`, `/seller/profile`, `/seller/products`,
`/seller/products/new`, `/seller/products/:id`, `/seller/orders`,
`/seller/orders/:id`, `/seller/returns`, `/seller/earnings`,
`/seller/payouts`, `/seller/settings`) — built from the exact same primitives
as the existing admin dashboard: `sellerApiService.ts` (flag-gated, following
the `...ApiService.ts` convention since this is genuinely new functionality
with no mock path to shadow), `useSellers.ts`/`useSeller.ts`/
`useAdminSellers.ts` hooks (one file per domain, mirroring
`useAdminReturns.ts`'s shape — entity query plus exposed mutations), list
pages using `TableWidget`, detail pages using the `Modal`-based action-form
pattern. A parallel `ProtectedRoute requireRole="seller"` gate, protecting
`/seller/*` the same way `requireRole="admin"` protects `/admin/*` today.

**Auth store / route protection:** `User.role` widens from
`'customer' | 'admin'` to `'customer' | 'admin' | 'seller'`
(`types/auth.ts`), and `ProtectedRoute`'s `requireRole` prop widens from the
literal `'admin'` to `User['role']` — both trivial, additive one-line type
changes per the frontend research; **no runtime logic changes** (the
`user.role !== requireRole` check already works generically).

**Product types/pages:** `Product` gains `sellerId?`/`sellerName?`/
`sellerSlug?` (matching how `categorySlug` already sits denormalized on the
type) — `ProductDetail.tsx` gets a "Sold by {seller}" block, inserted the
same way `careLevel`'s metadata line already is, linking to the seller's
storefront.

**Cart:** `CartItem` gains `sellerId?`/`sellerName?`; `Cart.tsx` groups the
existing flat list into one section per seller (Folia's own items forming an
implicit "sold by Folia" group at the top) — a rendering change, not a new
state model, since Zustand/TanStack Query already hold the full item list.

**Checkout/orders:** `CheckoutReview.tsx`'s single-order confirmation screen
gains a per-seller cost breakdown (still one payment, one Razorpay session —
see §7); `AccountOrders.tsx`/`AccountOrderDetail.tsx` render the new
per-`OrderSellerGroup` tracking/status breakdown instead of one flat
courier/tracking pair — the existing `TrackingTimeline` component is
reused per group rather than once per order.

**New public storefront page** `/sellers/:slug` — a new page component
following `Category.tsx`'s existing shape (hero + filtered product grid),
not a new pattern.

**Design system:** zero new tokens/components required — every listed page
is buildable entirely from the existing `Button`/`Modal`/`Tag`/`Alert`/
`FormField`/`TableWidget`/`Pagination` set, dark-mode-safe automatically since
none of them hardcode colors outside the existing CSS-variable tokens.

---

## 6. Order-splitting strategy

**The core design decision, stated plainly:** one customer checkout produces
**one `Order` row** (preserving the customer's order history exactly as it
reads today — the brief is explicit that multiple confusing unrelated orders
must not appear), which owns **one or more `OrderSellerGroup` rows** — one
per distinct seller present in the cart, plus one `sellerId: null` group for
any Folia-owned items. This is not a new concept layered awkwardly on top of
the existing model — it's the natural generalization of what `Order`
already almost is: today's single-shipment order is exactly the `sellerId:
null`-only case of this design, which is why §3 verified the backward-
compatible shape holds.

**Checkout stays atomic, unmodified in its outer shape.** The existing
Reserve → Pay → Confirm → Commit → Create Order → Clear Cart sequence
(`PaymentsService`/`OrdersService.confirmAndCreateOrder`) is preserved
exactly; the only change is *what* gets written inside the existing "create
order" transactional step: instead of one `Order` with flat courier fields,
that same transaction now also inserts N `OrderSellerGroup` rows (grouping
`checkoutSnapshot`'s line items by `sellerId`) and stamps each `OrderItem`
with its `orderSellerGroupId`. **This does not add a new failure mode**: the
existing all-or-nothing transaction boundary already covers "some items
succeed, some don't" for inventory reservation (Phase 2's existing
guarantee) — grouping the same already-reserved, already-paid-for items into
seller buckets inside that same transaction cannot itself fail in a way that
leaves a partial charge, because payment has already been confirmed *before*
this step even runs (per the existing Reserve→Pay→Confirm ordering). If one
seller's item genuinely cannot be fulfilled (e.g., a stock race lost between
reservation and commit), that is caught by the *existing* inventory-commit
failure path — before payment confirmation, not after — exactly as it is
today for a single-seller cart. Multi-seller does not introduce a new
"partially charged" scenario; it only changes how the successfully-paid
result is bucketed for display and downstream fulfillment.

**Shipment fan-out:** each `OrderSellerGroup` gets its own
`courierId`/`trackingNumber`/`shippedAt`, populated independently — a
seller ships their own group via the same `ShippingProviderClient`
(`createShipment` already accepts a bounded `items` array, so passing only
that group's items is a natural fit, not a reinterpretation of the
interface), and Folia's own admin still ships the `sellerId: null` group the
same way `shipOrder()` works today. The customer sees N independent tracking
timelines on one order page (§5) — understandable, per the brief's explicit
requirement, because it mirrors how real marketplaces (Amazon Marketplace,
Flipkart) already present exactly this.

---

## 7. Payment strategy

**One payment, one Razorpay order, unchanged.** The brief is explicit that
"do NOT require separate payments merely because sellers differ unless the
existing architecture makes that unavoidable" — it is not unavoidable here.
`PaymentProviderClient`/`RazorpayProvider`/`PaymentsService` are reused
**entirely unmodified**: the customer pays Folia's own Razorpay account once,
for the full cart total, exactly as today. Commission/seller-earning
splitting is a **downstream bookkeeping operation** (§8/§9) against that one
settled payment — not a second payment integration, not N separate gateway
orders, and not Razorpay Route (a real split-settlement product Razorpay
offers, which would let individual sellers receive gateway-level payouts
directly) — Route is a legitimate *future* upgrade path worth naming, but it
requires its own separate Razorpay product enrollment/KYC per seller that is
out of this initiative's current scope and would need explicit business
sign-off before adoption; it is not assumed or partially built here.

**§7's Razorpay-completion requirements** (order creation, signature
verification, webhook processing, refund state machine, reconciliation) are
**already substantially implemented**, per §1 — this initiative's Phase 7
work is closing the one already-documented, already-acknowledged gap (the
real gateway *success* path has never been exercised against real sandbox
credentials, carried forward honestly through Phases 1/3/5/6 of the existing
roadmap) rather than building the payment state machine from scratch. The
brief's required state list (`CREATED/PENDING/AUTHORIZED/CAPTURED/FAILED/
REFUNDED/PARTIALLY_REFUNDED/CANCELLED`) should be reconciled against the
**existing** `PaymentStatus` enum (`CREATED/CAPTURED/FAILED/EXPIRED/
COD_PENDING/COD_COLLECTED/REFUNDED/PARTIALLY_REFUNDED/NO_CHARGE`) rather than
replaced — per the brief's own instruction ("use the existing enum if
already equivalent... do not invent states blindly"), `EXPIRED` already
covers `CANCELLED`'s intent for this codebase's actual flow (no order exists
until payment confirms, so there is nothing to "cancel" pre-capture, only to
let expire), and `AUTHORIZED`/`PENDING` are not meaningfully distinct states
in Razorpay's own capture-on-verify model as currently integrated. This
needs a short explicit confirmation with you before Phase 7 starts, rather
than silently keeping or silently adding states.

**The refund state-machine requirement** (`NOT_STARTED/IN_PROGRESS/
SUCCEEDED/FAILED_RETRYABLE/UNKNOWN`) is **already built**, again under
different but equivalent names: `RefundStatus` (`PENDING/PROCESSED/FAILED`)
plus the Phase 6D-4E-added `ReturnRefundAttemptState`
(`NONE/IN_PROGRESS/FAILED_RETRYABLE`) together cover exactly this brief's
model — a `PENDING` `Refund` row reserved before the gateway call already is
this system's "in-flight, can't safely assume dead" state, and
`reconcileRefundEvent`'s conservative multi-candidate backoff already is its
`UNKNOWN`-recovery path. **No blind refund retry exists anywhere in the
current code** — confirmed directly in §1.

---

## 8. Commission strategy

Server-side only, per the brief's explicit prohibition on frontend
calculation. `SellerCommission` (§3) resolves a rate — seller-specific
override if one exists for that seller, else the marketplace default row
(`sellerId: null`) — **at order-creation time**, inside the same transaction
that writes `OrderSellerGroup`/`OrderItem`. The resolved
`commissionRatePercent` and computed `commissionAmount` are frozen onto each
`OrderItem` and rolled up onto its `OrderSellerGroup.commissionTotal` — never
recomputed later, even if the configured rate subsequently changes (the same
"frozen at decision time" philosophy `ReturnRequest.refundAmount` already
uses, and for the identical reason: a historical order's commission must stay
accurate to what was actually charged when it happened). No percentage is
hardcoded in application code; the marketplace-default rate is itself a real
`SellerCommission` row (seeded, admin-editable), not a constant.

---

## 9. Payout strategy

**Ledger and payout domain: fully implementable now, with real persisted
state.** `SellerLedgerEntry` rows (`SALE`, `COMMISSION`, `REFUND`,
`ADJUSTMENT`, `PAYOUT`) are written at the real triggering moments (order
confirmed → `SALE` + `COMMISSION` entries per seller group; a seller-funded
refund resolves → `REFUND` entry; an admin adjustment → `ADJUSTMENT`); a
seller's balance is always `SUM(amount)`, never a mutable cached field, per
the brief's explicit rule. `SellerPayout`/`SellerPayoutItem` give payouts a
real, explicit, idempotent lifecycle (`PENDING/PROCESSING/PAID/FAILED/
CANCELLED`), with `SellerPayoutItem` claiming specific ledger entries via a
unique constraint so the same entry can never be paid out twice.

**Real bank-to-seller money movement: credential-blocked, stated plainly, not
faked.** No payout provider account exists in this environment (this project
has never had one — it is a genuinely new integration, unlike Razorpay/
Shiprocket/Resend, which merely lack *sandbox keys* for already-integrated
providers). Two honest paths exist, to put to you rather than assume:

1. **RazorpayX / Razorpay Route** — since Razorpay is already this
   codebase's integrated PSP, its own payout products are the natural fit,
   and (for Route specifically) would let a seller's payout be tokenized as
   a "linked account" that Razorpay itself holds — meaning **this
   application would never need to store a raw bank account number at
   all**, only Razorpay's own linked-account reference id. This is the
   design this assessment recommends, contingent on you actually enrolling
   for that product.
2. A separate payout provider/manual bank transfer process — would need its
   own provider abstraction (mirroring `PaymentProviderClient`'s existing
   shape) and its own credentials.

Until one of those is configured, `SellerBankAccount` should store **only
what a human admin needs to manually verify/initiate a transfer outside this
system** — account holder name, bank name, masked account number (last 4
digits) and IFSC, no full account number persisted at all unless/until a
real tokenizing provider is wired in. This is the concrete, honest
application of the brief's own instruction: *"If payout credentials are
unavailable: implement the ledger/payout domain safely, clearly mark actual
money movement as credential-blocked, do not fake success."* A `SellerPayout`
can reach `PENDING`/`PROCESSING` (an admin has initiated it) but a real
`PAID` transition requires either a configured provider webhook or an
explicit manual admin confirmation — never a timer, never an automatic
success.

---

## 10. Seller isolation strategy

**This is the one place the existing codebase has no reusable abstraction at
all** (§1/§2's most important finding) — it must be built, carefully, as
this initiative's own primitive, but following the *shape* of every existing
ownership check exactly.

**Identity derivation:** a new `@CurrentSeller()` param decorator (mirroring
`@CurrentUser()`) resolves the caller's own `Seller` row via
`Seller.findUnique({ where: { userId: req.user.id } })` — **never** from a
client-supplied `sellerId` in the path/body/query, satisfying the brief's
explicit "derive the seller identity from the authenticated user/session"
rule by construction, not by convention alone. A new `SellerGuard` (parallel
to `RolesGuard`, composed *with* it, not replacing it — a route still needs
`@Roles('seller')` for the coarse "is this even a seller account" check, and
`SellerGuard` for the finer "is that seller's account currently ACTIVE
enough to act" check, since the brief requires that an `APPLIED`/
`UNDER_REVIEW`/`REJECTED`/`SUSPENDED`/`DEACTIVATED` seller cannot sell, even
though their account and role still exist).

**Every seller-scoped query is written exactly like `orders.controller.ts`'s
existing pattern**: `WHERE sellerId = req.seller.id AND id = :id` inline in
the query itself, never "fetch then check" — meaning a wrong-seller lookup
returns a 404, not a distinguishing 403, matching this codebase's existing
information-disclosure discipline for ownership checks. Genuinely
unauthenticated access still gets 401 (the global `JwtAuthGuard`,
unchanged); an authenticated non-seller hitting a seller endpoint gets 403
(via `@Roles('seller')`/`RolesGuard`, also unchanged); a seller-role user
whose account isn't `ACTIVE`, or who is trying to reach another seller's row
by forged ID, gets 404 — exactly the three-way split the brief's §18 security
audit explicitly asks for.

**One user, dual capability, no RBAC conflict:** `role` gaining a `'seller'`
value does **not** prevent that person from continuing to shop as a normal
customer — confirmed directly in the backend research that customer-facing
endpoints (`orders`, `cart`, `wishlist`, etc.) carry **no** `@Roles()`
decorator at all today (only `JwtAuthGuard`), so they are already
role-agnostic; a seller-role account hits them identically to a
customer-role account. This resolves the real-world requirement — most
marketplace sellers are also buyers — without needing a second, orthogonal
"capability flag" system alongside the existing single-`role` RBAC model.

---

## 11. Migration risks

- **Reconcile numbering with the in-flight `PRODUCTION_ROADMAP.md` first.**
  That roadmap's own Phase 7 ("Media + product catalog + India commerce,"
  not yet started) already claims some of the same territory (`Product`
  schema, image/media handling) this marketplace initiative's Phase 1–3 also
  touch. Recommend explicitly deciding, before any migration is written,
  whether this marketplace initiative *subsumes* that roadmap Phase 7 or
  runs as a genuinely separate, later effort — writing both independently
  risks two uncoordinated migrations touching `Product` in the same window.
  **This is a decision for you, not an inference I should make silently.**
- **Backward-incompatible query risk on `Product` reads.** Every existing
  product-listing/detail query must gain the `approvalStatus: 'ACTIVE'`
  filter (§3) in the *same* migration/deploy that adds the column with its
  `ACTIVE`-defaulted backfill — deploying the column without the query
  change is harmless (extra unused column); deploying the query change
  before the backfill runs would incorrectly hide every existing live
  product. **Order matters**: migrate + backfill first, ship the filtered
  query second, verified against a copy of the real dev database, not just a
  fresh one (mirroring this project's own existing migration-verification
  discipline from Phases 1–6).
- **`OrderSellerGroup` backfill for existing orders.** Every `Order` row that
  already exists (pre-marketplace) needs exactly one backfilled
  `OrderSellerGroup` (`sellerId: null`) carrying its existing `courierId`/
  `trackingNumber`/`trackingUrl`/`shippedAt`/`status` values, with every
  existing `OrderItem` pointed at it — a real data-migration script, not
  just a schema migration, and one that must be tested against a snapshot of
  real existing order data (per the brief's explicit two-database test
  requirement: clean DB and a DB containing existing Folia data).
- **The pre-existing, unrelated migration-checksum-drift risk already
  encountered once** (Phase 6D-4E of the existing roadmap: `prisma migrate
  dev` offered to reset the entire dev database over stale, unrelated
  checksum drift, and was refused in favor of a targeted single-row SQL
  fix). The same tooling behavior should be expected here and handled the
  same non-destructive way, not treated as a new problem each time it
  recurs.
- **`SellerBankAccount`'s data-minimization design (§9) is itself a risk
  worth naming**: if a future real payout integration needs more than
  masked/last-4 data, that will be its own additive migration at that
  time — deliberately not pre-built speculatively now.

---

## 12. Backward compatibility strategy

**The existing single-seller storefront must keep working, unmodified, at
every intermediate phase gate** — not just at the end. Concretely:

- Through Phase 4 of this initiative (seller storefronts exist, but
  checkout/cart are untouched), the existing checkout flow for a cart of
  only Folia-owned products is **byte-for-byte the same code path** it is
  today — `OrderSellerGroup` doesn't exist yet as a concept the checkout
  flow uses until Phase 5 explicitly lands it.
- From Phase 5 onward, a cart containing only Folia-owned products still
  produces exactly one `OrderSellerGroup` (`sellerId: null`) — this is not a
  special case in the code, it's the same grouping logic simply given input
  that happens to have one bucket. No behavioral branch exists for
  "single-seller vs. multi-seller" — multi-seller is not a mode, it's what
  happens when the same one algorithm is given a cart with more than one
  distinct `sellerId`.
- The existing `Order.courierId`/`trackingNumber`/`trackingUrl`/`shippedAt`
  columns are **not dropped** in this initiative — they become
  legacy/deprecated in favor of `OrderSellerGroup`'s per-group fields, kept
  and backfilled (§11) rather than removed, so any code path not yet
  migrated to read the new shape still returns correct data for historical
  orders. Actually removing them is a later, separate, explicitly-flagged
  cleanup — not bundled into this initiative.
- Every new `Product` column is nullable or safely defaulted (§3) —
  zero existing `Product`, `Order`, or `Payment` row becomes invalid,
  ownerless, or misclassified by any migration in this initiative.

---

## 13. Test strategy

**Mirror the existing hand-rolled mock convention exactly** (confirmed in
§1's research: no auto-mock library, no `Test.createTestingModule` — a
`createDeps()` factory returning plain `{ method: jest.fn() }` objects per
Prisma model/collaborator actually used, service constructed directly against
those mocks, `Decimal` stubbed with a tiny `{ toNumber: () => value }`
helper). New `*.service.spec.ts` files for `SellersService`,
`SellerProductsService` (or equivalent), `SellerLedgerService`,
`SellerPayoutsService` follow this exactly.

**Establish `admin/*.spec.ts` coverage from scratch** — flagged in §1 as a
real, pre-existing gap (zero admin controllers have any test today across
the *entire* existing codebase, not just the marketplace-adjacent ones).
Since this initiative adds the single largest expansion of admin surface
this project has ever had (seller approval, product moderation, finance
views), it is the natural place to also close this gap for the new
controllers at minimum — not a silent scope-creep into fixing pre-existing
admin controllers unrelated to sellers, but a real commitment that this
initiative's *own* new admin code does not repeat that gap.

**Full matrix per the brief's own Phase 19 list** — sellers (application/
approval/rejection/suspension/reactivation/isolation), products (create/
update/submit/approve/reject/archive/ownership), checkout (single-seller/
multi-seller/Folia+seller/concurrency/payment-failure/retry/duplicate-
callback), payments (the existing Phase 1/6 coverage, extended for
commission/split accounting), returns (partial seller return, seller
attribution, financial accounting), and security (every A-can't-touch-B
isolation case, forged-ID, forged-price, forged-commission cases) — each
gets its own gate-report-worthy test count when its phase lands, exactly as
every phase in the existing roadmap has done.

---

## Summary — what's genuinely new work vs. genuine reuse

**Real, non-trivial new design work:** seller ownership/isolation (no
existing primitive — §10), order-splitting into `OrderSellerGroup` and its
knock-on shipment-fan-out change (§6), the commission/ledger/payout domain in
full (§8/§9), and establishing admin test coverage for the new surface
(§13).

**Substantial, direct reuse — not rebuilt:** RBAC/seeding, storage/uploads,
the entire payment provider abstraction and its already-hardened refund
state machine, inventory concurrency, the event/notification/audit systems,
and the entire frontend design system and admin-page pattern. Razorpay
Phase 7 completion (§7) is closing one already-documented gap, not new
integration work.

**Per the brief's Phase 0 instruction: no code was modified to produce this
document. Stopping here, pending your review and explicit direction to begin
Phase 1 (seller domain + database).**
