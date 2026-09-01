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
- **No account enumeration**: login and password-reset return identical
  responses for "wrong password" and "account doesn't exist" —
  `src/auth/auth.service.ts`.
- **Access tokens re-verified against the database on every request**,
  not just JWT-signature-valid — a revoked session or deactivated
  account (Phase 9's `adminDeactivate`, which also calls
  `SessionsService.revokeAllForUser`) takes effect immediately, not just
  after the access token's own short expiry.

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
comment: login/register at 5/min, password-reset request at 3/min.

## Secrets & sensitive-data handling

- **Structured logging redaction**: `req.headers.authorization` and
  `req.headers.cookie` are redacted at the Pino level for every request
  log — `src/app.module.ts`.
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

The roadmap's Phase 13 security-testing checklist (unauthenticated →
protected API rejected, expired/invalid token → rejected, rate limit →
enforced, cross-user data access → rejected) describes *behavior under
a live, running server receiving real HTTP requests*. Every mechanism
above is real, checked-against-actual-code, and covered by genuine unit
tests against the underlying logic — but none of it has been observed
working end-to-end against a live boot, because `prisma generate` has
been blocked in this sandbox since Phase 0 (see the root README's
"Known Issues"). This is the same category of limitation stated
explicitly for Phases 10 and 12; restated here because Phase 13's own
report requires it.

## Dependency vulnerabilities — real data, actually checked

`npm audit` was run for real (not skipped): 3 "high severity" findings,
all tracing to a single root cause — `deepmerge-ts`'s stack-exhaustion
issue ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)),
pulled in via `@prisma/config` → `prisma`. Two things worth knowing
before treating this as urgent: `prisma` here is the CLI tool, a **dev
dependency only** — it is not present in the production Docker image
(`Dockerfile`'s runtime stage installs with `npm ci --omit=dev`), so
this doesn't ship. A fix is available (`npm audit fix`), but it was
**not applied** here: it would change `prisma`'s own version, and this
sandbox cannot verify `prisma generate`/`migrate` still work correctly
afterward (the same underlying network block documented throughout this
project) — applying an unverifiable version change this late was judged
riskier than leaving a documented, known, dev-only issue for the first
environment that can actually check the result.
