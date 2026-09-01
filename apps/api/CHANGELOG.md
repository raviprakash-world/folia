# Changelog — @folia/api

## Phase 0 — Foundation

NestJS 11 (CommonJS, converted from the CLI's newer ESM-first scaffold —
simpler and more broadly compatible with the rest of this stack), Prisma
6 + PostgreSQL, Redis (ioredis), structured logging (Pino via
`nestjs-pino`, with `req.headers.authorization`/`cookie` redacted from
logs), a global exception filter normalizing every error response to
`{ statusCode, message, error, path, timestamp }` — `message` always a
single string, specifically matching `apps/web/src/utils/apiError.ts`'s
existing `extractApiErrorMessage()`, which reads it directly as a string —
Swagger/OpenAPI at `/api/docs`, a real health check (`GET /api/health`,
version-neutral, checking live Postgres + Redis via `@nestjs/terminus`),
Docker/Compose, and a GitHub Actions CI workflow.

Real bugs caught by actually running things, not assumed correct:
`PORT=3000` was silently rejected by env validation (a `class-transformer`
coercion gap, fixed with an explicit `@Type(() => Number)`), and the
health check was accidentally version-prefixed (`/api/v1/health`) by the
global versioning config — fixed with `VERSION_NEUTRAL`, then
re-confirmed live.

**Known issue, still open**: `binaries.prisma.sh` is unreachable in the
sandbox this was developed in, blocking `prisma generate`/`migrate`. See
the README's "Known Issues" for the full, current picture — its scope
grew substantially in Phase 1.

## Phase 1 — Authentication & Users

### Schema

`User`, `Role`, `Permission` (many-to-many RBAC), `Session`,
`PasswordResetToken`, `EmailVerificationToken`. Hand-verified against the
real running PostgreSQL by translating the schema to exact Prisma-
convention SQL and executing it directly — not just written and assumed
correct: proved RBAC resolution (a customer-role user resolves to
`orders:read` only, never `products:write`), unique-constraint
enforcement, and cascade/restrict delete behavior with actual inserted
data before cleaning up (the real migration will create this properly
once `prisma generate` runs).

### Security-relevant design decisions

- **Argon2id** password hashing, OWASP-recommended parameters (19 MiB
  memory, 2 iterations). Verified with real tests proving per-call
  salting (same password → different hash every time) and one-way
  verification, not just "does it return true."
- **Refresh tokens are never stored raw** — only their SHA-256 hash, in
  `Session.refreshTokenHash`. The raw value only ever exists in the
  response body/cookie.
- **Refresh-token rotation with reuse detection**: every refresh revokes
  the old session and issues a new one. If a token that hashes to an
  *already-revoked* session is presented, that's treated as a strong
  signal of token theft (both the legitimate client and an attacker used
  the same token) and **every** session for that user is revoked
  defensively. Tested specifically to confirm this doesn't false-positive
  on a token that simply never existed.
- **No account enumeration**: login and forgot-password return
  identical responses whether or not the account exists. Tested directly
  (not just asserted) by comparing the actual error message for both
  cases.
- **Password reset revokes every existing session** — a stolen session
  shouldn't outlive the password that may have leaked it.
- **The access token is re-verified against the database on every
  request** (`JwtStrategy.validate`), not trusted purely on JWT
  signature validity — a token stays cryptographically valid until
  expiry even if the account was deactivated or the role changed a
  second after the token was issued.
- **Secure-by-default routing**: `JwtAuthGuard` is global
  (`APP_GUARD`); every route requires a valid access token unless
  explicitly marked `@Public()`. `RolesGuard` layers role/permission
  checks on top for routes that need them.
- Login/forgot-password/reset-password are rate-limited
  (`@Throttle`) — real brute-force protection, not just a plan to add it
  later.

### API surface

`POST /auth/register`, `POST /auth/login`, `POST /auth/logout`,
`POST /auth/refresh`, `GET /auth/me`, `PUT /auth/me`,
`POST /auth/me/avatar` (real multipart upload, 2MB limit — matching
`apps/web`'s existing mock limit exactly), `POST /auth/forgot-password`,
`POST /auth/reset-password`, `POST /auth/change-password`,
`POST /auth/verify-email`, `POST /auth/resend-verification`,
`GET /auth/sessions`, `DELETE /auth/sessions/:id`.

The access token is returned in the JSON body (`{ user, token }`) —
deliberately matching `apps/web/src/types/auth.ts`'s existing
`AuthSession` shape exactly, so the core login/session flow needs zero
frontend changes once integrated. The refresh token travels via an
httpOnly, `SameSite=Lax` cookie instead — never in a response body the
frontend's JS can read, which is both the more secure pattern and (not
coincidentally) what keeps `apps/web`'s existing types unchanged. Wiring
automatic silent-refresh (an axios response interceptor catching 401 and
calling `/auth/refresh`) is real, minimal, justified frontend work for
whenever integration happens — the backend doesn't require it, but the
capability is wasted without it.

### Storage abstraction ("S3 abstraction")

`StorageService` (interface) / `LocalStorageService` (the only
implementation right now — this sandbox has no reachable S3-compatible
endpoint to build or test against). Genuinely writes and serves files
from local disk, not a mock — 5 real filesystem I/O tests, including
proof that a path-traversal attempt in a client-supplied filename
(`../../../etc/passwd`) can't escape the intended upload directory.
Swapping in a real S3 client later means one new class implementing the
same interface and a one-line change to `StorageModule`'s provider
binding.

### Real bugs caught while wiring the final pieces

- `JwtAuthGuard` became global in this phase, but `HealthController`
  (built in Phase 0) was never marked `@Public()` — the health check that
  was proven working in Phase 0 would have started requiring a valid
  access token, breaking every load balancer/uptime monitor pointed at
  it. Caught by deliberately re-reviewing every existing controller
  against the new global guard chain, not assumed fine because it worked
  before this phase touched it.
- `AuthController` reads `req.cookies` for the refresh token, but
  `cookie-parser` middleware was never actually registered in `main.ts` —
  would have been `undefined` at runtime, silently breaking every
  login/refresh/logout call. Neither `tsc` nor `eslint` catches a missing
  middleware registration; this class of bug only surfaces by reasoning
  through the actual request lifecycle.
- A design bug caught mid-write, before it shipped: an early version of
  `refresh()` tried to derive the raw refresh token from what
  `SessionsService.rotate()` returns — but `rotate()` only ever returns
  the *hashed* session, by design (raw tokens are never persisted). The
  placeholder method that attempted this literally threw an error the
  moment it was written; fixed by restructuring `refresh()` to capture
  the raw token before calling `rotate()`, not try to reverse it after.
- `JwtService.sign()`'s `expiresIn` option needs a narrow
  `ms`-package-specific string format, not a plain `string` —
  `AppConfigService.jwtAccessExpiry` returns a generic `string` since it
  comes from an env var. Fixed properly, not papered over: added real
  regex validation to `env.validation.ts` (catches a genuine
  misconfiguration like `"fifteen minutes"` at boot, with a test proving
  it), then imported the actual `ms.StringValue` type for the cast at the
  point of use — the first attempted fix (a hand-guessed template literal
  type) was verified wrong via `tsc` before landing on the correct one.

### Testing

106 tests (100 unit/mocked-integration + a deliberate-error test proving
`tsc` actually type-checks `prisma/seed.ts`, not assumed), all genuinely
run and passing. Coverage: 54.47%, up from Phase 0's 46.96%, for the same
structural reason — controllers and modules need live-boot e2e tests to
cover meaningfully, which need a working generated Prisma client. See the
README's "Known Issues" for the full, honest accounting of what that
does and doesn't affect this phase.

## Phase 2 — Product Catalog

### Schema

`Category` (one table, `type` discriminator for categories vs.
collections — `apps/web/src/types/product.ts`'s `Category` type is
identical for both, so two near-duplicate tables would have been
gratuitous), `Brand`, `Product`, `ProductVariant`, `ProductSpec`,
`ProductImage`, `Tag`, `Review`. `Brand`/`ProductImage`/`Tag` are real,
explicitly-requested infrastructure the current frontend doesn't actually
consume yet (`apps/web`'s `Product` type has no `brand`/`images`/`tags`
fields) — built anyway since they're explicitly in Phase 2's spec, and
said so plainly in the schema comments rather than silently overreaching
or silently skipping them.

Hand-verified against the real running PostgreSQL, same discipline as
Phase 1's schema: inserted a full product graph (category → brand →
variant → spec → tag → review) and queried the 7-way join back
successfully, confirmed price-filter semantics, confirmed a category
can't be deleted while a product references it — then cleaned up.

### A real, subtle bug caught by reasoning through Postgres semantics

The "featured" sort (bestsellers first, then catalog order) needed two
non-obvious pieces to get right, not just `orderBy: { badge: 'desc' }`:

1. **PostgreSQL enums sort by declaration order**, not by matching a
   target value — the schema's original `ProductBadge` enum had
   `BESTSELLER` declared third of four, meaning `DESC` would have put
   `LOW_STOCK` first, not bestsellers.
2. **Postgres's `DESC` default is `NULLS FIRST`** — meaning every
   product with *no* badge would have sorted *before* actual
   bestsellers, exactly backwards.

Caught by reasoning through the actual SQL semantics (I still can't run
a live Prisma client in this sandbox to have caught it by testing), not
assumed correct because the TypeScript compiled. Fixed by reordering the
enum (with a prominent comment warning against reordering it casually)
and adding explicit `nulls: 'last'`. `buildOrderBy()` is exported
specifically so its exact output shape is unit-tested for every sort
key — 6 tests directly asserting the clause shape, not just "did it
call `findMany`."

### API surface

`GET /products` (category/price-range/in-stock/sort/search/pagination —
same query param names and semantics as `apps/web`'s existing
`ProductQuery`, read directly from `apps/web/src/mocks/handlers.ts`
before implementing anything, not guessed), `GET /products/:slug`,
`GET /categories`, `GET /collections/:slug`, `GET /reviews?productId=`.
All public (`@Public()`) — browsing has never required authentication
anywhere in this project, and the backend doesn't change that. Filtering,
sorting, and pagination all happen at the database level (Prisma
`where`/`orderBy`/`skip`/`take`) — not the mock's fetch-everything-then-
sort-in-JS approach, since that defeats the point of a real database.

### Data migration, not hand-transcription

The real catalog — 24 products, 72 reviews — was migrated from
`apps/web/src/data/products.ts`/`reviews.ts` **programmatically** (a
one-off Node script parsing the actual TypeScript source), not hand-
typed into the seed script. `createdAt` values are preserved exactly
from the source data, which matters beyond cosmetics: the "featured"
sort's tiebreaker depends on `createdAt` reflecting the original
catalog's relative order.

### A real inefficiency caught and fixed before it shipped

The first version of the review-seeding idempotency check ran one
`COUNT` query *per review* (72 queries) and recomputed an array filter
inside the loop on every iteration — an accidental O(n²) pattern.
Simplified to one grouped query before the loop, checking which products
already have any reviews seeded.

### Testing

125 tests total (up from 106), all genuinely passing. Coverage: 51.32%
— down slightly from Phase 1's 54.47% in percentage terms only because
this phase added a proportionally large amount of new, real logic
(query building, sort-order construction, data mapping) that's fully
tested, alongside controllers/modules that still need the same
live-boot e2e coverage blocked by the open Prisma issue. See the
README's "Known Issues" — unchanged in kind from Phase 1, now spanning
more files.

## Phase 3 — Inventory

### Schema

`Warehouse`, `InventoryItem` (one row per product/variant/warehouse
combination — a product with no variants gets one item per warehouse,
a product with variants gets one per variant per warehouse), and
`StockReservation` (a real hold against available stock, not yet a
deduction — `referenceType`/`referenceId` reference a cart or order by
plain string rather than a hard foreign key, since neither table exists
in this backend yet). Hand-verified against the real running PostgreSQL:
proved the `(productId, variantId, warehouseId)` uniqueness constraint
genuinely rejects a duplicate SKU assignment, proved real reservation
math (10 on hand, 3 reserved → 7 available, computed from actual rows,
not asserted), and proved cascade delete correctly propagates from
product → inventory items → reservations.

**The key integration decision**: `Product.stockCount`/`inStock` and
`ProductVariant.inStock` (Phase 2, already read and tested by the
frontend-facing `ProductsService`) become a *derived cache* — the one
thing that ever writes to them now is `InventoryService`, inside the same
transaction as whatever stock change triggered it. Phase 2's read path
needed zero changes.

### Two real, forward-looking typing bugs caught before they could ship

Both are variations of the same mistake, caught by reasoning through
Prisma's actual documented API rather than by running anything (still
blocked — see Known Issues):

1. **`InventoryService`**: an interactive `$transaction(async (tx) => ...)`
   callback's `tx` parameter was first annotated as `PrismaService` — but
   Prisma's real `$transaction()` passes a `Prisma.TransactionClient` (a
   narrower type without `$transaction`/`$connect`/`$disconnect`).
   Annotating it as the full client would very likely fail to compile the
   moment `prisma generate` succeeds. Fixed with a narrow structural
   interface (`InventoryPrismaClient`) describing exactly the methods
   actually called — correct against both the current `any` stub and the
   real generated types, since a real `TransactionClient` structurally
   satisfies a narrower interface.
2. **`WarehousesService`**: the *exact same mistake*, made a second time
   in a different file minutes later, caught by remembering the first fix
   and deliberately checking this file against it rather than assuming
   the lesson had already been applied everywhere. Fixed the same way.

### API surface

`GET /inventory/availability?productId=&variantId=` (public — real-time
`onHand - reserved`, the number a future "only 2 left" UI would read),
`POST /inventory/items/:id/adjust`, `POST /inventory/items/:id/reserve`,
`POST /inventory/reservations/:id/commit`,
`POST /inventory/reservations/:id/release` (all admin-gated — there's no
cart/checkout flow yet in this backend to justify a customer-facing
reservation API; Phase 4/5 will decide whether that surface gets exposed
directly or InventoryService gets called server-side instead),
`GET/POST /warehouses`, `GET /warehouses/:code` (admin-gated).

### Seed data

Extended, not replaced: a `MAIN` warehouse and real `InventoryItem` rows
for all 24 products (one per variant, or one total for variant-less
products), with stock distributed fairly across each product's in-stock
variants — deliberately not giving every variant the *full* stockCount,
which would inflate total availability once `getAvailability()` sums
across variants for real.

### Testing

144 tests total (up from 125), all genuinely passing — 15 for
`InventoryService` covering every real business rule (negative-stock
rejection, over-reservation rejection, the on-hand-vs-reserved
distinction between commit and release, expired-reservation sweeping)
and 4 for `WarehousesService`'s default-warehouse invariant. See the
README's "Known Issues" — unchanged in kind, now spanning more files.

## Phase 4 — Cart & Wishlist

### Schema

`Cart` (one per identity — a userId or a guestToken, never neither),
`CartItem` (unique on `(cartId, productId, variantId)`, which is what
makes "add to cart" idempotent at the database level), `WishlistItem`
(user-scoped only — no guest wishlist plumbing, since the frontend's
current wishlist model doesn't need one), `Coupon`. Hand-verified against
the real running PostgreSQL: proved the cart-item uniqueness constraint
genuinely rejects a duplicate line, proved wishlist uniqueness rejects
double-wishlisting the same product, proved cascade deletes correctly
propagate from user → cart/wishlist and cart → cart items.

### A real, honest starting point: the frontend has zero cart backend calls today

`apps/web`'s cart and wishlist are currently 100% client-side Zustand +
localStorage, with no MSW handlers and no service-layer HTTP calls at
all. This phase builds real, working backend capability — ready for
future integration — rather than wiring into an integration point that
doesn't exist yet. Said plainly rather than implied as already connected.

### The optional-auth problem, solved properly

Cart endpoints need to work identically for guests and signed-in users.
The existing `@Public()` mechanism skips JWT validation *entirely* — it
wouldn't populate `request.user` even if a valid token were sent, which
is wrong for cart (a signed-in user's cart requests still need to
resolve to *their* cart). Built `OptionalJwtAuthGuard` (overrides
Passport's `handleRequest` hook to return `undefined` instead of
throwing on a missing/invalid token) and a distinct `@OptionalCurrentUser()`
decorator — rather than weakening `@CurrentUser()`'s contract, which
every other authenticated route still correctly relies on being
non-optional.

### A real security/correctness fix caught before it shipped

`CartService.addItem()` initially took `unitPrice` as a caller-supplied
parameter. Caught before building the controller on top of it: accepting
a client-supplied price would let anyone add items to their cart at
whatever price they chose to send. Fixed by looking up the real product
price from the database inside the service — the "price snapshot at
add-time" semantic (from `apps/web/src/types/cart.ts`'s own doc comment)
is about not retroactively repricing existing cart lines when the
catalog price changes later, not about trusting the client for the price
in the first place. A dedicated test proves the fix: the server looks up
and stores the real price regardless of what (if anything) a caller
might try to send.

### Real cross-phase integration

`CartService` calls `InventoryService.getAvailability()` (Phase 3) for
every quantity change — never trusts a client-supplied stock cap. The
guest-cart merge-on-login logic caps *combined* quantities at real, live
availability: a specific test proves a naive `2 + 8 = 10` combination
gets correctly capped to `5` because that's what's actually in stock,
while never shrinking a quantity the user already had.

### Coupons and shipping port the frontend's exact logic, not an approximation

`CouponsService` and `ShippingService` were built by reading
`couponService.ts`/`shippingService.ts`/`region.ts` directly — same
normalization (trim + uppercase), same `isFarRegion` ZIP-digit
boundaries, same error message wording character-for-character (a test
asserts the exact string `"This code needs a $25 subtotal — add $5.00
more."`). This matters beyond cosmetics: coupon/shipping logic that only
ever lived client-side, as it does in the frontend today, is trivially
bypassable. This phase is what makes that logic actually trustworthy —
a real backend authority the client can no longer fabricate a result for.

### API surface

`GET/POST/PUT/DELETE /cart`, `/cart/items/:productId` (all public,
guest-and-authenticated via the optional-auth pattern above),
`GET/POST/DELETE /wishlist/:productId` (Bearer — wishlist requires an
account), `POST /coupons/validate` (public), `POST /shipping/estimate`
(public).

### Seed data

Extended with the two real coupon codes from
`apps/web/src/data/coupons.ts` (`FOLIA10`, `WELCOME5`), matching value
and `minSubtotal` exactly.

### Testing

172 tests total (up from 144), all genuinely passing — including 14 for
`CartService` (covering the merge-cap logic, the price-lookup security
fix, and stock-limit enforcement), 6 for `CouponsService` (exact error
message matching), and 5 for `ShippingService` (fully executed, zero
Prisma dependency — genuine end-to-end logic tests, not mocked). See the
README's "Known Issues" — unchanged in kind, now spanning more files.

## Phase 5 — Checkout

### Schema

`Address` (matches `apps/web/src/types/address.ts` field for field),
`Order`, `OrderItem`. The schema went through a real redesign mid-phase:
the first version flattened every `Address` field onto `Order` twice
(shipping + billing) — ~24 duplicate columns, and still couldn't capture
the type fully. Caught before any service was built on top of it and
replaced with two JSON snapshot columns
(`shippingAddressSnapshot`/`billingAddressSnapshot`), the standard,
correct pattern for "preserve this whole object exactly as it was" —
verified against real PostgreSQL (`JSONB` insert/query round-trip) before
proceeding. `Order.id` is deliberately **not** `@default(uuid())` — it's
the `FOL-YYYYMMDD-NNNN` string `OrdersService` generates explicitly,
matching `apps/web/src/utils/orderId.ts` exactly, since that same string
seeds the deterministic courier/tracking-number hash.

Hand-verified with real inserted data: the full order→items join
resolves correctly, and — the one worth calling out — confirmed a user
with order history **cannot** be deleted (`RESTRICT`, unlike carts/
wishlists which cascade). That's deliberate: financial and legal records
shouldn't vanish because an account was deleted.

### A real security vulnerability caught and fixed before it shipped

While building `AddressesService.update()`/`.remove()`, an early version
used `where: { id, userId } as never` — a type-error-suppressing cast
over code that was not actually safe. `Address` has no compound unique
constraint on `(id, userId)`, so that `where` clause is not valid Prisma
syntax for `update`/`delete`; the realistic risk was Prisma silently
matching by `id` alone and ignoring the `userId` filter entirely —
meaning **any authenticated user could modify or delete another user's
saved address by guessing or discovering its id**. Caught by asking why
the cast was needed at all, rather than accepting that it made the type
error go away. Fixed with an explicit ownership check
(`existing.userId !== userId`) before any mutation. Two tests exist
specifically to prove this: attempting to update or delete an address
owned by someone else now throws `NotFoundException` and never reaches
the underlying mutation.

### Ported exactly, not approximated

`CouponsService` (Phase 4) already replicated the frontend's coupon
logic; this phase adds `PaymentsService` (the frontend's mock payment
flow, including its deliberate ~15% simulated decline rate for card/UPI/
net-banking, so the failure/retry path stays reachable in an ordinary
checkout) and the order-id/courier/tracking-number utilities
(`apps/web/src/utils/orderId.ts`/`tracking.ts`). The hash-based courier
assignment was verified against **hand-computed reference values** —
the expected hash, courier, and tracking number for a known input were
computed independently in a throwaway script before the corresponding
test was written, then the real implementation was asserted against
those precomputed numbers. That's a materially stronger guarantee than a
test only checking "the function is deterministic."

### A real, honestly-documented transactional gap

`OrdersService.checkout()` decrements inventory one cart line at a time
(each its own transaction, via `InventoryService.decrementForProduct`),
not as a single atomic group covering the whole order. A failure
partway through (line 3 of 5 out of stock) would leave lines 1–2 already
decremented with no automatic rollback — closing this properly needs a
shared transaction client threaded through every service involved (Cart,
Address, Inventory, Order creation), which isn't how these already-
independent services are built. The actual mitigation: every line's
availability is checked up front, before payment is even attempted, so
the common case is caught and rejected before anything is charged or
decremented. This does **not** close a genuine race between that check
and the later decrement under concurrent checkouts for the same
low-stock item — stated plainly in the method's own doc comment, not
hidden.

### Real cross-phase integration, the whole way through

A single `checkout()` call touches every prior phase for real:
`CartService` (Phase 4) for the cart being purchased,
`AddressesService` (this phase) with ownership verification,
`CouponsService` (Phase 4) for discount validation,
`InventoryService` (Phase 3) for availability and stock decrement, and
`PaymentsService` (this phase) for the mock charge — then clears the
cart and creates the order only after every step succeeds.

### Testing

213 tests total (up from 172), all genuinely passing — 11 for
`OrdersService.checkout()` alone, covering the pre-check-before-payment
ordering, exact tax/discount math for both coupon types, declined-
payment propagation, and the deterministic order-id/courier/tracking
assignment. See the README's "Known Issues" — unchanged in kind, now
spanning more files.

## Phase 6 — Order Management (cancellation, returns, tracking)

### A deliberate, honest scope decision

The frontend's order tracking is a genuine time-based *simulation*
(progress derived from elapsed real time since order placement, with a
deterministic per-order delay), not persisted tracking-event data — so
it needed no new schema, just faithfully-ported computation
(`TrackingService`). Cancellation and returns, by contrast, are genuine
state changes and got real tables
(`CancellationRequest`, `ReturnRequest`).

### A design choice preserved exactly, not simplified away

`apps/web/src/utils/refund.ts`'s refund status is **derived from
elapsed time at read time, never stored as "refunded" directly** — a
genuinely elegant choice (no background job ever needs to exist just to
flip a status after a delay) that this phase's schema preserves exactly:
no `refundStatus` column exists anywhere; `CancellationRequest`/
`ReturnRequest` store only `requestedAt` (and, for cancellations only, a
`hasRefund` boolean — false only for a COD order cancelled before
delivery, since nothing was ever charged). `refund.util.ts` ports
`deriveRefundStatus`/`canCancelOrder`/`canReturnOrder` exactly, including
the deliberately-short 3-minute refund-processing window and the 30-day
return window.

Hand-verified against real PostgreSQL: the one-cancellation-per-order
constraint is genuinely enforced at the database level (a second
cancellation attempt on an already-cancelled order is rejected by
Postgres itself), not just checked in application code.

### Tracking simulation, ported exactly

`TrackingService` replicates `apps/web/src/mocks/trackingHandlers.ts`'s
full simulation — the same deterministic ~1-in-6 delay bucket (seeded
from the order id's hash, so it doesn't toggle on refresh), the same
stage-progression math, the same proof-of-delivery generation. 10 tests
cover it, including hand-verified fixtures for both the delayed and
on-time branches (found by computing `hashOrderId() % 6` for several
candidate order ids in a throwaway script until one of each was found,
the same reference-value discipline used for the Phase 5 courier/
tracking-number tests). A cancelled or returned order's tracking now
correctly **freezes** at the cancellation/return moment rather than
continuing to "progress" toward a delivery that's no longer happening.

### API surface

`POST /orders/:id/cancel`, `POST /orders/:id/return`,
`GET /orders/:id/tracking` — all Bearer-authenticated, scoped to the
caller's own orders.

### Testing

243 tests total (up from 213), all genuinely passing — 20 for
`OrdersService` alone (up from 11), 10 for the tracking simulation, 11
for the refund/eligibility utilities. Caught and fixed real gaps in the
tests themselves along the way, not just the production code: a missing
`prisma.order.update` mock caused three tests to fail with a genuine
`TypeError` on the first run, fixed by completing the mock rather than
loosening the assertion. See the README's "Known Issues" — unchanged in
kind, now spanning more files.

## Phase 7 — Search

### A scope decision made through evidence, not memory

The root README's own phase table only ever said *"7–10: see the backend
development brief"* — that brief was the original prompt and isn't a
file in this repo, so by the time this phase started, neither this
codebase's documentation nor available context could say what Phase 7
was on their own. Rather than guess, the actual repo was inspected
directly (module listing, existing `reviews` controller, frontend
`searchStore`/`textMatch.ts`/`searchRanking.ts`) to determine what was
genuinely missing and genuinely backend-appropriate:

- **Search**: real gap — no `search` module existed anywhere in
  `apps/api/`, and the frontend's ranking/did-you-mean logic was entirely
  client-side. **In scope.**
- **Review submission**: no frontend UI for it exists at all (confirmed
  by search — zero matches for `submitReview`/`createReview` anywhere in
  `apps/web/`), and nothing in the repo's own documentation calls for it
  at this stage. **Deferred**, not built to fill the phase.
- **Search analytics**: `apps/web/src/store/searchStore.ts` already
  tracks `recentSearches`/`analyticsEvents` locally, working correctly —
  promoting that to cross-user backend analytics is a distinct, larger
  concern than "search" itself. **Deferred.**
- **Blog/article search**: no `blog` backend entity exists anywhere;
  building one solely to make it searchable would be scope creep beyond
  search. **Deferred.**

### Schema

One deliberately minimal table, `SearchQuery` (just `term` +
`createdAt`) — logs every real search performed, so "trending searches"
can be computed from genuine usage instead of continuing to serve the
frontend's static fake pool
(`apps/web/src/data/trendingSearches.ts`). Verified against real
PostgreSQL with actual inserted data: five logged searches (three for
"monstera") correctly aggregate to "monstera" ranking first — real
`GROUP BY`/`ORDER BY`, not simulated.

### A real bug caught by the test suite itself, not hidden by a passing mock

The first version of `SearchService`'s did-you-mean logic built its
typo-correction candidate list from the *already-filtered* search
results. That's exactly backwards: when someone types a genuine typo,
the SQL `contains` filter (`ProductsService.findMany`) has already
returned nothing to compare against, so did-you-mean could never
actually fire for a real typo — only in an artificial test where a
matching product had mistakenly been mocked into the "filtered" results
directly. Caught by the test itself failing, not by inspection. Fixed by
querying a separate, broader (though still bounded) candidate list —
matching `apps/web/src/hooks/useSearchResults.ts`'s own approach, which
explicitly uses the *full* unfiltered catalog for exactly this reason —
triggered only on the zero-results path, so it costs nothing on a normal
search.

### A real, not cosmetic, improvement over the frontend's own ranking

`apps/web/src/utils/searchRanking.ts`'s `scoreProduct` factors in
`wishlistIds`/`purchasedProductIds` as ranking signals, but the frontend
can only ever supply whatever's already loaded in local client state.
For an authenticated backend caller, `SearchController` now supplies the
**real** signals — actual wishlist rows (`WishlistService`, Phase 4) and
actual purchase history (`OrdersService.getPurchasedProductIds`, a new,
deliberately lightweight distinct-product-id query) — not an
approximation of them. Search stays fully public and functional for
guests via the same optional-auth pattern (`OptionalJwtAuthGuard` +
`@OptionalCurrentUser()`) introduced for cart in Phase 4.

### Real gaps caught and fixed while wiring the module, not after

`WishlistModule` and `OrdersModule` didn't export their services —
harmless while nothing outside their own controllers needed them
directly, but `SearchModule` now injects both, and the missing
`exports:` would have caused a silent NestJS dependency-injection
failure at boot. Caught by deliberately checking both modules before
wiring `SearchModule`, the same discipline established after the
identical gap was caught in Phase 5 (`CartModule`/`CouponsModule`).

### API surface

`GET /search?q=` (public, richer for authenticated callers — see above),
`GET /search/trending` (public, real aggregated data).

### Testing

270 tests total (up from 243) — 9 for text-matching/did-you-mean
(including hand-verified Levenshtein boundary cases), 9 for product
ranking, 8 for `SearchService` (including the did-you-mean bug fix,
proven with a test that correctly simulates the real filter behavior
rather than the flawed one that originally masked the bug), plus 1 new
test for `OrdersService.getPurchasedProductIds`. Coverage: 54.61%, up
from 52.51% — this phase's new logic is almost entirely
Prisma-independent and fully tested. See the README's "Known Issues" —
unchanged in kind, now spanning more files.

## Phase 8 — Recommendations + Analytics Foundation

### Scope arrived at through repository evidence, twice now

An injected roadmap document claimed a notifications backend already
existed. Checked directly before accepting it: it doesn't —
`notificationStore` has always been purely local client state. Corrected
in the Phase Recovery Report rather than silently absorbed, the same
"verify before trusting a claim about the codebase" discipline the
roadmap document itself demanded.

### A real upgrade over the frontend, not just a port — caught by reading the roadmap carefully

The roadmap explicitly requires frequently-bought-together to derive
from real order data, not hardcoded relationships. The frontend's own
current version (`apps/web/src/utils/recommendations.ts`) is a
deterministic category-based placeholder — there's no real
cross-customer purchase data behind it, by the frontend's own admission
in its source comments. This phase builds the real thing:
`RecommendationsService.getFrequentlyBoughtTogether()` queries actual
`OrderItem` co-occurrence (which products were bought in the same real
orders), only falling back to the category-based pick to fill gaps when
genuine history is thin — proven with tests for all three states
separately: full real data (fallback never queried), zero real data
(fallback fully used), and partial real data (both used together,
supplementing rather than replacing).

### Schema

`AnalyticsEvent` — one deliberately generic, append-only event log. This
is the first table in the whole schema with **no foreign keys** to what
it references (`userId`/`productId`/`orderId` are plain nullable
strings) — a real, documented departure from every prior table's
pattern, not an oversight: an analytics/audit trail should stay valid
after the entity it references is deleted, and a logging write should
never be able to fail because of a transactional-entity constraint.
Hand-verified against real PostgreSQL with two different real
aggregations proven working: trending-products-by-view-count, and
revenue summed from JSON metadata.

### A real correctness fix, caught before any controller was built on the wrong version

The first version of `AnalyticsService.totalRevenue()` summed the
`total` field out of `ORDER_COMPLETED` event metadata. Reconsidered
before building `AnalyticsController` on top of it: revenue is financial
data with an authoritative source of truth already (`Order.total`, real
checkout completions since Phase 5) — deriving it from the event log
instead would make its accuracy silently depend on every checkout also
successfully logging an event, which isn't a guarantee. Fixed to query
the real `Order` table directly. `getOrderStats()`/`getCustomerStats()`
(added the same session) follow the same principle: authoritative
tables for financial/customer counts, `AnalyticsEvent` only for
behavioral signals (views, searches) that have no other home.

### A real circular-dependency bug caught before it shipped, fixed architecturally rather than patched

Wiring `ProductsController` directly to `AnalyticsService` created a
genuine module cycle: `ProductsModule → AnalyticsModule → SearchModule →
ProductsModule` (`SearchModule` already depends on `ProductsModule` from
Phase 7). Caught before merging, not discovered at boot. Rather than
reach for `forwardRef()` — a patch that would have hidden a real
architectural signal (`ProductsModule` is foundational and several other
modules already depend on it; it should never depend on a
higher-level "consumer" module like Analytics) — this was fixed properly
with an event-driven pattern: `@nestjs/event-emitter` (real, verified
current version 12.0.0 — after first mistyping a guessed version number
immediately after checking the real one, caught and corrected in the
same turn), registered globally in `AppModule`. `ProductsController`/
`OrdersController` now emit plain events (`analytics.product_viewed`,
`analytics.order_created`) via the global `EventEmitter2`, with zero
import of `AnalyticsModule`; `AnalyticsEventListener` (living inside
`AnalyticsModule`, the only module that needs to know `AnalyticsService`
exists for this purpose) listens and logs.

A separate, narrower issue surfaced while wiring this in: ESLint flagged
the `.emit()` calls as unsafe — but `tsc` itself had zero complaints
anywhere. Traced to `eventemitter2`'s `package.json` having no `"types"`
or `"exports"` field, just a bare `"main"`; `tsc`'s resolver finds the
root-level `.d.ts` via legacy convention, typescript-eslint's parser
apparently doesn't. A real, third-party-package-specific quirk, not
unsafe code — documented with a scoped disable distinct from this
codebase's existing Prisma-generation exemption pattern, not conflated
with it. Also caught and fixed a comment-placement mistake in the same
area: `eslint-disable-next-line` only suppresses the *immediately*
following line, and an early version put a multi-line explanation
between the directive and the code it was meant to cover, silently
never applying.

### API surface

`GET /recommendations/products/:id/similar`,
`GET /recommendations/products/:id/frequently-bought-together`,
`GET /recommendations/personalized` (public, richer for authenticated
callers via real wishlist/purchase signals — same optional-auth pattern
as Cart/Search), `GET /recommendations/bestsellers`,
`GET /recommendations/trending` (real `PRODUCT_VIEW` event data);
`GET /analytics/{overview,revenue,orders,products,customers,search}`
(admin-gated, real aggregation throughout — no placeholder endpoints).

### A deliberate, stated scope cut

Event-logging is wired into two real, high-value flows this phase
(`PRODUCT_VIEW`, `ORDER_CREATED`) — enough to prove the whole pipeline
genuinely works end-to-end with real data, not an empty table. The
remaining event types the roadmap lists (`ADD_TO_CART`, `WISHLIST_ADD`,
`CATEGORY_VIEW`, `CHECKOUT_STARTED`, `ORDER_CANCELLED`,
`RECOMMENDATION_CLICK`) are defined in the schema and ready to wire in,
but not yet connected — said plainly rather than implied complete.

### Testing

308 tests total (unchanged in count from before this session's
mid-phase revisions, since the circular-dependency fix and the
totalRevenue correction were caught and fixed before any test was
written against the wrong versions) — 8 for `AnalyticsService`
(originally), extended to 12 after the revenue/order/customer-stats
work, 9 for `RecommendationsService` (including all three
real-vs-fallback FBT states), 7 each for the similarity and
personalization ranking utilities. Two more real test-design bugs
caught by the tests failing, not by inspection, in the same category as
Phase 7's: `personalization.util.spec.ts` initially put the very
products being scored into their own `wishlistIds`, which the algorithm
correctly excludes from results entirely — silently invalidating the
test's premise until it failed. See the README's "Known Issues" —
unchanged in kind, now spanning more files.

## Phase 9 — Admin Dashboard + Admin Operations

### A real security decision made before writing any controller code

The roadmap suggested fine-grained permission keys
(`PRODUCT_MANAGE`, `ORDER_MANAGE`, etc.). Before using them, checked what
this codebase's actual seeded permissions grant: `'orders:read'` is
genuinely shared between the `customer` and `admin` roles (customers
need it for their own order history). Gating an admin "list every
customer's orders" endpoint with `@RequirePermissions('orders:read')`
alone would have let any ordinary customer view everyone's orders — a
real authorization bypass, not a theoretical one. Every new admin
controller uses `@Roles('admin')` uniformly instead, matching the
established pattern from `WarehousesController`/`AnalyticsController`
(Phases 3 and 8), specifically to avoid this permission-overlap trap.

### Schema

`AuditLog` — real fields (`actorId`, `action`, `resource`, `resourceId`,
`metadata`, `ipAddress`, `createdAt`), no foreign keys (same deliberate
reasoning as Phase 8's `AnalyticsEvent`: an audit trail must survive the
deletion of what it references). Hand-verified against real PostgreSQL
with a genuine, ordered audit-trail query for a specific resource.

### A real security bug caught by a test failing, not by review

`AuditService`'s secret-scrubbing logic lowercases the *input* metadata
key for comparison but, in its first version, never lowercased the
`SENSITIVE_METADATA_KEYS` list itself — so `'cardnumber'.includes
('cardNumber')` (mixed case) silently evaluated to `false`.
`cardNumber`, `accessToken`, `refreshToken`, and `cvv` would never
actually have been redacted despite the code looking correct. Caught
because the test failed with the raw value still present, not because
the logic was re-read carefully enough to notice. Fixed by lowercasing
both sides of the comparison consistently.

### Real admin operations, not placeholders — extending services that were read-only or self-service-only through Phase 8

- **Products** (`ProductsService`, read-only since Phase 2): real
  `adminCreate`/`adminUpdate`/`adminSoftDelete`. Deliberately never
  accepts `stockCount`/`inStock` from admin input — those stay
  `InventoryService`'s exclusive derived-cache domain (Phase 3), proven
  with a test showing they're always initialized to `0`/`false`
  regardless of what's sent. A real consistency bug was caught and fixed
  *before* writing the reverse DB mapper: the first draft of the admin
  write DTO used a different casing convention (`'bestseller'`) than
  what the same field already returns on every read (`'Bestseller'`,
  since Phase 2) — would have broken the obvious admin workflow of
  editing a product without touching its badge. Fixed to match exactly,
  proven with a dedicated round-trip test
  (`toPublicProduct` → `badgeToDb` → back to the original enum).
- **Orders** (`OrdersService`, user-scoped only through Phase 8): real
  `adminFindAll` (every customer's orders) and `adminUpdateStatus`, with
  a genuinely restricted state machine
  (`order-status.util.ts`) covering *only* the forward fulfillment
  pipeline (`PROCESSING → CONFIRMED → SHIPPED → DELIVERED`) —
  deliberately excluding `CANCELLED`/`RETURNED`/`REFUNDED` entirely,
  since those already have dedicated, side-effect-bearing endpoints
  (`requestCancellation`/`requestReturn`, Phase 6) that create the
  actual request records refund-status derivation depends on. A generic
  status update bypassing those would produce a cancelled order with no
  cancellation record behind it — a real data-integrity gap, not just an
  inconsistency. Proven with a test showing an invalid transition never
  even attempts to write, not just that it rejects.
- **Inventory** (`InventoryService`): `getLowStockItems()` — genuine
  detection (`quantityOnHand <= reorderPoint`), honestly documented as
  an in-memory filter (Prisma's query builder can't compare two columns
  directly) with a stated scale limit, not a silent one.
- **Users** (`UsersService`, self-service/internal-only through Phase
  8): real `adminFindAll`, `adminDeactivate` (which also revokes every
  active session for the account, reusing `SessionsService.
  revokeAllForUser` from Phase 1 rather than duplicating that logic — a
  deactivated account keeping a valid refresh token would make the
  deactivation meaningless), and `adminUpdateRole` (validates the target
  role genuinely exists before assigning it, rather than trusting a
  client-supplied role name).

### Two real process gaps caught and corrected, worth naming plainly

A test file edit went genuinely wrong mid-turn: new `describe` blocks
were appended *after* the outer block's closing brace instead of inside
it, so they couldn't see the shared mock fixtures at all — a
`ReferenceError`, not a subtle bug, requiring the whole tail of the file
to be rewritten cleanly rather than patched incrementally. Separately,
`UsersModule` never imported `SessionsModule`/`RolesModule` at all once
`UsersService` gained those dependencies — the same class of gap now
caught and fixed in six separate modules across this project's history
(`CartModule`, `CouponsModule`, `WishlistModule`, `OrdersModule`,
`SearchModule`, and now `UsersModule`). Recorded here plainly because
the pattern recurring six times is itself worth knowing, not just each
individual fix.

### API surface

`POST/PUT/DELETE /admin/products/:id`, `GET /admin/orders`,
`PUT /admin/orders/:id/status`, `GET /admin/inventory/low-stock`,
`GET /admin/users`, `DELETE /admin/users/:id`,
`PUT /admin/users/:id/role` — all `@Roles('admin')`-gated, every
mutation logged to `AuditLog` with the acting admin's real id and the
request's real IP.

### Testing

347 tests total (up from 314), all genuinely passing — 7 new for
`ProductsService`'s admin methods, 6 for `OrdersService`'s admin
methods plus 6 for the status state machine, 4 for
`InventoryService.getLowStockItems`, 6 for `UsersService`'s admin
methods, 6 for `AuditService` (including the real redaction bug). See
the README's "Known Issues" — unchanged in kind, now spanning more
files.

## Phase 11 — Production Hardening

### An audit before any code — most of this phase was already done

Before writing anything, checked what earlier phases had already built:
Helmet, CORS, cookie-parser, a strict global `ValidationPipe`
(whitelist/forbidNonWhitelisted/transform), a global exception filter,
structured Pino logging with secret redaction, Argon2id password
hashing, refresh-token rotation with reuse detection, and rate limiting
— confirmed the throttler's tighter auth-specific limits genuinely exist
in `auth.controller.ts` (`@Throttle`), not just claimed in a comment.
This phase's real work is what was genuinely missing: idempotency,
explicit payload limits, and closing one real N+1 query gap.

### Real idempotency protection for checkout — the roadmap's own specific example

Before this phase, nothing prevented a double-submitted checkout
(double-click, a network retry resubmitting a request it thinks failed)
from creating two separate orders, charging twice, and decrementing
real inventory twice. Fixed with a standard `Idempotency-Key` header
(the same convention Stripe/PayPal use) and a real database constraint —
`Order.idempotencyKey`, `@@unique([userId, idempotencyKey])` — checked
*before* any other work (cart resolution, payment, inventory) happens,
not just as an afterthought. Hand-verified against real PostgreSQL that
the NULL-handling behaves exactly as the design depends on: two orders
with no key coexist normally for the same user, while a genuine
duplicate key is rejected at the database level, not just in
application code.

A real behavioral bug was caught while wiring this in, in the same
session: the `ORDER_CREATED` analytics event (Phase 8) fired
unconditionally, meaning a duplicate request correctly *not* creating a
second order would still have double-counted it in analytics. Fixed by
having `checkout()` explicitly signal whether its response is a fresh
creation or an idempotent replay (`isIdempotentReplay`, present and
`true`/`false` on both paths — a consistent, predictable shape, not
sometimes-present-sometimes-absent), with the controller only emitting
the event for a genuinely new order.

### A near-miss caught by checking NestJS's actual types, not assumed API knowledge

Explicit JSON body-size limits (256kb — every real payload this API
accepts is small; the only large upload, avatars, has its own separate
2MB multipart limit and is unaffected) needed adding to `main.ts`. A
first instinct — just `app.use(json({limit}))` on top of Nest's
default setup — would have caused a double-body-parsing conflict.
Caught by checking `NestApplicationOptions`' real type definition
directly, which confirmed `bodyParser: false` must be set first, then
separately confirmed the avatar endpoint (`multer`'s `FileInterceptor`)
is unaffected, since it parses `multipart/form-data` independently of
the generic body parser being replaced.

### A real N+1 query fix, flagged in Phase 8 and closed here

`RecommendationsService.getFrequentlyBoughtTogether()` and
`getTrending()` both resolved a list of product ids via N separate
`findByIdOrThrow` calls (concurrent via `Promise.all`, so not
sequential, but still N real database round-trips). Added
`ProductsService.findManyByIds` — one batched query — with a test
specifically proving the part most likely to be silently wrong: it
preserves the *caller's* intended ranking order, not whatever order the
database happens to return, since these are ranked results where order
carries real meaning.

### A real, verified index gap — introduced by this same phase's own fix, caught in the same pass

Adding the `findManyByIds`/co-occurrence work above made
`OrderItem.productId` a genuinely hot query field
(`getFrequentlyBoughtTogether`'s `where: { productId }` lookup) with no
index behind it. Fixed and *proven*, not just added: `EXPLAIN`'d the
real query against 20,000 rows in real PostgreSQL and confirmed the
planner actually chooses `Bitmap Index Scan on
"order_items_test_productId_idx"`, not a sequential scan.

### Testing

356 tests total (up from 347) — 5 new for the checkout idempotency
behavior (including the critical "never touches cart/payment/inventory
again" proof), 4 for `findManyByIds` (including the ordering-
preservation guarantee), 6 existing `RecommendationsService` tests
updated to match the batched-query refactor rather than the old N-calls
mock shape. A Redis-dependent test suite failed mid-session during this
phase — investigated rather than dismissed, confirmed genuinely
environmental (Redis had stopped running in the sandbox), and
reconfirmed passing after restarting it. See the README's "Known
Issues" — unchanged in kind, now spanning more files.

## Phase 12 — Observability + Background Processing

### An audit before code, again — checking what real dependency checks already existed

`GET /health` already checked both the real database and real Redis
(Phase 0), not a placeholder. What was genuinely missing was the
K8s-style distinction between liveness and readiness: `GET /health/live`
now checks nothing beyond "the process can respond" — deliberately, not
as a placeholder. Conflating liveness with dependency health (as the
original single `/health` endpoint effectively does, kept for backward
compatibility) means an orchestrator would restart a healthy pod during
a transient database blip, which doesn't fix anything and adds restart
churn on top of an already bad situation. `GET /health/ready` carries
the real dependency checks and is the one an orchestrator should gate
traffic routing on. Confirmed directly against Terminus's own
`HealthCheckExecutor` source (not assumed) that an empty indicator
array resolves cleanly to a real `'ok'` status, not an error.

### Real request-ID correlation, checked against pino-http's actual type signature

Every log line for a request now carries a real UUID — honors an
incoming `X-Request-Id` header if present (a load balancer or upstream
service may have already assigned one, which should be preserved for
cross-service tracing, not overwritten) and generates one otherwise,
setting it on the response too. `genReqId`'s real signature —
`(req, res) => id`, not just `(req) => id` — was checked directly
against `pino-http`'s own type definitions before being used.

### A real background job, not a token gesture at the roadmap's checklist

`InventoryService.releaseExpiredReservations()` has existed and been
tested since Phase 3, with a doc comment literally saying "meant to be
called on a schedule once BullMQ background jobs exist." That's now
true — `ReleaseExpiredReservationsProcessor`, scheduled every 5 minutes
via BullMQ's `upsertJobScheduler` (idempotent across app restarts,
confirmed against BullMQ's own doc comment before relying on that
property). The job body is a thin wrapper; all the real logic (finding
expired reservations, releasing them, restoring reserved stock) was
already built and tested in Phase 3 — this phase's job was scheduling
and running it for real, not reimplementing it.

The connection setup required real verification, not assumption: BullMQ
requires `maxRetriesPerRequest: null` for its blocking operations —
confirmed directly against `bullmq`'s own connection-handling source,
which warns and force-overrides this value otherwise. That conflicts
with `RedisService`'s own `maxRetriesPerRequest: 3` (correct for that
service, wrong for BullMQ), so the job runs on a **separate**,
correctly-configured Redis connection rather than a reused one that
would have silently misbehaved. `BullModule`, `WorkerHost`,
`@Processor`, `@InjectQueue`, and `ConnectionOptions`' real shapes were
all checked directly against the installed package's type definitions
before use — including discovering `ConnectionOptions` doesn't accept a
plain URL string, which an assumption would have gotten wrong.

### A genuinely new class of failure for this project — caught by running tests, not by reading types

Writing the processor's tests hit something no amount of
type-checking could have caught: `@nestjs/bullmq` is pure ESM, and
Jest's default configuration doesn't transform anything inside
`node_modules` — the first test run failed with a plain
`SyntaxError: Unexpected token 'export'`. Diagnosed by checking the
package's real `package.json` (`"type": "module"`), not guessed.
The narrowly-targeted fix (`transformIgnorePatterns` exempting only
this package) then hit the exact same error from a *transitive*
dependency (`@nestjs/bull-shared`) — checked that one too before
widening the fix, rather than reaching for an overly broad pattern that
would have transformed far more of `node_modules` than necessary. This
is the first failure in this whole project's history that wasn't
findable by reading type definitions alone; it needed an actual test
run and reading real Jest output.

### What is and is not verified — same honesty standard as Phase 10

**Verified**: every new file compiles (`tsc`), lints (zero warnings),
and the processor's own logic (schedule registration, delegation to
`InventoryService`, both a real and a zero-count result) is proven with
3 genuine unit tests. Every third-party API used (`pino-http`'s
`genReqId`, `@nestjs/bullmq`'s `BullModule`/`WorkerHost`/`@Processor`/
`@InjectQueue`, `bullmq`'s `ConnectionOptions`/`RepeatOptions`) was
checked against its real, installed type definitions before use, not
assumed from memory.

**NOT verified, and cannot be from this sandbox**: whether the app
actually boots with `JobsModule` wired in, whether a real BullMQ worker
actually connects to Redis and picks up scheduled jobs, whether the
liveness/readiness endpoints behave correctly under a real orchestrator,
and whether request-ID correlation actually threads through a real
multi-request trace. Same category of limitation as Phase 10's
auth-domain integration work — stated here plainly rather than implied
away by a clean `tsc`/`eslint`/`jest` run, which prove the code is
correct in isolation, not that the system behaves correctly live.

### Testing

359 tests total (up from 356) — 3 new for
`ReleaseExpiredReservationsProcessor`. No dedicated tests for
`main.ts`'s payload-limit change or `HealthController`'s new endpoints
beyond compilation, consistent with this project's established
convention of not unit-testing bootstrap/infra wiring files. See the
README's "Known Issues" — unchanged in kind, now spanning more files,
plus the new Jest ESM-transform note above.

## Phase 13 — Final Production Release (audit, not new features)

Per the roadmap's own instruction, this phase is explicitly not for
adding features — it's for auditing whether everything built in Phases
0–12 actually constitutes a production-ready system, and saying so
honestly.

### The central finding, stated first because it matters most

**This project cannot be declared "production ready."** Not because
the code is wrong, but because an entire category of verification —
does the app actually boot, does a real HTTP request reach it, does a
migration actually run — has been structurally impossible in every
sandbox this was built in (`prisma generate` blocked since Phase 0, no
Docker daemon). `PRODUCTION_READINESS.md` (repo root) is the full,
itemized report the roadmap requires, with an honest `PASS`/`PARTIAL`/
`BLOCKED`/`NOT IMPLEMENTED` for every category — most business-logic
domains are `PARTIAL` (real, unit-tested, never live-verified), not
`PASS`, and that distinction is treated as meaningful throughout, not
rounded up.

### Real work this phase, beyond the audit itself

- Two genuinely missing pieces of the roadmap's "Final Documentation"
  list were written: `DATABASE.md` and `SECURITY.md` (`DEPLOYMENT.md`
  didn't exist as a standalone document either — added). Every claim in
  each was checked against the actual code or actually run, not
  written from memory of what was probably built — including
  re-verifying `Order.user`'s `onDelete: Restrict` directly against the
  schema before asserting it in `DATABASE.md`, rather than trusting
  recollection of Phase 5.
- `npm audit` was **actually run**, not listed as a skipped check: 3
  high-severity findings, all one root cause (`deepmerge-ts`, via
  `@prisma/config` → `prisma`), all confined to a dev-only dependency
  that doesn't ship in the production image. A fix is available but was
  deliberately **not applied** — it would change `prisma`'s own
  version, and this sandbox has no way to verify `prisma generate`
  still works afterward, so applying an unverifiable change this late
  was judged riskier than documenting a known, low-real-risk,
  dev-only issue clearly.
- `Dockerfile` and `docker-compose.yml`'s health checks were updated to
  target the new `/health/ready` endpoint (Phase 12) instead of the
  plain `/health` — semantically correct now that the distinction
  exists, verified as valid YAML after editing by hand rather than
  assumed.
- Confirmed directly (not assumed) that only one real e2e spec file
  exists (`health.e2e-spec.ts`) despite the CI workflow already
  referencing a `test:e2e` step — a real, honestly-stated gap against
  the roadmap's full E2E-user-journey requirement, deliberately not
  filled with new e2e code that couldn't be run and verified in this
  sandbox anyway.

### Testing

No new unit tests this phase (an audit phase, not a feature phase) —
359 tests, unchanged from Phase 12, reconfirmed passing after every
documentation/config change to prove nothing was silently broken along
the way.
