# Security

What's actually implemented, where it lives, and what genuinely hasn't
been verified. Every claim below is checked against the real code at
the path given — this isn't a policy aspiration document.

## Authentication & password security

- **Argon2id**, OWASP-recommended parameters — `src/auth/password.util.ts`.
- **Refresh-token rotation with reuse detection**: a refresh token is
  single-use; presenting an already-rotated (reused) token revokes
  *every* session for that user, not just the one being used — treats
  reuse as a signal the token was stolen. `src/auth/auth.service.ts`.
- **No account enumeration in response shape**: login and
  forgot-password return an identical response body for "wrong
  password"/"account doesn't exist" — `src/auth/auth.service.ts`.
  **Known residual risk, not fixed in P0-C**: this is response-shape
  parity only, not timing-equalized. `forgotPassword()`'s not-found
  branch returns immediately; the found branch does an async token
  insert plus an email-send attempt, a measurably slower path. A
  response-time side channel is plausible. Not closed here — a correct
  fix (constant-time padding, or doing equivalent dummy work on the
  not-found branch) is nontrivial to get right and verify, and this is
  a low-value target (knowing whether an email has an account on this
  marketplace isn't especially sensitive) relative to the risk of a
  half-correct timing "fix" that doesn't actually equalize anything.
- **Password reset and email verification tokens**: generated with
  `crypto.randomBytes(32)` (not `Math.random`), stored as SHA-256
  hashes only (never plaintext), expire (30 min / 24h respectively),
  and are single-use (`usedAt` checked and set). A successful password
  *reset* revokes every existing session for that user — a stolen
  session shouldn't outlive the password that may have leaked it.
  **P0-C-4 fix**: self-service `change-password` (already logged in,
  not a token-based reset) previously did *not* revoke other sessions,
  inconsistent with `reset-password`'s behavior — a stolen/still-open
  session on another device wasn't force-logged-out when a user
  proactively changed their password. Now revokes every session the
  same way (`AuthService.changePassword`, `auth.service.spec.ts`).
- **Access tokens re-verify the USER against the database on every
  request** (`JwtStrategy.validate` calls `UsersService.findById`), not
  just JWT-signature-valid — a deactivated account (which also calls
  `SessionsService.revokeAllForUser`) is rejected on the very next
  request, not just after the access token's own short expiry.
  **Known residual risk, documented not fixed**: this per-request check
  is against the *user* record, not the *session* — revoking a single
  session (via logout, `DELETE /auth/sessions/:id`, or the
  reuse-detection/password-change/reset `revokeAllForUser` paths) stops
  that session's *refresh* token immediately, but any access token
  already issued for it keeps working until its own short (15-minute
  default) expiry — access tokens aren't session-checked per request.
  This is a deliberate, standard stateless-JWT tradeoff (checking session
  validity on every single request would mean a DB round-trip per
  request, defeating the point of a stateless access token), bounded by
  the short expiry, not an oversight — but worth stating plainly rather
  than implying "revoked session" means "immediately dead everywhere."

## Authorization

- `JwtAuthGuard` is **global and secure-by-default** — every route
  requires authentication unless explicitly marked `@Public()`. This was
  a deliberate inversion from the more common "opt into auth per route"
  pattern, specifically so a new route added later can't accidentally
  ship unauthenticated.
- `RolesGuard`/`@Roles()` and `@RequirePermissions()` — role- and
  fine-grained-permission-based checks, `src/auth/guards/`.
- **A real permission-overlap trap was caught, not just avoided in the
  abstract** (Phase 9): `'orders:read'` is genuinely granted to both
  `customer` and `admin` roles (customers need it for their own
  history). Every admin controller added in Phase 9 uses `@Roles
  ('admin')`, not `@RequirePermissions('orders:read')`, specifically
  because the latter would have let any customer view every other
  customer's orders. Checked against the real seed data
  (`prisma/seed.ts`) before writing any admin controller, not assumed
  safe.
- **IDOR protection is checked at the data layer, not just the route
  layer**, for every user-scoped resource — addresses, orders, cart:
  `AddressesService.findOwnedOrThrow` (and `OrdersService`'s equivalent
  user-scoping) verify ownership via an explicit `userId` match after
  fetch, not a `where: { id, userId }` compound query. This was a real,
  caught vulnerability (Phase 5): `Address` has no compound unique
  constraint on `(id, userId)`, so a naive compound `where` clause could
  silently match by `id` alone and let one user edit another's address.
- **P0-C systematic IDOR/authorization sweep** (customer orders/
  addresses/returns/sessions, seller profile/products/inventory/orders/
  earnings/ledger/payouts/verification-documents, admin-only routes) —
  every resource checked is server-side scoped by `req.user.id` /
  `req.seller.id` (from the JWT-derived identity, never a client-
  supplied id), and role guards are genuinely enforced (global
  `APP_GUARD` chain, not decorative). Full endpoint-by-endpoint findings
  are in this phase's audit; one real gap was found and fixed:
- **Seller-suspension enforcement gap (found and fixed, P0-C-5)**:
  `SellerGuard` is deliberately status-agnostic by design (it resolves
  whatever `Seller` row exists for the caller, regardless of `status` —
  see `SellersService.apply`'s own doc comment, which explains this was
  intentional so an `APPLIED`/`UNDER_REVIEW` applicant can still see
  their own application state). The gap: "actual selling permission
  gated on `Seller.status === 'ACTIVE'` in ... product-write services"
  was only true for `submitForModeration` — `archive`,
  `SellerFulfillmentController.ship`, and
  `SellerOrdersController.updateNote` had no such check, so an admin
  `SUSPENDED`/`DEACTIVATED`-ing a seller did not actually stop that
  seller from archiving products, shipping real customer orders, or
  editing fulfillment notes. Fixed by adding the same `ACTIVE`-only gate
  to all three, matching the existing `submitForModeration` pattern.
  Regression-tested: `seller-products.service.spec.ts`,
  `seller-fulfillment.controller.spec.ts`,
  `seller-orders.controller.spec.ts` (the latter two are this
  codebase's first controller-level spec files — every write endpoint
  here is otherwise tested at the service layer only, but this specific
  check genuinely lives in the controller because the underlying
  service method is shared with admin/internal callers that must NOT be
  status-gated).

## Mass assignment (P0-C-6)

Systematic DTO audit of every client-controlled field with real
authorization consequences (`sellerId`, `userId`, `role`, `status`
fields, `commission`, `price`, `paymentStatus`/`refundStatus`/
`orderStatus`, ledger/payout fields) found no exploitable path — every
one is either absent from customer/seller-facing DTOs entirely or
reachable only through a dedicated, role-gated transition endpoint.
Two defense-in-depth gaps were found and fixed:

- **`AdminUpdateRoleDto.role` had no allowlist** — any non-empty string
  passed the DTO layer (though `UsersService.adminUpdateRole` already
  validated the role exists in the real `Role` table before writing, so
  this was never actually exploitable — admin-only blast radius
  either way). Added `@IsIn(['customer', 'seller', 'admin'])`.
- **`UpdateProfileDto.avatarUrl` was directly client-settable** via
  `PUT /auth/me`, bypassing the size/MIME/magic-byte validation the
  dedicated `POST /auth/me/avatar` upload endpoint enforces. A user
  could only affect their own profile this way (no cross-tenant
  impact), but it defeated the point of the upload validator. Removed
  from the DTO entirely — `avatarUrl` is now set only by the upload
  endpoint, which derives the value server-side from the validated file.

## Input validation & payload safety

- Global `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted:
  true` (unknown fields rejected, not silently dropped),
  `transform: true` — `src/main.ts`.
- Explicit JSON body-size limit (256kb — every real payload this API
  accepts is small; the avatar upload has its own separate 2MB
  `multer` limit) — Phase 11, `src/main.ts`. Required disabling Nest's
  default body-parser first (`bodyParser: false`) to avoid a
  double-parsing conflict, confirmed against `NestApplicationOptions`'
  real type definition before writing this, not assumed safe.

## Rate limiting

Global default (100 req/min) via `@nestjs/throttler`, with tighter,
verified limits on sensitive auth endpoints specifically — checked
directly in `src/auth/auth.controller.ts`, not just claimed in a
comment: register/login/reset-password at 5/min, forgot-password
(triggers an email send, the more expensive operation) at 3/min.
**P0-C correction**: `register` was previously claimed at 5/min in this
same doc while the actual endpoint had no `@Throttle()` decorator at
all and silently fell back to the global 100/min — a real, verified
doc/code mismatch, now fixed in code (not just the doc) and covered by
`test/auth-rate-limit.e2e-spec.ts`, which proves the 6th request in a
window genuinely gets a 429 for all four endpoints above.

`refresh`, `logout`, and `change-password` remain on the global 100/min
only — `refresh`/`logout` require possessing the httpOnly refresh
cookie already (not a guessable credential, so brute-forcing them isn't
a credential-stuffing risk the way login/register are), and
`change-password` requires an already-valid access token. Assessed, not
overlooked.

No account-lockout or per-account (as opposed to per-IP) brute-force
protection exists beyond this rate limiting — a distributed
low-request-rate credential-stuffing attempt against a single account
is not specifically mitigated. Documented as a known residual risk, not
fixed in P0-C: implementing this correctly (without creating a
DoS-via-lockout vector against a real customer) is a larger design
decision than this phase's scope.

## File upload security (P0-C-7)

Four upload endpoints — avatar (`POST /auth/me/avatar`), return/DOA
evidence (`POST /orders/:id/returns`), seller verification documents
(`POST /sellers/me/verifications`), seller product photos
(`POST /sellers/me/products/:id/media`). All four: require
authentication, derive ownership server-side (never a client-supplied
id), and go through `LocalStorageService`
(`src/storage/local-storage.service.ts`), which generates a fresh
`randomUUID()` filename — the client's `originalName` is never used for
the stored path, only its extension is kept (stripped to
`[a-zA-Z0-9.]`, capped at 10 chars) — so there is no path-traversal
vector even without upstream validation, and every `directory` value is
a hardcoded literal, never client input.

Evidence/verification/product-media uploads validate MIME type,
filename extension, AND real leading-byte file signature (magic
numbers) — all three must agree (`orders/evidence-file.util.ts`,
`sellers/seller-verification-file.util.ts`,
`sellers/seller-product-media-file.util.ts`). **The avatar endpoint
previously checked only the client-supplied `Content-Type` header**
(`file.mimetype.startsWith('image/')`) — spoofable, since a client
controls that header. Fixed: `src/auth/avatar-file.util.ts` applies the
identical three-way (MIME + extension + magic-byte) validation as the
other three endpoints.

Size limits: evidence upload already enforced its 10MB limit via
Multer's own `limits.fileSize` (rejects before fully buffering the
file). Avatar, verification, and product-media uploads previously only
checked `file.size` **after** the full file was already buffered into
memory — a real, if minor, unbounded-buffering surface. Fixed: all
three now also pass `limits: { fileSize: ... }` to their
`File(s)Interceptor`, matching the evidence endpoint's pattern.

**Update (P0-D): fixed.** The retrieval gap described in this section
when it was written — no endpoint anywhere served an uploaded file
back over HTTP — is closed. `FilesController`
(`apps/api/src/storage/files.controller.ts`), mounted at
`/api/uploads/:directory/:filename` (matching
`LocalStorageService.upload()`'s own returned URL exactly, so it rides
the frontend's existing `/api/*` proxy without needing a new one).
Avatars and product-media are public, no ownership check, exactly as
this section originally specified. Return-evidence and
seller-verifications are **not** a bare static mount — each request
looks up the owning `ReturnRequest`/`Seller` row by the file's URL and
requires the caller to be the owning customer/seller or an admin,
verified in `files.controller.spec.ts` (12 tests, including that a
different customer/seller gets 403 not 404, proving this is a real
ownership check and not just an existence check) and live against a
running server (unauthenticated request to a private path → 401; a
constructed path-traversal filename → 400, defended at both the
controller and `LocalStorageService.createReadStream` layers
independently).

**Known residual gap, not fixed here: uploaded files still don't
survive a redeploy.** The P0-D infrastructure audit confirmed Render's
free web service has no persistent disk declared — every file in all
four directories, including the two private ones above, is lost on
the next deploy, and wouldn't be shared across replicas if ever scaled
past one instance. `StorageService` is written as a swappable
interface specifically so a real object-storage backend (S3/R2/etc.)
can replace `LocalStorageService` as a single new class with zero
caller changes — but writing and shipping that implementation
unverified, with no real bucket/credentials to test against in this
environment, was judged worse than clearly documenting the gap. This
needs either a paid Render tier with a persistent disk, or real
object-storage credentials — an external-account blocker, not an
engineering one.

## Webhook security (P0-C-8)

Only one inbound webhook exists — Razorpay
(`POST /payments/webhook`), audited end to end:

- **Signature verification is against the true raw request body**, not
  the re-serialized parsed JSON — `main.ts`'s body-parser `verify`
  callback stashes `req.rawBody` from the exact bytes received
  specifically because Razorpay's HMAC-SHA256 signature isn't
  guaranteed to survive a parse-then-reserialize round trip. Verified
  via Razorpay's own SDK helper (`Razorpay.validateWebhookSignature`),
  not a hand-rolled HMAC comparison, against a secret distinct from the
  API key (`RAZORPAY_WEBHOOK_SECRET`).
- **Missing or invalid signature → 400 before any processing**, not
  log-and-continue (`PaymentsController`/`PaymentsService`).
- **Idempotency is enforced at the database level**: `providerEventId`
  has a real `@unique` constraint; a redelivered webhook hits that
  constraint and returns `{status: 'duplicate'}` before any
  payment-mutating logic runs — not an in-memory guard, which
  wouldn't survive a multi-instance deployment.
- **The payload's own stated amount is never trusted for the financial
  mutation.** The webhook handler looks up the existing `Payment` row by
  the payload's `orderId`/`providerPaymentId` and confirms capture using
  the amount already recorded in Folia's own database at checkout time
  — `entity.amount` from the payload itself never reaches the code that
  decides what got paid. Refund reconciliation is similarly conservative:
  it only reconciles a refund this system already initiated (an exact
  unique match against a `PENDING` `Refund` row), never creates new
  refund state purely from the webhook payload.
- **Shiprocket has no inbound webhook** — all Shiprocket interaction is
  outbound (rate lookup, shipment creation); nothing to audit there.
- **Known, low-severity residual gaps**: no explicit
  timestamp/staleness check on the webhook payload (Razorpay's payload
  doesn't carry one this code inspects; the `providerEventId`
  uniqueness already makes a literal replay of a captured webhook a
  no-op, so the practical exposure is narrow), and the webhook path
  doesn't independently re-fetch payment status from Razorpay's API the
  way the synchronous `verify()` callback path does (that path fetches,
  checks `status === 'captured'`, and compares amount with a 0.01
  tolerance before trusting it — the webhook path relies on the
  HMAC-verified event type alone for the capture *decision*, though not
  for the amount). Not fixed here — would mean an extra live API call
  per webhook delivery for a gap the amount-sourced-from-DB design
  already mostly closes.

## CSRF (P0-C-9)

**Assessed: no genuine CSRF attack surface exists on this API's
business endpoints, given its actual authentication model — and no
CSRF middleware/token mechanism has been added, deliberately.**

Every protected route requires `Authorization: Bearer <token>`
(`JwtStrategy`, `ExtractJwt.fromAuthHeaderAsBearerToken()` — the header
only, never a cookie fallback). A forged cross-site request cannot
attach that header without either JS access to the token (an XSS
problem, categorically different from CSRF) or a CORS grant this API
doesn't give to arbitrary origins (see CORS below). Only two endpoints
read any cookie at all: `POST /auth/refresh` (the httpOnly refresh
token) and the cart controller (an anonymous guest-cart id — not an
authentication mechanism, grants no privilege).

The refresh cookie is `httpOnly`, `SameSite=Lax`, `secure` in
production, and the route is POST-only (no `GET` variant exists) —
`SameSite=Lax` already blocks the cookie on a cross-site POST, and Lax
only permits it on a top-level cross-site *navigation* (GET), which
this route doesn't accept. Even in a hypothetical bypass, `/auth/refresh`
only rotates tokens for the session already tied to that cookie — no
business state changes, and the new access token goes into the
response body, which a cross-site attacker page has no way to read
(no CORS grant, same-origin policy). The only real residual is a
forced anonymous guest-cart mutation via the cart cookie — no
privilege, no data disclosure, a throwaway cart — not worth a P0 fix.

## CORS (P0-C-13)

`app.enableCors({ origin: config.corsOrigins, credentials: true })`
(`main.ts`) — `corsOrigins` is an explicit, env-driven allowlist
(`CORS_ORIGINS`, comma-split), never a wildcard, and there is no
`credentials: true` + `origin: '*'` combination anywhere (which would
be a real vulnerability). Same code path in every environment — no
`NODE_ENV` branch to accidentally diverge. **Known operational
footgun, not a vulnerability**: `CORS_ORIGINS` defaults to
`http://localhost:5173` if unset, including in a production run with a
misconfigured environment — this fails *closed* (breaks the real
frontend loudly) rather than open, so it's a deployment-checklist item,
not a security fix.

## Security headers (P0-C-12)

`app.use(helmet())` (`main.ts`), default options — sets
`Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`,
`Strict-Transport-Security`, and Helmet 8's other current defaults.
Since this API is pure JSON (no HTML rendered), the default CSP is
largely inert but harmless — no app-specific tuning was needed. The
frontend's own hosting config (`apps/web/vercel.json`) sets no
additional headers of its own; this is an unmanaged gap at the hosting
layer worth a future look, not an API-side finding.

## Error responses (P0-C-14)

The global exception filter (`common/filters/all-exceptions.filter.ts`)
always returns `{statusCode, message, error, path, timestamp}`. For any
non-`HttpException` (including every raw Prisma error), the message is
unconditionally the generic `'Something went wrong. Please try again.'`
— **not gated by `NODE_ENV`**, so there is no "forgot to set production
mode" failure path that would leak a stack trace or a Prisma `.meta`
(column/table names). The real error and stack go to the server-side
log only (`this.logger.error`), never the response body. Audited every
call site that catches a Prisma error directly (orders, returns,
payouts, sellers, reviews) — none re-throw the raw message to the
client.

## Secrets & sensitive-data handling

- **Structured logging redaction**: `req.headers.authorization`,
  `req.headers.cookie`, and (P0-C-10, found and fixed) `res.headers
  ["set-cookie"]` are redacted at the Pino level for every request log
  — `src/app.module.ts`. The `Set-Cookie` gap was real: this app sets
  the refresh token and guest-cart id via `Set-Cookie` on
  login/register/refresh/cart responses, and Pino's `autoLogging`
  serializes response headers by default — without this path, the raw
  refresh-token value would have been written to server logs on every
  successful login. Verified live: the running app now logs
  `"set-cookie":"[Redacted]"` on these responses.
  Also audited every `this.logger.*`/`console.*` call across the
  auth/payments/orders/shipping/audit modules for a raw object (as
  opposed to a template-string message) that could carry a token or
  password outside the header-redaction path — none found; request
  bodies aren't logged at all (no custom `pinoHttp` serializer for
  them), so there's no separate body-level leak path either.
- **Audit-log secret scrubbing**: `AuditService` redacts any metadata
  key matching `password`/`token`/`cardnumber`/`cvv` (substring match,
  case-insensitive) before writing. A real bug in this exact mechanism
  was caught and fixed in Phase 9: the sensitive-key list wasn't
  lowercased to match the already-lowercased input key, so
  `cardNumber`/`accessToken`/`refreshToken`/`cvv` were silently *not*
  being redacted despite the code looking correct — caught by a test
  failing with the raw value still present, not by review.
- **Never stores**: raw card numbers (payment is fully mocked,
  `PaymentsService` only ever receives an already-masked display
  string like "Visa •••• 4242"), refresh tokens in plaintext (stored as
  SHA-256 hashes only), or passwords anywhere but the Argon2id hash.

## What is NOT verified — stated plainly, not implied by omission

**Update (P0-B/P0-C): the "blocked since Phase 0" limitation this
section used to describe no longer applies.** `prisma generate` runs
cleanly now (see the root README/CI workflow), and P0-B built a real
CI pipeline that boots the actual `AppModule` against live ephemeral
Postgres/Redis containers. The rate-limiting behavior above is now
genuinely e2e-verified against a live running server, not just unit
tests against the underlying logic —
`apps/api/test/auth-rate-limit.e2e-spec.ts` fires real HTTP requests
through the real `ThrottlerGuard` and asserts a real 429 on the 6th
attempt for register/login/forgot-password/reset-password.

Still not verified end-to-end (out of P0-C's scope, or requiring
external accounts this environment doesn't have): the Razorpay
webhook's signature verification has never received an actual signed
webhook from Razorpay's real infrastructure (unit-tested against a
constructed signature only); the same for any Shiprocket interaction.
No third-party penetration test or external security audit has been
performed — everything in this document is a first-party code review
and live-request verification against this codebase's own test
infrastructure, not an independent assessment.

## Dependency vulnerabilities — real data, actually checked

**Update (P0-B): fixed, verified 0 vulnerabilities.** `npm audit`
previously found 3 "high severity" findings, all tracing to a single
root cause — `deepmerge-ts`'s stack-exhaustion issue
([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)),
pulled in via `@prisma/config` → `prisma` (a dev-only dependency —
`Dockerfile`'s runtime stage installs with `npm ci --omit=dev`, so it
never shipped in production regardless). No safe direct upgrade path
existed (`@prisma/config`'s latest stable pins `deepmerge-ts@7.1.5`
exactly; only unstable `8.x-dev` Prisma prereleases go further). Fixed
via a targeted `npm overrides` entry
(`"deepmerge-ts": "^8.0.2"`, root `package.json`) forcing just the
vulnerable transitive dependency to a patched major version, applied
via a full clean reinstall and verified: `npm ls deepmerge-ts` resolves
`8.0.2`, `npm audit` (including dev dependencies) reports **0
vulnerabilities**, and `prisma generate` was re-run successfully
afterward to confirm the transitive bump didn't break Prisma's own
tooling. Re-verified again at the end of P0-C with no new dependencies
added — still 0.
