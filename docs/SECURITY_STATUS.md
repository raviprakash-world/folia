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
| Graceful shutdown | ✅ FIXED (P0-D) | `app.enableShutdownHooks()` added (`main.ts`); Dockerfile `CMD` now `exec`s `node` so it becomes PID 1 and actually receives SIGTERM; the BullMQ Redis connection that previously kept the process alive past `app.close()` now has a real `OnModuleDestroy` (`jobs/bull-redis-connection.service.ts`). Verified live in Docker: `docker stop` (SIGTERM) now reaches `ExitCode 0` in well under a second — previously hung until SIGKILL at the stop-grace-period every time |
| File retrieval / serving endpoint | ✅ FIXED (P0-D) | `FilesController` (`apps/api/src/storage/files.controller.ts`) — avatars/product-media public, return-evidence/seller-verifications ownership-or-admin-checked against the real DB relation, never a bare static mount. Verified live: a real uploaded avatar round-tripped byte-identical through both the direct backend and the frontend's dev proxy; a private-file request with no auth returns 401; a path-traversal attempt returns 400. **File durability across redeploys is still unresolved** — see the new row below |
| Uploaded file durability | ❌ MISSING (documented, needs an external account to fix) | Confirmed via the P0-D infrastructure audit: Render's free web service has no persistent disk declared, so every uploaded file (including the two private, sensitive directories above) is lost on the next redeploy, and wouldn't be shared across replicas if ever scaled beyond one instance. `StorageService` is written as a swappable interface specifically for this (see `storage.interface.ts`'s doc comment) — an S3-compatible implementation is the fix, blocked on real object-storage credentials this environment doesn't have |
| Error tracking / APM | ❌ MISSING | No Sentry/equivalent in either app; P0-D added a process-level `uncaughtException`/`unhandledRejection` handler (`main.ts`) as a stopgap so a crash outside a request context is at least logged, not silent — that's visibility, not tracking/alerting |
| Database backups | ❌ MISSING (documented, needs an external account to fix) | Confirmed via the P0-D infrastructure audit: no backup/restore mechanism exists anywhere in this repo, and Render's free Postgres plan has no automated backups or point-in-time recovery. A bad migration or accidental delete today is unrecoverable. Needs either a paid Render tier or an external backup destination this environment doesn't have credentials for |
| Frontend error boundary | ✅ FIXED (P0-D) | `apps/web/src/components/common/ErrorBoundary.tsx`, wired in `main.tsx` — previously a render-phase throw anywhere unmounted the whole app to a blank page (confirmed by reading `main.tsx` before the fix); verified live in-browser (screenshot) that the fallback renders and its "Back to home" recovers correctly |
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

## P0-F — India-commerce correctness (2026-09-08)

Scoped after P0-E (external integration verification) was blocked — no
sandbox credentials exist in this environment for Razorpay/Shiprocket/
Resend, and creating third-party accounts isn't something this session
does unilaterally. India-commerce correctness needed no external
account and was fully engineering-scoped, so it ran instead.

**Fixed and verified:**
- **Currency magnitude** (not currency code — that was already right).
  `formatCurrency` was already `Intl.NumberFormat('en-IN', {currency:
  'INR'})` throughout, and the backend already hardcoded `currency:
  'INR'` at every Razorpay call site — but every seeded product price
  was a literal USD-shaped number ($14-$95), so the storefront showed
  "₹68.00" for a Monstera, ~40-50x too cheap for a real Indian price.
  Rescaled all 24 seeded products' `price`/`compareAtPrice` (and the
  mirrored `apps/web/src/data/products.ts`), the `WELCOME5` coupon,
  and every shipping-cost constant (`FREE_SHIPPING_THRESHOLD`,
  `NEAR_REGION_COST`/`FAR_REGION_COST`, `deliveryMethodDefs`) by the
  same 40x factor, consistently, backend and frontend, so relative
  pricing (a "premium" item still costs more than a basic one) and
  discount ratios are preserved exactly. Verified against a real,
  freshly-reseeded Postgres database, not just read from source.
- **Address/phone/PIN-code validation.** Backend `AddressInputDto`/
  `SellerAddressInputDto` previously validated `postalCode` as
  `@IsString() @MinLength(1)` — any non-empty string reached
  `ShiprocketProvider`'s `billing_pincode`, which requires a real
  Indian PIN. `country` was unvalidated too. Now: a real 6-digit-PIN
  regex (`common/validators/india-locale.ts`, first digit 1-9 — a
  real PIN never starts with 0), `country` constrained to `'IN'`
  (nothing else in this system — GST model, Shiprocket, PIN
  validation — ever supported another country in practice; this makes
  that honest instead of accepting a value guaranteed to fail
  downstream), and phone fields switched from region-agnostic
  `IsPhoneNumber(undefined, ...)` to `IsPhoneNumber('IN', ...)`.
  Frontend's address form previously defaulted new addresses to
  `country: 'US'` and offered a 5-country dropdown even though nothing
  but India ever worked end-to-end — now defaults to and only offers
  India, with a matching India-specific phone regex and PIN check.
  e2e/unit-tested: `addresses/dto/address-input.dto.spec.ts` (new),
  `auth/dto/dto.spec.ts` (updated to also reject a structurally-valid
  US number, not just a malformed one).
- **GSTIN** — real format AND checksum validation added
  (`common/validators/india-locale.ts`'s `IsGstin()`), not just a
  shape regex: implements the actual publicly-documented GST-council
  mod-36 check-digit algorithm, verified against a real, well-known
  example GSTIN (`27AAPFU0939F1ZV`) in `india-locale.spec.ts`. New
  nullable, unique `Seller.gstin` column (migration
  `20260908061144_add_seller_gstin`) — nullable because a seller below
  GST's real registration turnover threshold legitimately has none yet
  (a business fact, not an engineering shortcut). Never exposed on the
  public seller storefront type, same policy as `contactEmail`/
  `contactPhone`.
- **CGST/SGST/IGST invoice split** — the customer-facing PDF invoice
  (`apps/web/src/utils/invoice.ts`) previously showed one
  undifferentiated "Tax" line; a real GST invoice must split it into
  CGST+SGST (buyer and seller/platform in the same state) or IGST
  (different states). New `utils/gst.ts` does this split — a
  mechanical, well-defined calculation given an already-computed tax
  amount and the two parties' states, not a rate decision.
- **Units** — package weight/dimensions (`utils/packageDetails.ts`)
  converted from lbs/inches to kg/cm; product spec text (pot sizes,
  "mature height", vessel "diameter") converted the same way across
  both the seed data and its frontend mirror.
- **Locale** — date formatting (`utils/currency.ts`'s `formatDate`,
  `TrackingTimeline.tsx`, `AdminOverview.tsx`) switched `'en-US'` →
  `'en-IN'`. Mock/demo data that was still American-shaped (the
  address-book seed address, the "detect my location" geolocation
  jitter, the invoice's own mock company address/phone) switched from
  Portland, OR to Bengaluru, Karnataka — including keeping the mock
  GSTIN's state-code prefix (29, Karnataka's real code) consistent
  with that.

**Explicitly NOT fixed — a documented gap, not a claim of compliance:**
Real HSN-code-based GST slab rates (India's actual GST has category-
dependent rates — 0/5/12/18/28% — not one flat percentage). This
project has a single hardcoded `TAX_RATE = 0.08` constant applied
uniformly to every order regardless of what's in it
(`apps/api/src/orders/order.types.ts`, mirrored in
`apps/web/src/utils/pricing.ts`) — 8% isn't even a real GST slab.
Fixing this needs real product-tax classification data (which HSN
chapter a "ceramic planter" vs. a "live plant" vs. a "pruning shears"
falls under, and that category's real rate) from an actual business/
tax professional — not something to invent as an engineering guess,
per this whole effort's standing rule against inventing business/
compliance claims. The GSTIN and CGST/SGST/IGST-split work above are
real structural improvements independent of this gap (a correct split
of *whatever* the tax amount is, and a place to store a seller's real
GSTIN once they have one) — but they do not make this a GST-compliant
system, and neither this document nor the invoice itself claims that
(the invoice keeps its existing "This is a portfolio project — not a
real business" footer unchanged).

Also carried forward, unrelated to GST specifically: this project's
seller-payout/commission model, and whether individual sellers (not
just the platform) need their own GST registration and invoicing
identity in a real multi-seller marketplace, is a genuine business/
legal question this phase did not attempt to answer — the invoice
remains platform-level (Folia as the billing party) for every order
regardless of which seller actually fulfilled it.

## P0-D finding, not fixed — out of infrastructure scope

While verifying the new avatar-retrieval endpoint live in the browser,
found that `apps/web/src/pages/AccountProfile.tsx`'s avatar upload
(`handleAvatarChange`) never calls the real backend at all — it's a
pure client-side `FileReader` → data-URL mock, unconditionally (not
gated behind any `VITE_REAL_*_API` flag, unlike every other domain in
this app). The real `POST /auth/me/avatar` endpoint this whole P0-C/
P0-D pass hardened and made retrievable has never actually been wired
to any UI. Confirmed via direct API calls instead (login, multipart
upload, fetch the returned URL, byte-identical). Not fixed here —
wiring a frontend page to a real backend endpoint is the established
"backend integration" pattern this project already has a name and
process for (see `INTEGRATION.md`, the `VITE_REAL_*_API` flags), not
infrastructure work.

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
