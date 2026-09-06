# Folia — Security Status

Cross-cutting summary. `apps/api/SECURITY.md` has the detailed backend security
write-up (IDOR fix history, permission model, redaction specifics) — this file
tracks status at a glance and layers in what that document doesn't cover
(frontend, infra, and gaps found independently of it).

| Control | Status | Evidence |
|---|---|---|
| JWT + refresh rotation with reuse detection | ✅ VERIFIED | `apps/api/src/auth/auth.service.ts:135-195`, unit-tested |
| Argon2id password hashing (OWASP params) | ✅ VERIFIED | `apps/api/src/auth/password.util.ts:15-20`, real hash/verify round-trip tested |
| Global RBAC guard chain (Throttler → JWT → Roles) | ✅ VERIFIED | `apps/api/src/app.module.ts:93-100` |
| Rate limiting, global + tuned on sensitive routes | ✅ VERIFIED | `apps/api/src/auth/auth.controller.ts:97,226,240` |
| CORS scoped to configured origin | ✅ VERIFIED | `apps/api/src/main.ts:42` |
| Helmet, strict ValidationPipe | ✅ VERIFIED | `apps/api/src/main.ts:38,52-58` |
| Structured log redaction (auth headers, secrets) | ✅ VERIFIED | `apps/api/src/app.module.ts:48` |
| Secrets hygiene (no hardcoded secrets repo-wide) | ✅ VERIFIED | Two independent grep passes, zero hits |
| CSRF token mechanism | ❌ MISSING | No `csurf` or equivalent; state-changing routes rely on bearer tokens + httpOnly cookies only |
| Graceful shutdown | ❌ MISSING | `enableShutdownHooks()` never called; Dockerfile `CMD` shape (`sh -c "... && node ..."`) likely prevents SIGTERM reaching Node at all |
| File upload durability | ⚠️ PARTIAL | Size/type limits real; storage is local-disk only, not durable, and not even served back over HTTP today |
| Error tracking / APM | ❌ MISSING | No Sentry/equivalent in either app |
| CI-gated security checks | ❌ MISSING | No CI exists at all (see `API_INTEGRATION_STATUS.md`) |
| Backend lint (includes some type-safety rules) | ❌ CURRENTLY FAILING | 34 errors, 27 warnings as of this baseline — see `PRODUCTION_STATUS.md` |

## Known-mocked flows with security-relevant consequences

- **Payment status independent verification (Phase 1/2 update):** implemented
  as designed — `PaymentsService.verify()` never trusts the client's claimed
  status or amount; it independently re-fetches the payment from Razorpay and
  rejects on any mismatch, and the webhook (`handleWebhookEvent()`) is the
  authoritative path regardless of whether the client ever calls `verify()`
  at all. This is unit-tested (signature-invalid, amount-mismatch, and
  not-actually-captured cases all rejected) but **not yet exercised against a
  real Razorpay payment** — no sandbox credentials are configured in this
  environment (see `API_INTEGRATION_STATUS.md`). Webhook signature
  verification is real (HMAC-SHA256 over the raw request body via
  `Razorpay.validateWebhookSignature`), and webhook idempotency is enforced
  at the database level (`providerEventId` unique constraint), not an
  in-memory guard.
- **Password-reset tokens are returned directly in the API response body**
  outside production (`devToken` pattern) because no email provider exists.
  This is gated behind `isProduction` today and is not itself exploitable in
  the current production deployment (production returns `{}` and only logs a
  warning) — but it also means production password reset **does not work at
  all** right now, which is a functional gap tracked in `PRODUCTION_STATUS.md`,
  not merely a security one.

## Not yet assessed in this pass (deferred to Phase 9)

XSS surface review, IDOR sweep beyond the one documented fix in
`apps/api/SECURITY.md`, mass-assignment review of every DTO, and a
live cookie-flag inspection over real HTTPS. (Webhook signature verification
now exists — Phase 1 — and is unit-tested; see the payments entry above.)
Phase 9 is where these get a
dedicated pass; Phase 0 only inventories what's already known.
