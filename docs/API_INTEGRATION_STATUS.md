# Folia — External Integration Status

Every row below is either **NOT STARTED** (no code, no account, nothing) or it
says exactly what exists. Nothing in this file may say "configured" or
"integrated" unless it was actually exercised against the real provider —
per the project's own evidence standard. See `PRODUCTION_READINESS.md` at the
repo root for why that discipline is enforced here specifically.

| Integration | Status | Account owner | Notes |
|---|---|---|---|
| Payment gateway (Razorpay) | **CODE COMPLETE, NOT LIVE-VERIFIED** | Business owner must supply real sandbox keys | Real SDK integration (Orders API, signature verification, webhooks, refunds) built and unit-tested in Phases 1–2. **No real Razorpay sandbox credentials have ever been configured in this environment** — `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are unset both locally and on the live Render deployment (`render.yaml` declares them `sync: false`). Live-verified: COD end-to-end, and the "gateway not configured" failure path (real 400 response, reservation correctly released). **Not live-verified: an actual captured card/UPI/net-banking charge.** Do not upgrade this row to VERIFIED without running a real Checkout.js flow against real test keys. |
| Courier / logistics (Shiprocket/Delhivery candidate) | **NOT STARTED** | Business owner must create the account | No SDK, no keys, no code. Needed before Phase 5. |
| Transactional email (SendGrid/Postmark/SES candidate) | **NOT STARTED** | Business owner must create the account | No SDK, no keys, no code. Needed before Phase 3. |
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

**Update (Phases 1–2):** the payments code itself was NOT left blocked on this —
Phase 1 built the full Razorpay integration (real SDK, signature verification,
webhooks, refunds) and Phase 2 rearchitected checkout around it, both without
real credentials, by unit-testing every gateway-dependent path against a mocked
provider client and live-verifying every path that doesn't require a real
charge (COD, the "not configured" failure, concurrency, idempotency). This is a
deliberate, honest middle ground: real, tested code exists and is genuinely
ready to take a real charge, but "ready to verify" is not "verified" — the row
above stays CODE COMPLETE, NOT LIVE-VERIFIED, not VERIFIED, until real sandbox
keys are added and a real Checkout.js charge is actually captured.

Nothing in Phases 1, 3, 5, or 7 should be marked VERIFIED — or even attempted
beyond abstraction-layer scaffolding — without a real sandbox credential to test
against, per the project's own rule that source code compiling is not the same
as a feature working.
