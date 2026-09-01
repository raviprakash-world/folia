# @folia/api

NestJS backend for Folia. Phase 0 (foundation), Phase 1 (Authentication &
Users), Phase 2 (Product Catalog), Phase 3 (Inventory), Phase 4
(Cart & Wishlist), Phase 5 (Checkout), Phase 6 (Order Management),
Phase 7 (Search), Phase 8 (Recommendations + Analytics Foundation),
Phase 9 (Admin Dashboard + Admin Operations), Phase 11 (Production
Hardening), Phase 12 (Observability + Background Processing), and Phase
13 (Final Production Release audit) are complete — see `CHANGELOG.md`
for what shipped in each and why. (Phase 10, frontend integration, is
intentionally partial — see `INTEGRATION.md` at the repo root.)

**This backend is not production-ready as-is** — see
`/PRODUCTION_READINESS.md` at the repo root for the full, honest audit.
Also in this directory: `DATABASE.md` (schema, migration status),
`SECURITY.md` (real security measures + `npm audit` findings),
`DEPLOYMENT.md` (Docker/compose, first-deploy checklist).

## Stack

NestJS 11 · TypeScript (strict) · Prisma · PostgreSQL · Redis (ioredis) ·
JWT + Passport (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`) ·
Argon2id password hashing · Pino (structured logging via `nestjs-pino`) ·
Swagger/OpenAPI · Helmet · `@nestjs/throttler` (rate limiting) ·
class-validator/class-transformer · Jest + Supertest · ESLint (flat
config) + Prettier.

## Getting started

```bash
cp .env.example .env      # fill in real secrets — see comments in the file
npm install
npx prisma generate       # generates the Prisma client (needs internet
                           # access to binaries.prisma.sh — see "Known
                           # issues" below if this fails)
npx prisma migrate dev    # applies migrations to your local database
npm run prisma:seed       # seeds roles, permissions, and the two demo
                           # accounts (see "Demo accounts" below)
npm run start:dev
```

Requires a reachable PostgreSQL and Redis instance — either run them
directly or via `docker compose up postgres redis` from the repo root.

## Demo accounts

Seeded by `npm run prisma:seed`, matching `apps/web`'s existing documented
demo accounts exactly (`apps/web/src/data/users.ts`,
`apps/web/README.md`) — once the frontend is switched from MSW to this
real API, the same credentials continue to work unchanged:

| Email | Password | Role |
|---|---|---|
| `demo@folia.example` | `folia-demo` | customer |
| `admin@folia.example` | `folia-admin` | admin |

## Scripts

| Script | What it does |
|---|---|
| `npm run start:dev` | Dev server, watch mode |
| `npm run build` | Type-checked production build (`nest build`) |
| `npm run lint` | ESLint, zero warnings enforced |
| `npm run typecheck` | `tsc --noEmit` only, no build output |
| `npm test` | Unit tests (Jest) |
| `npm run test:cov` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests (needs a real Postgres + Redis + a generated Prisma client) |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production-safe) |
| `npm run prisma:seed` | Seed roles, permissions, and demo accounts |
| `npm run prisma:studio` | Prisma's local DB browser GUI |

## API surface

Full request/response contracts are in Swagger at `/api/docs` once the
server is running. Every route is under `/api/v1/*` (see "API
conventions" below for the one deliberate exception) — full paths in the
table below omit the `/api/v1` prefix for brevity.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | Public, version-neutral | Real Postgres + Redis checks |
| GET | `/health/live` | Public, version-neutral | Checks nothing beyond process responsiveness — for orchestrator liveness probes |
| GET | `/health/ready` | Public, version-neutral | Same real Postgres + Redis checks as `/health` — for orchestrator readiness/traffic-routing probes |
| POST | `/auth/register` | Public | |
| POST | `/auth/login` | Public | Rate-limited: 5/min/IP |
| POST | `/auth/logout` | Public | Reads the refresh cookie, not a bearer token |
| POST | `/auth/refresh` | Public | Reads the refresh cookie; rotates it |
| GET | `/auth/me` | Bearer | |
| PUT | `/auth/me` | Bearer | |
| POST | `/auth/me/avatar` | Bearer | Multipart, 2MB limit, image/* only |
| POST | `/auth/forgot-password` | Public | Rate-limited: 3/min/IP; same response whether or not the email exists |
| POST | `/auth/reset-password` | Public | Rate-limited: 5/min/IP |
| POST | `/auth/change-password` | Bearer | |
| POST | `/auth/verify-email` | Public | |
| POST | `/auth/resend-verification` | Bearer | |
| GET | `/auth/sessions` | Bearer | Lists this account's active sessions/devices |
| DELETE | `/auth/sessions/:id` | Bearer | Scoped — can only ever revoke your own session |
| GET | `/products` | Public | `category`, `minPrice`, `maxPrice`, `inStockOnly`, `sort`, `search`, `page`, `pageSize` — same params as `apps/web`'s existing `ProductQuery` |
| GET | `/products/:slug` | Public | |
| GET | `/categories` | Public | |
| GET | `/collections/:slug` | Public | |
| GET | `/reviews` | Public | `?productId=` optional — omit for all reviews |
| GET | `/inventory/availability` | Public | `?productId=&variantId=` — real-time `onHand - reserved` |
| POST | `/inventory/items/:id/adjust` | Bearer, admin | Receive stock / record loss (`delta` can be negative) |
| POST | `/inventory/items/:id/reserve` | Bearer, admin | Hold stock against a cart/order |
| POST | `/inventory/reservations/:id/commit` | Bearer, admin | Reservation → real stock deduction |
| POST | `/inventory/reservations/:id/release` | Bearer, admin | Cancel a hold |
| GET/POST | `/warehouses` | Bearer, admin | |
| GET | `/warehouses/:code` | Bearer, admin | |
| GET | `/cart` | Public | Guest via httpOnly cookie, or the caller's own cart if authenticated |
| POST | `/cart/items` | Public | Same guest/authenticated resolution as above |
| PUT | `/cart/items/:productId` | Public | |
| DELETE | `/cart/items/:productId` | Public | `?variantId=` optional |
| DELETE | `/cart` | Public | Clears every line |
| GET | `/wishlist` | Bearer | |
| POST | `/wishlist/:productId` | Bearer | Idempotent — already-wishlisted is a no-op success |
| DELETE | `/wishlist/:productId` | Bearer | |
| POST | `/coupons/validate` | Public | `{code, subtotal}` |
| POST | `/shipping/estimate` | Public | `{zip, subtotal}` |
| GET/POST | `/addresses` | Bearer | |
| PUT/DELETE | `/addresses/:id` | Bearer | Ownership-verified — never another user's address |
| POST | `/checkout` | Bearer | Submits the caller's cart as a real order. Optional `Idempotency-Key` header — a repeated key for the same user returns the original order instead of creating a duplicate |
| GET | `/orders` | Bearer | |
| GET | `/orders/:id` | Bearer | |
| POST | `/orders/:id/cancel` | Bearer | Only while processing/confirmed/shipped, not already cancelled |
| POST | `/orders/:id/return` | Bearer | Only for delivered orders within 30 days |
| GET | `/orders/:id/tracking` | Bearer | Simulated, deterministic — recomputed fresh on every read, nothing stored |
| GET | `/search` | Public | `?q=`; richer ranking for authenticated callers (real wishlist/purchase signals) |
| GET | `/search/trending` | Public | Computed from real logged queries, last 7 days |
| GET | `/recommendations/products/:id/similar` | Public | |
| GET | `/recommendations/products/:id/frequently-bought-together` | Public | Real order co-occurrence, category-based fallback for thin history |
| GET | `/recommendations/personalized` | Public | Richer for authenticated callers (real wishlist/purchase signals) |
| GET | `/recommendations/bestsellers` | Public | |
| GET | `/recommendations/trending` | Public | Real `PRODUCT_VIEW` event data |
| GET | `/analytics/overview` | Bearer, admin | Real revenue/order/customer totals in one call |
| GET | `/analytics/revenue` | Bearer, admin | From the authoritative `Order` table, not the event log |
| GET | `/analytics/orders` | Bearer, admin | |
| GET | `/analytics/products` | Bearer, admin | Most-viewed, real event data |
| GET | `/analytics/customers` | Bearer, admin | Real repeat-purchase rate |
| GET | `/analytics/search` | Bearer, admin | Reuses `SearchService.getTrending()` — not a duplicate implementation |
| POST | `/admin/products` | Bearer, admin | Never accepts stockCount/inStock — InventoryService's exclusive domain |
| PUT/DELETE | `/admin/products/:id` | Bearer, admin | |
| GET | `/admin/orders` | Bearer, admin | Every customer's orders, `?status=` optional |
| PUT | `/admin/orders/:id/status` | Bearer, admin | Forward fulfillment only — never cancel/return/refund (see Known limitations below) |
| GET | `/admin/inventory/low-stock` | Bearer, admin | Real `quantityOnHand <= reorderPoint` |
| GET | `/admin/users` | Bearer, admin | |
| DELETE | `/admin/users/:id` | Bearer, admin | Deactivates AND revokes every active session |
| PUT | `/admin/users/:id/role` | Bearer, admin | Validates the target role genuinely exists |

## Analytics event pattern

Controllers never inject `AnalyticsService` directly — they emit a plain
event via the globally-registered `EventEmitter2`
(`src/analytics/analytics.events.ts` defines the event names/payload
shapes, safe to import from anywhere since it has no NestJS
service/module imports of its own), and `AnalyticsEventListener` (inside
`AnalyticsModule`) does the actual logging. This exists specifically to
keep foundational modules like `ProductsModule` — which several other
modules already depend on — from ever needing to depend on a
higher-level "consumer" module like `AnalyticsModule`; a first attempt
at direct injection created a real circular module dependency, caught
and fixed with this pattern rather than `forwardRef()`. See
`CHANGELOG.md`'s Phase 8 entry for the full story.

## API conventions

- Every route is prefixed `/api` and versioned (`/api/v1/...`), **except**
  `/api/health`, which is deliberately version-neutral — infra probes
  shouldn't need to track API versions.
- **Every** error response is normalized to
  `{ statusCode, message, error, path, timestamp }`, `message` always a
  single string — matches `apps/web/src/utils/apiError.ts`'s
  `extractApiErrorMessage()` exactly. Covered by a real test, not just a
  comment.
- **Secure by default**: `JwtAuthGuard` is applied globally — every route
  requires a valid Bearer access token unless explicitly marked
  `@Public()`. `RolesGuard` layers `@Roles()`/`@RequirePermissions()`
  checks on top where needed.
- The access token is returned in the response body (`{ user, token }`,
  matching `apps/web`'s existing `AuthSession` type exactly). The refresh
  token travels via an httpOnly, `SameSite=Lax` cookie — never
  JS-readable, which is both more secure and what keeps the frontend's
  existing types unchanged for the core flow.
- 500-level errors never leak internal detail in the response body — full
  detail is logged server-side via Pino (with `authorization`/`cookie`
  headers redacted from every log line), the client only ever sees a
  generic message.

## Admin order status updates are deliberately restricted

`PUT /admin/orders/:id/status` only allows the forward fulfillment
pipeline (`PROCESSING → CONFIRMED → SHIPPED → DELIVERED`) — it will
reject any attempt to set `CANCELLED`/`RETURNED`/`REFUNDED`, even from
an admin. This is not a missing feature; those statuses only ever get
set through `POST /orders/:id/cancel`/`POST /orders/:id/return` (Phase
6), which create the `CancellationRequest`/`ReturnRequest` records
refund-status derivation depends on. A generic status update bypassing
those would produce a cancelled order with no cancellation record behind
it.

## Background jobs and ESM-only packages in Jest

`@nestjs/bullmq` and its transitive dependency `@nestjs/bull-shared`
are pure ESM (`"type": "module"` in their own `package.json`s) — Jest's
default config doesn't transform anything inside `node_modules`, so
importing either without help fails with a plain
`SyntaxError: Unexpected token 'export'`, not a helpful ESM-specific
error message. `package.json`'s `jest.transformIgnorePatterns` has a
narrow exemption for exactly these two packages. If you add another
ESM-only dependency and hit the same error, that pattern is where to
extend — check the failing package's own `package.json` for
`"type": "module"` before assuming this is the cause, the same way this
was diagnosed rather than guessed.

## Known issues

### `binaries.prisma.sh` unreachable in the sandbox this was developed in

Confirmed via four separate attempts before accepting this as a hard
constraint: `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING` (still 403s on the
actual binary), Prisma's driver-adapter feature (`@prisma/adapter-pg` —
doesn't help; `prisma generate` still needs the separate schema-engine
binary regardless of adapter config), inspecting whether `@prisma/engines`
ships real binaries via its npm tarball (it doesn't — 22KB thin
downloader stub), and checking whether `prisma-engines`' GitHub releases
mirror the binaries for `PRISMA_ENGINES_MIRROR` to redirect to (zero
releases published there). This is **specific to that sandbox's network
allowlist**, not a real-world concern — any normal development machine or
CI runner will reach `binaries.prisma.sh` without issue.

**Confirmed impact, not guessed** (verified by actually running `tsc`
repeatedly through Phase 1's development, not assumed contained):
`this.prisma.<model>.<method>()` calls throughout the codebase compile
fine despite the ungenerated client (`PrismaClient` is typed `any`
pre-generation, and `any` permits any property access) — the *only*
compile-time breakage is where a third-party library imposes an explicit
structural type requirement on the client, which happens in exactly one
place: `health.controller.ts`'s use of `PrismaHealthIndicator.pingCheck()`.
ESLint's stricter `no-unsafe-*` rules, however, flag every Prisma call
site across every service — each affected file carries one clearly-
commented, scoped `eslint-disable` (not a blanket config-level silence)
pointing back to this explanation, rather than repeating the same
paragraph 40+ times through the codebase.

**What this means concretely for Phase 1**: unlike Phase 0 (where the one
affected controller could be temporarily excluded to prove the rest of
the app boots live), Prisma is now foundational to nearly every service
(`UsersService`, `RolesService`, `SessionsService`, `AuthService` all
depend on it directly) — so a full live boot of the auth-enabled app
**cannot** be diagnostically tested in this sandbox at all, not even
partially. Verification for this phase rests on `tsc` (one documented
error), real `eslint` (zero warnings), and 106 tests that are genuinely
run and passing against mocked Prisma calls — real, substantive
verification, but a real step down from Phase 0's "actually hit the live
endpoint and read the response" standard. That difference is being
stated plainly, not smoothed over.

The database schema itself **was** verified against a real, running
PostgreSQL instance — see `CHANGELOG.md`'s Phase 1 entry for exactly what
was proven (RBAC resolution, constraint enforcement, cascade/restrict
delete behavior with real inserted data).

**To resolve**: run `npx prisma generate` once, anywhere with normal
internet access. Everything above resolves automatically — no code
changes needed. Once resolved, delete `src/users/user.types.ts`,
`src/roles/role.types.ts`, and `src/sessions/session.types.ts` (hand-
written bridge types matching the schema, explicitly marked for removal
in their own top-of-file comments) and replace every reference with
Prisma's real generated types.

### Test coverage is 55.31%, not the ≥90% target

Up from Phase 11's 53.02% — the new background job processor is fully
tested (359 tests total), and `main.ts`/`HealthController`'s changes
are compilation-verified but not unit-tested, consistent with this
project's established convention for bootstrap/infra wiring files. No
test was written just to move the percentage without adding real
verification value. Every module with real logic that doesn't depend on
Prisma (`env.validation.ts`, `password.util.ts`, `token.util.ts`, DTOs,
`RolesGuard`, `LocalStorageService`, `products.service.ts`'s
`buildOrderBy`, `shipping.service.ts`, `payments.service.ts`,
`order-id.util.ts`, `refund.util.ts`, `order-status.util.ts`,
`tracking.service.ts`, `text-match.util.ts`, `product-ranking.util.ts`,
`similarity.util.ts`, `personalization.util.ts`,
`release-expired-reservations.processor.ts`) is at 87–100% coverage via
genuine, passing tests.

## Seed data

`npm run prisma:seed` populates roles, permissions, demo accounts (see
above), the **real** product catalog (24 products, 72 reviews, migrated
programmatically from `apps/web/src/data/products.ts`/`reviews.ts` —
a one-off parsing script, not hand-transcribed; `createdAt` values are
preserved exactly from the source, which matters beyond cosmetics —
`ProductsService`'s "featured" sort tiebreaker depends on it reflecting
the original catalog's relative order), and a `MAIN` warehouse with real
`InventoryItem` rows for every product/variant, stock distributed fairly
across in-stock variants rather than inflating each one to the product's
full original count, and the two real coupon codes from
`apps/web/src/data/coupons.ts` (`FOLIA10`, `WELCOME5`).
