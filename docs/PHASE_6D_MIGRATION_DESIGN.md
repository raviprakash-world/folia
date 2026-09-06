# Phase 6D-1 — Returns/DOA/Replacement/Store-Credit Migration Design

This documents the schema decisions behind migration
`20260906210136_phase6d_returns_doa_replacement_storecredit`, including
every place the applied schema **deviates** from the Phase 6C-Design
proposal, per the explicit instruction to challenge every new field/model
before applying it rather than blindly implementing that draft.

## Deviations from the Phase 6C-Design draft

**`ReturnRequest.orderId` stays `@unique`.** The 6C draft proposed dropping
this to let a customer file more than one return/DOA claim per order over
time. Reconsidered: nothing in the locked business rules actually requires
that — partial, multi-item claims are fully covered by `ReturnRequestItem`
*within one* `ReturnRequest` row. Keeping the constraint:

- Avoids a breaking Prisma relation-shape change (`returnRequest` stays a
  to-one relation on `Order`; every existing `include: { returnRequest: true }`
  call site keeps compiling and behaving identically).
- Means a second, concurrent claim attempt on the same order simply loses
  a plain unique-constraint race — the *exact* idiom `CancellationRequest`
  already uses (`OrdersService.requestCancellation`'s P2002-to-clean-400
  catch), reused instead of inventing cross-claim aggregate-locking logic.
- Trade-off, stated plainly: a customer cannot file a second claim on the
  same order once one exists (approved, rejected, or pending). If Folia
  later needs re-filing after a rejection, that's a real but mechanically
  simple follow-up (drop the constraint, rename the Prisma relation,
  update every call site) — not done now since no locked rule demands it.

**`evidenceUrls` is a table (`ReturnEvidence`), not a scalar array column.**
This schema has zero scalar-array (`String[]`) columns anywhere today —
every existing "one thing has many of another" relationship (e.g.
`ProductImage` for a product's photos) is modeled as a related table, not
a Postgres array. `ReturnEvidence` matches that existing convention, and
leaves room to add per-item metadata (caption, content type) later with
no further migration.

## Zero-charge replacement order — why the existing model can't safely represent it

A replacement is a real `Order`, which requires a `Payment` (the schema's
existing 1:1 invariant). Two ways to represent "$0, nothing collected"
were rejected as **unsafe reuse**, not just stylistically wrong:

- **`PaymentStatus.COD_COLLECTED`** literally means "cash was collected on
  delivery" — false for a replacement. Any future finance reconciliation
  keyed on that status would count a replacement as real revenue received.
- **`PaymentStatus.CAPTURED`** means "Razorpay confirmed a real charge" —
  also false, and would make the replacement Payment look refundable to
  any status-based UI, even though `PaymentsService.refund()`'s existing
  `providerPaymentId` guard would still correctly reject an actual refund
  attempt against it.

Instead: one new `PaymentMethodType.REPLACEMENT` value and one new
`PaymentStatus.NO_CHARGE` value. `provider` stays `COD` — that field only
ever meant "no real gateway was involved," which remains true and is not
an overload. Verified safe with **zero changes** to
`PaymentsService.refund()`: its existing guard
(`status !== 'CAPTURED' && status !== 'PARTIALLY_REFUNDED'` → reject)
already refuses a `NO_CHARGE` payment.

A second invariant this introduces, to flag for Phase 6D-4's application
code: **every monetary field on a replacement order must be zero** —
`Payment.amount`, `Order.subtotal/discount/shippingCost/tax/total`, *and*
each `OrderItem.price` (not just the Payment). If `OrderItem.price` kept
the item's real historical price, a future return claim against the
replacement order would compute a non-zero "eligible refund" via the
proration formula below, over real money that was never charged. This is
a new correctness rule this schema didn't need to enforce anywhere else —
every other order path assumes real money changed hands.

## Store credit — the smallest safe additive model

A COD return/DOA claim has no Razorpay transaction to refund at all
(`Payment.providerPaymentId` is always null for COD) — `PaymentsService.refund()`
can never be called for one. `StoreCreditEntry` is a ledger: a user's
balance is `SUM(amount)` computed on read, never a cached column to keep
in sync — the same "derive, don't cache" convention `PaymentsService.refund()`
already uses for a payment's remaining-refundable amount. Only issuance
(`amount > 0`) is used in Phase 6D; the shape is deliberately ledger-like
(signed amounts) so a future redemption-at-checkout feature is just a
negative-amount row, needing no further migration — not built now, since
nothing locked asks for it yet.

**Idempotency is a real database constraint**, not just an application
check: `StoreCreditEntry.returnRequestId` is `@unique`. A duplicate
approval or retry attempting to issue credit for the same claim a second
time hits a genuine unique-constraint violation (P2002) — the same idiom
`OrdersService.requestCancellation` already uses for its own concurrent-
cancellation race.

## `deliveredAt` backfill

Preferred source: the real `audit_logs` row `AdminOrdersController.updateStatus`
already writes for every `ORDER_STATUS_UPDATE` action
(`resource='order', action='ORDER_STATUS_UPDATE', metadata->>'newStatus'='DELIVERED'`)
— a materially more accurate source than `Order.updatedAt`, which any
later unrelated write (e.g. a `customerNotes` edit) would have silently
bumped. Falls back to `updatedAt` only when no such audit row exists (e.g.
an order seeded directly, bypassing the real endpoint). In this project's
dev database specifically, zero orders currently sit at `DELIVERED`, so
this backfill affects zero real rows today — written correctly anyway for
whatever state a real deployment is in.

## NOT NULL columns added to a table that may already have rows

Prisma's raw `migrate diff` output added `return_requests.claimType` and
`.updatedAt` as `NOT NULL` with no default — safe against an empty table
(true of this dev DB right now) but not safe in general. The applied
migration instead adds both nullable, backfills, then constrains NOT
NULL:

- `claimType`: backfilled per pre-existing row by checking whether the
  parent order has any `'plants'`-category line item (`DOA_CLAIM` if so,
  else `STANDARD_RETURN`) — the same signal used everywhere else in this
  design, not an arbitrary default, since a plant claim silently
  mislabeled `STANDARD_RETURN` would let it skip the eligibility rules
  that are supposed to govern it.
- `updatedAt`: backfilled to the migration's own run time — pure
  bookkeeping, no business meaning attached to the exact value, matching
  how every other `@updatedAt` column in this schema behaves at the
  database level (no `DEFAULT` clause; the Prisma Client sets it on every
  write, not Postgres).

## Foreign keys, cascades, indexes, constraints

- `ReturnRequestItem.orderItemId` and `ReturnRequest.refundId` /
  `.replacementOrderId` all use `onDelete: Restrict` — none of `OrderItem`,
  `Refund`, or `Order` rows are ever deleted in this system (no delete
  endpoint exists for any of them), so this is mostly a defensive
  guarantee against ever silently breaking a financial/audit traceability
  link, matching `Order.user`'s own existing `Restrict` convention and
  stated reasoning.
- `ReturnRequestItem`/`ReturnEvidence` cascade from their parent
  `ReturnRequest` (`onDelete: Cascade`) — they have no independent
  existence, matching every other "detail row" pattern in this schema
  (e.g. `OrderItem` cascading from `Order`).
- `StoreCreditEntry.userId`/`returnRequestId` use `Restrict` — a ledger
  entry is a permanent financial record, matching `Order.user`'s reasoning
  exactly.
- The 6C draft's `@@index([orderId])` on `ReturnRequest` was dropped as
  **redundant**: `orderId @unique` already creates a unique index that
  serves the same lookups. A new `@@index([status])` was added instead,
  for the admin returns queue's filter-by-status query — a genuinely new
  access pattern this table didn't have before.
- `ReturnRequestItem` needed its own `@@index([orderItemId])` in addition
  to `@@unique([returnRequestId, orderItemId])`: a composite index only
  efficiently serves lookups on its leftmost column(s), so a lookup by
  `orderItemId` alone (e.g. "has this line already been claimed") needs
  its own index.
- All new money fields (`ReturnRequest.refundAmount`, `StoreCreditEntry.amount`)
  use `Decimal(10, 2)` — identical precision to every existing money field
  in this schema (`Order.total`, `Payment.amount`, `Refund.amount`).

## Rollback

Every change is additive: two new tables, new nullable/defaulted columns,
new enum values. A rollback would drop `store_credit_entries` and
`return_request_items`/`return_evidence`, drop the new columns on
`return_requests`/`orders`, and remove the new enum values. One real,
unavoidable wrinkle, not introduced by this migration specifically:
**Postgres cannot drop a single enum value without recreating the whole
type** — if any row has ever used `PaymentMethodType.REPLACEMENT` or
`PaymentStatus.NO_CHARGE`, a clean rollback requires migrating those rows
first. This is an inherent property of any additive Postgres enum change
in this schema (already true of every prior one), not a new risk.

## Return-shipping deduction — where the ₹99 configuration lives

Not a schema/database value. Following this codebase's existing
convention for business-rule numbers — `TAX_RATE` (`order.types.ts`),
`PAYMENT_EXPIRY_MINUTES` (`payments.service.ts`),
`REFUND_PROCESSING_WINDOW_MS` (`refund.util.ts`) — the ₹99 figure will be
a single exported constant, `RETURN_SHIPPING_DEDUCTION_INR`, in the new
`apps/api/src/orders/return-policy.util.ts` (Phase 6D-2), referenced
everywhere the deduction is applied and by its own unit tests. To change
it: edit that one constant and redeploy — the same operational model this
project already uses for every other business-rule number, not a secret
or environment-specific value (same figure should apply identically
across dev/staging/prod), so it does not go through `AppConfigService`
(reserved for real external credentials/URLs). If Folia later wants this
editable without a redeploy, that would be new infrastructure (e.g. a
`SystemConfig` key-value table) this codebase has for no other business
constant today — a real option, not built now since nothing locked asks
for runtime editability.
