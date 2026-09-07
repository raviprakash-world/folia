# Folia — Security Status

Cross-cutting summary. `apps/api/SECURITY.md` has the detailed backend security
write-up (IDOR fix history, permission model, redaction specifics) — this file
tracks status at a glance and layers in what that document doesn't cover
(frontend, infra, and gaps found independently of it).

| Control | Status | Evidence |
|---|---|---|
| JWT + refresh rotation with reuse detection | ✅ VERIFIED | `apps/api/src/auth/auth.service.ts:167-222`, unit-tested |
| Argon2id password hashing (OWASP params) | ✅ VERIFIED | `apps/api/src/auth/password.util.ts:15-24`, real hash/verify round-trip tested |
| Global RBAC guard chain (Throttler → JWT → Roles → Seller) | ✅ VERIFIED | `apps/api/src/app.module.ts:110-113` |
| Rate limiting, global + tuned on sensitive routes | ✅ VERIFIED | `apps/api/src/auth/auth.controller.ts` register/login/reset-password (5/min), forgot-password (3/min) — e2e-proven, `test/auth-rate-limit.e2e-spec.ts` (P0-C-3: `register` was previously undocumented-but-unthrottled; fixed) |
| Authorization/IDOR sweep (customer/seller/admin isolation) | ✅ VERIFIED (P0-C-5) | Systematic endpoint audit; one real gap found and fixed — suspended/deactivated sellers could still archive products, ship orders, edit fulfillment notes (`SellerGuard` is deliberately status-agnostic by design; per-endpoint `ACTIVE`-only gates added) |
| Mass assignment audit | ✅ VERIFIED (P0-C-6) | No exploitable path found; 2 defense-in-depth gaps closed — `AdminUpdateRoleDto.role` allowlist, `UpdateProfileDto.avatarUrl` removed (bypassed upload validation) |
| File upload security (MIME/magic-byte/size) | ✅ VERIFIED (P0-C-7) | Avatar upload previously trusted client `Content-Type` alone — now magic-byte-validated like the other 3 upload endpoints; all 4 now enforce size limits via Multer, not post-buffer checks |
| Webhook signature verification + idempotency | ✅ VERIFIED | Razorpay: raw-body HMAC verification, DB-unique-constraint dedup, amount sourced from Folia's own DB never the payload — `apps/api/src/payments/payments.service.ts:902-986` |
| CORS scoped to configured origin | ✅ VERIFIED | `apps/api/src/main.ts:58`, explicit env-driven allowlist, never a wildcard |
| Helmet, strict ValidationPipe | ✅ VERIFIED | `apps/api/src/main.ts` |
| Structured log redaction (auth headers, secrets, Set-Cookie) | ✅ VERIFIED | `apps/api/src/app.module.ts` — P0-C-10 added `res.headers["set-cookie"]`, a real gap (refresh-token leak via response-header autologging), verified fixed against a live running server |
| Error responses (no stack/Prisma-internals leakage) | ✅ VERIFIED | `apps/api/src/common/filters/all-exceptions.filter.ts` — generic message for any non-`HttpException`, unconditional (not `NODE_ENV`-gated) |
| Secrets hygiene (no hardcoded secrets repo-wide) | ✅ VERIFIED | Two independent grep passes, zero hits |
| Demo credentials hidden from production frontend build | ✅ VERIFIED (P0-C-2) | `Login.tsx`/`AdminLogin.tsx`/`SellerLogin.tsx` gated behind `import.meta.env.DEV`; CI scans the built `apps/web/dist/` bundle for the literal strings on every run |
| CSRF token mechanism | ✅ ASSESSED — not needed | No CSRF middleware/token exists, deliberately: every business endpoint requires `Authorization: Bearer`, never ambient-cookie auth; the one cookie-authenticated endpoint (`/auth/refresh`) is `SameSite=Lax` + POST-only + performs no business state change. Full reasoning in `apps/api/SECURITY.md`'s CSRF section — this was previously listed as "MISSING," which incorrectly implied a gap rather than an assessed non-issue |
| Dependency vulnerabilities (`npm audit`) | ✅ 0 VULNERABILITIES | Fixed in P0-B (`deepmerge-ts` override), re-confirmed at the end of P0-C |
| Graceful shutdown | ❌ MISSING | `enableShutdownHooks()` never called; Dockerfile `CMD` shape (`sh -c "... && node ..."`) likely prevents SIGTERM reaching Node at all — out of scope for P0-C, belongs to a later infrastructure phase |
| File retrieval / serving endpoint | ❌ MISSING (flagged critical for whoever builds it) | `LocalStorageService` writes files and returns `/uploads/<key>` URLs, but nothing serves them — a functional gap today, and a serious future risk if "fixed" with a naive static mount for verification-document/return-evidence uploads specifically (see `apps/api/SECURITY.md`'s file-upload section) |
| Error tracking / APM | ❌ MISSING | No Sentry/equivalent in either app |
| CI-gated security checks | ✅ FIXED (P0-B) | Real GitHub Actions CI now exists (`.github/workflows/ci.yml`), lint/typecheck/test/e2e/build gated on every PR + push to `main`, plus a demo-credential bundle scan (P0-C) |
| Backend lint (includes some type-safety rules) | ✅ FIXED (P0-B) | 0 errors, 0 warnings — previously failing, see `PRODUCTION_STATUS.md`'s now-stale table for the prior state |
| Account lockout / per-account brute-force protection | ❌ MISSING (documented residual risk) | Only per-IP rate limiting exists; a slow, distributed credential-stuffing attempt against one account isn't specifically mitigated. Not fixed in P0-C — a correct implementation needs to avoid becoming its own DoS vector against real customers, a bigger design decision than this phase |

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
- **Password-reset tokens (Phase 3 update): the production-breaking gap is
  fixed.** A real email is now sent regardless of environment
  (`AuthService.forgotPassword`/`createEmailVerificationToken`) — this was
  the one flagged as "production password reset does not work at all right
  now"; it now does, modulo Resend actually having a real key configured
  (see `API_INTEGRATION_STATUS.md`). The `devToken` pattern itself is
  unchanged and still gated behind `isProduction` — a dev convenience for
  testing this flow with no email provider configured locally, never
  returned outside development, and never itself exploitable in production
  (production returns `{}`, same as before).

## P0-C update — most of the below is now done

The IDOR sweep and mass-assignment review this section used to defer
are now complete (P0-C, see the table above and `apps/api/SECURITY.md`
for full findings). Still genuinely not assessed: a dedicated XSS
surface review of the React frontend (no CSP tuning was needed on the
API side since it serves no HTML, but the frontend's own XSS posture —
e.g. any `dangerouslySetInnerHTML` usage — hasn't had a focused pass),
and a live cookie-flag inspection over real HTTPS in an actual deployed
environment (the `secure` flag's `isProduction` branch is code-verified
but has not been observed on a real production HTTPS request).
