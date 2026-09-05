# Folia — External Integration Status

Every row below is either **NOT STARTED** (no code, no account, nothing) or it
says exactly what exists. Nothing in this file may say "configured" or
"integrated" unless it was actually exercised against the real provider —
per the project's own evidence standard. See `PRODUCTION_READINESS.md` at the
repo root for why that discipline is enforced here specifically.

| Integration | Status | Account owner | Notes |
|---|---|---|---|
| Payment gateway (Razorpay candidate) | **NOT STARTED** | Business owner must create the account | No SDK, no keys, no code. Needed before Phase 1 can do anything beyond scaffolding. |
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

Nothing in Phases 1, 3, 5, or 7 should be marked VERIFIED — or even attempted
beyond abstraction-layer scaffolding — without a real sandbox credential to test
against, per the project's own rule that source code compiling is not the same
as a feature working.
