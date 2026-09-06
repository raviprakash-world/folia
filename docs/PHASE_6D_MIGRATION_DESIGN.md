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

# Phase 6D-4B — Return Financial Resolution: design notes and a reported gap

No schema or migration change was made in this phase. `npx prisma migrate
status` confirms the database is up to date against the same 7 migrations
that existed after 6D-1 — `schema.prisma` itself was not touched. Every
column this phase's calculations read (`ReturnRequest.refundAmount`,
`.status`, `Order.subtotal/discount/tax`, `StoreCreditEntry.amount`)
already existed from the 6D-1 migration; this phase only adds application
code that populates and reads them.

## Where the proration formula lives

`calculateRefundAmount()` in `apps/api/src/orders/return-policy.util.ts` is
the single, canonical implementation of the locked partial-refund formula
(eligible item subtotal, proportion of order subtotal, prorated discount
and tax, item-level refund, the Rs.99 return-shipping deduction where the
locked rule applies, floor at zero). It reuses the existing
`calculateShippingDeduction()` from the same file rather than duplicating
the Rs.99 rule a second time. Nothing else in the codebase computed this
formula before 6D-4B, so no prior implementation had to be reconciled or
replaced.

## Reported gap: prepaid refund retry/concurrency cannot be safely disambiguated with the existing enum

`PaymentsService.refund()` already guards a payment's total against being
over-refunded, by summing existing `Refund` rows with
`status IN ('PENDING', 'PROCESSED')` — deliberately excluding `'FAILED'`
rows, so a failed attempt never permanently consumes headroom a legitimate
retry needs.

That is the correct design for `PaymentsService.refund()` taken in
isolation. But it means a return claim's own resolution state cannot be
safely derived from `ReturnRequestStatus` alone: once
`ReturnRequest.refundAmount` is frozen on an `APPROVED` claim, that same
observable state (`status = APPROVED`, `refundAmount` non-null) is reached
by three different real situations the schema cannot tell apart:

1. A first resolution attempt is currently in flight (the call to
   `PaymentsService.refund()` has not yet returned).
2. A previous attempt failed at the gateway and this is a legitimate,
   safe-to-allow retry.
3. A previous attempt already succeeded, and a second call (concurrent
   request, accidental double-click, or a retried request) is racing or
   duplicating it.

Because case 2 must be allowed and case 3 must never be allowed, and both
present identically in the current schema, safely allowing (2) without a
schema change risks also allowing (3) — a naive
`if (!returnRequest.refundId) { refund() }` check is racy across
concurrent requests, and "allow another resolve call whenever the last one
didn't reach a terminal success" cannot distinguish a slow in-flight call
(1) from a genuinely finished one whose write hasn't yet been observed by
the racing request.

**Decision made in code, per instruction to report rather than invent an
unsafe workaround**: `resolveClaim()` uses an atomic
`updateMany({ where: { id, status: 'APPROVED', refundAmount: null } })`
conditional update as the one-time freeze gate for a claim's first
resolution attempt (exactly one of two concurrent first-time callers wins
the race; the loser gets a clean `ConflictException`, not a second
financial effect). For any subsequent call on a prepaid claim whose
`refundAmount` is already frozen — whether a genuine concurrent racer or a
later manual retry after a real gateway failure — the code deliberately
throws `ConflictException` rather than calling `PaymentsService.refund()`
again. This is intentionally conservative: it forfeits self-service retry
convenience after a failed prepaid gateway call, in exchange for a
guarantee that this codebase will never issue two Razorpay refund attempts
for the same claim.

**What a safe retry-enabling fix would need** (not built in this phase,
since it requires a real, reviewed schema change): a resolution-attempt
state distinct from `ReturnRequestStatus`, capable of representing
"resolution in progress" as its own persisted, lockable state — e.g. a
`ReturnResolutionState` enum (`NONE` / `IN_PROGRESS` / `SUCCEEDED` /
`FAILED_RETRYABLE`) with its own conditional-update transitions
(`IN_PROGRESS -> SUCCEEDED` / `IN_PROGRESS -> FAILED_RETRYABLE`), so a
retry attempt could safely transition only out of `FAILED_RETRYABLE`,
never out of `IN_PROGRESS` or `SUCCEEDED`. This is a genuine,
currently-missing schema capability, not a workaround to build silently,
and it was not built in 6D-4B.

## Why COD store credit has no equivalent gap

`StoreCreditEntry.returnRequestId` is `@unique`. Issuing store credit is a
single, atomic `create()` against that constraint — there is no external
gateway call and therefore no window in which two racing requests can both
observe "not yet issued" and both proceed. The loser of the race gets a
Postgres `P2002` violation, caught and turned into an idempotent fetch-
and-return of the entry the winner created. This is the same idiom this
schema already uses for `CancellationRequest`'s and `ReturnRequest.orderId`'s
own concurrent-creation races (see 6D-1 notes above) — reused here, not
reinvented, and airtight without any new resolution-state column because
the entire operation is one atomic write.

# Phase 6D-4C — Replacement Order Creation: design notes

No schema or migration change was made in this phase either — `npx prisma
migrate status` still reports the same 7 migrations, up to date. Every
column this phase writes (`ReturnRequest.resolutionType`,
`.replacementOrderId`, `Order.paymentMethod = REPLACEMENT`,
`Payment.status = NO_CHARGE`) was already anticipated by the 6D-1
migration's own design notes above (see "Zero-charge replacement order —
why the existing model can't safely represent it").

## How REPLACEMENT is chosen (a real, confirmed gap this phase closes)

Before this phase, `ReturnRequest.resolutionType` and
`.requiresReverseLogistics` were never actually set by any code path —
`ReturnsService.adminApprove` (Phase 6D-4A) only ever recorded a decision
note, and `resolveClaim` (Phase 6D-4B) derived the refund-vs-store-credit
split purely from `Order.paymentMethod`. There was no mechanism at all by
which a claim could be routed to REPLACEMENT.

This phase adds one optional field, `ApproveReturnDto.resolutionType`,
accepting only the literal `'REPLACEMENT'` — REFUND and FOLIA_STORE_CREDIT
stay exactly as 6D-4B left them: never client-settable, always derived
automatically from server-side payment state, since those are real money
amounts. REPLACEMENT is a physical-fulfillment decision, not a money
amount, so an admin choosing it explicitly at approval time is safe.
`adminApprove` rejects the combination unless the claim's `claimType` is
`DOA_CLAIM` — a "changed my mind" standard return has nothing wrong with
the item to replace. `resolveClaim` checks `resolutionType === 'REPLACEMENT'`
before its refund/credit branch and dispatches to a fully separate method,
`resolveReplacement`, which never touches `refundAmount`,
`PaymentsService`, or `StoreCreditEntry`.

Reverse logistics (waiting for the original DOA item to be physically
received back before shipping a replacement) was deliberately left out of
this phase's scope, consistent with 6D-4B's own precedent of treating
`requiresReverseLogistics`/`itemReceivedAt` as separate, not-yet-built
work — `resolveReplacement` creates the replacement order immediately upon
resolution, the same timing model 6D-4B already used for refund/store-
credit.

## Reusing the existing order-creation and inventory primitives

`resolveReplacement` does not reimplement checkout. It reuses the exact
reserve -> commit-inside-the-order-creation-transaction pipeline
`PaymentsService.confirmAndCreateOrder` already established for every real
order (`InventoryService.reserveForProduct`, called per claimed line
before the transaction opens, then `InventoryService.commitReservation`
called with the transaction's own `tx` inside it) — no new inventory
primitive was written for this phase. The replacement order reuses the
original order's own `shippingAddressSnapshot`, `billingAddressSnapshot`,
`deliveryMethod`, and `estimatedDelivery` rather than re-querying
`AddressesService` by id, since a replacement ships to wherever the
original order shipped, even if the customer's saved address has since
been edited or deleted.

Every monetary field on the replacement `Order` and its `OrderItem` rows
is zero (`subtotal`/`discount`/`shippingCost`/`tax`/`total`, and each
line's `price`) — not the original claimed line's real price — exactly per
the 6D-1 design notes' own invariant: a future return claim filed against
*this* replacement order must never compute a non-zero refund over money
that was never charged. `Payment.provider` stays `COD` (no real gateway
was involved) with `method = REPLACEMENT` and `status = NO_CHARGE`,
matching the 6D-1 notes' reasoning for why `COD_COLLECTED` and `CAPTURED`
were both rejected as unsafe reuse for this case.

## Idempotency/concurrency: why this can't use 6D-4B's freeze-gate idiom directly

6D-4B's prepaid path used an atomic `updateMany` conditional on
`refundAmount IS NULL` as a pre-claim gate, executed *before* any external
side effect. `ReturnRequest.replacementOrderId` cannot be used the same
way: it has a real foreign key to `orders(id)`, so it cannot be set to an
order id before that `Order` row exists — there is no nullable scalar
value to freeze upfront the way `refundAmount` could be.

Instead, `resolveReplacement` creates the `Order`/`OrderItem`/`Payment`
rows *speculatively* inside one `prisma.$transaction`, whose **final**
write is the same conditional-`updateMany` idiom used throughout this
project
(`{ where: { id, status: 'APPROVED', replacementOrderId: null } }`). If
that update matches zero rows (a concurrent call already won), the method
throws inside the transaction callback, and Postgres rolls back
*everything* written in that transaction — the speculative order, its
items, its payment, and the just-committed inventory decrement all revert
together. A losing racer therefore never leaves an orphaned $0 order or a
double-decremented stock level behind. Stock reservations themselves are
made *before* the transaction (so they can be released on any failure
path, including a stock-unavailability error that never reaches the
transaction at all); a reservation whose `commitReservation` write was
rolled back reverts to `ACTIVE`, not `COMMITTED`, so the loser's reservation
is explicitly released back to available stock after the transaction
throws — it does not sit ACTIVE forever.

This is a different mechanism from 6D-4B's freeze-gate, but the same
underlying principle: exactly one of two concurrent resolution attempts
for a given claim produces exactly one financial/physical effect, and the
loser gets an idempotent result, never a duplicate. Unlike 6D-4B's prepaid
retry gap, this path has no equivalent "can't safely tell in-flight from
failed" ambiguity — a failed reservation attempt writes nothing to the
database at all, so a subsequent retry from scratch is always safe.
