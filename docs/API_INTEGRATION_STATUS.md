# Folia — External Integration Status

Every row below is either **NOT STARTED** (no code, no account, nothing) or it
says exactly what exists. Nothing in this file may say "configured" or
"integrated" unless it was actually exercised against the real provider —
per the project's own evidence standard. See `PRODUCTION_READINESS.md` at the
repo root for why that discipline is enforced here specifically.

| Integration | Status | Account owner | Notes |
|---|---|---|---|
| Payment gateway (Razorpay) | **CODE COMPLETE, NOT LIVE-VERIFIED** | Business owner must supply real sandbox keys | Real SDK integration (Orders API, signature verification, webhooks, refunds) built and unit-tested in Phases 1–2. **No real Razorpay sandbox credentials have ever been configured in this environment** — `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are unset both locally and on the live Render deployment (`render.yaml` declares them `sync: false`). Live-verified: COD end-to-end, and the "gateway not configured" failure path (real 400 response, reservation correctly released). **Not live-verified: an actual captured card/UPI/net-banking charge.** Do not upgrade this row to VERIFIED without running a real Checkout.js flow against real test keys. |
| Courier / logistics (Shiprocket) | **CODE COMPLETE, NOT LIVE-VERIFIED** | Business owner must supply real Shiprocket account credentials | Real REST integration (`ShiprocketProvider`, behind a `ShippingProviderClient` interface so a second aggregator/direct-courier provider is a new class + one module binding, not a rewrite) built and unit-tested in Phase 5: real login → bearer-token flow with automatic retry-once-on-401, `checkServiceability` (rates/ETA by pincode pair), `createShipment` (real order + AWB assignment), `trackShipment`. **No real Shiprocket account has ever been configured in this environment** — `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD`/`SHIPROCKET_PICKUP_LOCATION`/`SHIPROCKET_PICKUP_PINCODE` are unset both locally and on the live Render deployment. Live-verified: the cart-page shipping estimate gracefully falls back to the existing flat-rate heuristic when Shiprocket isn't configured (never breaks the public, unauthenticated endpoint), and the admin "ship this order" action fails loudly with a clear, specific error rather than silently marking an order shipped with no real shipment behind it. **Not live-verified: an actual real shipment created, a real AWB assigned, or real tracking data fetched.** Do not upgrade this row to VERIFIED without a real Shiprocket account and an actual shipment created against it. |
| Transactional email (Resend) | **CODE COMPLETE, NOT LIVE-VERIFIED** | Business owner must supply a real Resend API key | Real SDK integration (`ResendProvider`, behind an `EmailService` interface) built and unit-tested in Phase 3, wired into password reset, email verification, and order/payment lifecycle events. **No real Resend API key has ever been configured in this environment** — `RESEND_API_KEY` is unset both locally and on the live Render deployment (`render.yaml` declares it `sync: false`). Live-verified: the send *attempt* on every wired trigger (registration, password reset, checkout, cancellation) against the real backend, each failing gracefully with a clear logged warning and never breaking the request that triggered it. **Not live-verified: an actual delivered email.** Do not upgrade this row to VERIFIED without a real key and a real received email. |
| SMS / WhatsApp | **NOT STARTED** | Business owner, if pursued | Explicitly optional for initial launch per the roadmap brief. |
| Object storage (S3-compatible: AWS S3 / Cloudflare R2) | **NOT STARTED** | Business owner must create the account/bucket | `StorageService` interface already exists in the backend specifically to make this swap contained — see `apps/api/src/storage/storage.interface.ts`. Needed before Phase 7. |
| Error tracking (Sentry candidate) | **NOT STARTED** | Whoever administers the Render/Vercel account | Free tier likely sufficient at current scale. Needed for Phase 8. |
| CI (GitHub Actions) | **NOT STARTED** | Repo owner (needs GitHub Actions enabled on the repo) | Needed for Phase 8. |
| GST / business tax configuration | **NOT STARTED** | Business owner must supply real GSTIN, registered address, applicable tax slabs | Currently a hardcoded placeholder labeled `(mock GSTIN)` and a flat 8% constant. Needed before Phase 7's India-commerce work can be anything but a schema exercise. |

## What this means for sequencing

Phases 1, 3, 5, and 7 each have a hard external dependency this session cannot
satisfy alone — creating third-party accounts, agreeing to their terms, and
handling any resulting credentials are explicit-permission or account-creation
actions that require the business owner directly. The pattern already used
successfully in this project (Vercel, Render, GitHub) applies again here: the
owner creates the account and hands over **sandbox/test-mode** credentials;
implementation and verification then proceed the same way DB credential
rotation and the Render Blueprint deploy did earlier in this project's history.

**Update (Phases 1–5):** the payments, email, and shipping code itself was NOT
left blocked on this — Phase 1 built the full Razorpay integration and Phase 2
rearchitected checkout around it; Phase 3 built the full Resend integration
and wired it into every real trigger point (password reset, verification,
order/payment lifecycle); Phase 5 built the full Shiprocket integration and
wired it into the cart-page rate estimate (with graceful fallback) and a
genuinely new admin fulfillment action — all without real credentials, by
unit-testing every provider-dependent path against a mock and live-verifying
everything that doesn't require the real third party to actually succeed (for
Razorpay: COD, the "not configured" failure, concurrency, idempotency; for
Resend: the send attempt itself on every wired trigger, failing gracefully
every time; for Shiprocket: the estimate endpoint's graceful degradation, and
the ship action's loud, specific failure with no order left falsely marked
shipped). This is a deliberate, honest middle ground: real, tested code
exists and is genuinely ready to take a real charge, send a real email, or
create a real shipment, but "ready to verify" is not "verified" — all three
rows above stay CODE COMPLETE, NOT LIVE-VERIFIED, not VERIFIED, until real
credentials exist and a real charge is captured / a real email is received /
a real shipment is created.

Nothing in Phases 1, 3, 5, or 7 should be marked VERIFIED — or even attempted
beyond abstraction-layer scaffolding — without a real sandbox credential to test
against, per the project's own rule that source code compiling is not the same
as a feature working.
