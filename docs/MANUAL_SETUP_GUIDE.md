# Folia — manual setup guide (things only you can do)

Everything below needs **your** accounts, credentials, money, infrastructure, or business/legal decisions. None of it can be done from the repository, and none of it has been done or verified. Nothing here is fabricated: where a step depends on a third-party dashboard, the exact screen names may drift — the variable names, URLs and events below are taken from this repo's code.

**Launch status: NOT READY.** See the blocker register at the end.

Contents: [0. Do this first](#0-do-this-first-security--time-sensitive) · [1. Deploy this code](#1-deploy-this-code-and-refresh-the-live-database) · [2. Vercel](#2-vercel-environment-variables) · [3. Render](#3-render-environment-variables) · [4. Razorpay](#4-razorpay) · [5. Resend](#5-resend-email) · [6. Shiprocket](#6-shiprocket) · [7. Object storage](#7-durable-object-storage) · [8. Database backups](#8-database-backups-and-restore-testing) · [9. GST / tax](#9-gst--tax) · [10. Seller payouts & legal identity](#10-seller-payouts-invoicing-identity-and-legal) · [11. Removing demo content](#11-before-a-real-launch-remove-the-demo-content) · [12. Evidence log](#12-evidence-log-template) · [13. Blocker register](#13-launch-blocker-register)

---

## 0. Do this first (security + time-sensitive)

### 0.1 Free Postgres expires about 2026-10-03

`docs/PRODUCTION_STATUS.md` records the live Render Postgres as created ~2026-09-03 on the free plan, which Render deletes after ~30 days. Today is 2026-09-19. **If this database holds anything you want to keep, take a backup this week** (section 8) and decide on a paid plan. Check the real expiry date on the database's page in the Render dashboard.

### 0.2 Check whether production has accounts with publicly known passwords

Older versions of `apps/api/prisma/seed.ts` created these accounts with passwords that are written in the README and were shown on the dev login pages:

| Email | Role | Old password |
|---|---|---|
| `admin@folia.example` | admin | `folia-admin` |
| `demo@folia.example` | customer | `folia-demo` |
| `seller@folia.example` | seller | `folia-seller` |

The live database was almost certainly seeded by hand, so **assume these exist in production**. I did not test them against the live site (logging in to production is your call). To check without logging in:

1. Render dashboard → **folia-postgres** → **Connect** → copy the **External Database URL**.
2. ```bash
   psql "<External Database URL>" -c "select email from users where email in ('admin@folia.example','demo@folia.example','seller@folia.example');"
   ```
   Any row returned is a live account with a known password.

Fix (also creates a real admin for you). The seed's production mode does this safely — see step 1.2, using `SEED_LOCK_DEMO_ACCOUNTS=true`.

### 0.3 Rotate secrets you have pasted anywhere

Never paste `RAZORPAY_KEY_SECRET`, `JWT_*`, database URLs, or Shiprocket/Resend credentials into chat, tickets, or the frontend. Backend secrets never go in a `VITE_*` variable (those are shipped to every visitor's browser).

---

## 1. Deploy this code and refresh the live database

The live API still serves the **old USD-scale prices** (for example Monstera Deliciosa at ₹68, ZZ Plant at ₹46, 24 products, no images) because the earlier seed never updated existing rows. This is a large part of why "prices look inconsistent" between the frontend (₹2,720) and the API. The new seed fixes prices, descriptions, categories, sellers, images and reviews.

### 1.1 Merge and deploy

1. Merge the branch to `main` (Render and Vercel both auto-deploy from `main`).
2. Render runs `prisma migrate deploy` on start (see `apps/api/Dockerfile`), so the schema is updated automatically.
3. Vercel builds `apps/web` only (root `vercel.json`, `turbo run build --filter=folia`).

### 1.2 Run the seed against production (one time, from your laptop)

```bash
# from the repo root, once
npm ci && npm run prisma:generate --workspace apps/api

cd apps/api
NODE_ENV=production \
DATABASE_URL='<Render External Database URL>' \
SEED_LOCK_DEMO_ACCOUNTS=true \
SEED_ADMIN_EMAIL='you@your-domain.com' \
SEED_ADMIN_PASSWORD='<a long unique passphrase, 12+ characters>' \
npm run prisma:seed
```

What this does in production mode:

- Creates roles/permissions the app needs (**required** — the app has no admin/seller roles without them).
- Creates **your** admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (12+ characters enforced). Without these two variables no admin is created at all.
- `SEED_LOCK_DEMO_ACCOUNTS=true` gives the three demo accounts above a random unusable password, revokes their sessions, and clears an old lookalike demo GSTIN.
- Adds the **fictional** demo catalog: 55 products, 6 categories, 8 demo sellers (owner accounts get random unusable passwords), 165 demo reviews, product images, inventory. It is safe to re-run; it refreshes price/description and replaces demo reviews only (real reviews — those with a user id — are never touched).

Do not run it without `NODE_ENV=production` against the live database: outside production the seed deliberately creates the known-password accounts for local development.

Verify:

```bash
psql "<External Database URL>" -c "select count(*) from products;"          # 55
psql "<External Database URL>" -c "select name, price from products where slug='monstera-deliciosa';"   # 899.00
curl -s "https://folia-api.onrender.com/api/v1/products?pageSize=1" | head -c 400   # has "images"
```

Then delete the shell history line containing the passphrase.

---

## 2. Vercel environment variables

**Why this matters:** without these, a production build silently uses client-side **mock** behaviour — checkout would fabricate orders, the cart would be local-only, admin dashboards would show mock data — even though the API is real. The build now prints `[folia] WARNING: this production build has N mock-mode flag(s) OFF` listing the missing ones (non-fatal). I cannot see your Vercel account, so I cannot tell you whether they are set.

Vercel → your project (`web-drab-mu-24`) → **Settings** → **Environment Variables** → add each one for the **Production** environment (and Preview if you use it):

| Name | Value | Secret? | Safe in browser? | Purpose |
|---|---|---|---|---|
| `VITE_REAL_AUTH_API` | `true` | No | Yes (flag only) | Real login/session instead of mock users |
| `VITE_REAL_CATALOG_API` | `true` | No | Yes | Products/categories from the API |
| `VITE_REAL_REVIEWS_API` | `true` | No | Yes | Reviews from the API |
| `VITE_REAL_CART_API` | `true` | No | Yes | Server-side cart |
| `VITE_REAL_WISHLIST_API` | `true` | No | Yes | Server-side wishlist |
| `VITE_REAL_ADDRESSES_API` | `true` | No | Yes | Saved addresses |
| `VITE_REAL_SEARCH_API` | `true` | No | Yes | Server-side search |
| `VITE_REAL_RECOMMENDATIONS_API` | `true` | No | Yes | Recommendations |
| `VITE_REAL_NOTIFICATIONS_API` | `true` | No | Yes | In-app notifications |
| `VITE_REAL_COUPONS_API` | `true` | No | Yes | Coupon validation |
| `VITE_REAL_SHIPPING_API` | `true` | No | Yes | Shipping estimate (falls back to the flat-rate heuristic until Shiprocket is configured) |
| `VITE_REAL_ORDERS_API` | `true` | No | Yes | **Real checkout, orders, returns, tracking** |
| `VITE_REAL_ADMIN_API` | `true` | No | Yes | Real admin dashboards/management |
| `VITE_REAL_SELLERS_API` | `true` | No | Yes | Seller dashboard and storefronts |

Notes:

- These are build-time values: after adding them you must **redeploy** (Deployments → the latest → ⋯ → Redeploy). Check the build log has no `[folia] WARNING`.
- **Do not** set `VITE_API_PROXY_TARGET` in production — it's dev-only. In production `/api/*` is proxied by the rewrite in the root `vercel.json` to `https://folia-api.onrender.com/api/v1/...`. If the API URL ever changes, edit that file.
- **Never** put `RAZORPAY_KEY_SECRET`, JWT secrets, DB URLs or any other backend secret in a `VITE_*` variable.
- If you add a custom domain, also update `CORS_ORIGINS` and `FRONTEND_URL` on Render (section 3).
- What has and hasn't been exercised with all flags on (local, real API + real Postgres, 2026-09-19): login, catalog with images, product pages, cart (with photo), address creation, delivery step, COD checkout to a confirmed order, order history, seller storefronts, admin overview/marketplace/products pages. **Not exercised:** wishlist, coupons in the UI, search overlay against `/search`, notifications UI against the real API, admin returns/payout screens. Smoke-test those on the deployed site after enabling the flags.

---

## 3. Render environment variables

Render dashboard → **folia-api** → **Environment**. Values marked `sync: false` in `render.yaml` are prompted for in the dashboard and never committed.

| Name | Secret? | Where the value comes from | Status |
|---|---|---|---|
| `NODE_ENV` = `production` | No | Set in `render.yaml` | Set |
| `DATABASE_URL` | **Yes** | Auto-linked from `folia-postgres` | Set |
| `REDIS_URL` | **Yes** | Auto-linked from `folia-redis` | Set |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **Yes** | Render-generated | Set |
| `CORS_ORIGINS` | No | Must equal your storefront origin, e.g. `https://web-drab-mu-24.vercel.app` | Set — update for a custom domain |
| `FRONTEND_URL` | No | Same; used for links inside emails | Set — update for a custom domain |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | **Yes** | Section 4 | **Not set** |
| `RESEND_API_KEY` | **Yes** | Section 5 | **Not set** |
| `RESEND_FROM_EMAIL` | No | Your verified sender, e.g. `Folia <orders@your-domain.com>` | Default is the Resend sandbox sender |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | **Yes** | Section 6 | **Not set** |
| `SHIPROCKET_PICKUP_LOCATION` / `SHIPROCKET_PICKUP_PINCODE` | No | Section 6 | **Not set** |

Only environment variables that the code reads exist. Any variable I mention for object storage (section 7) does **not exist yet**.

The API boots fine with the third-party keys unset; those features then fail loudly (card/UPI checkout refuses; emails are logged but not sent; shipping falls back to the heuristic and admin "ship order" fails).

---

## 4. Razorpay

Test-mode keys are set **locally only** (in the gitignored `apps/api/.env` and the root `.env` that docker-compose reads); **production (Render) still has none**, so online payment is off there and COD is the only method that works on the live site. Do this in **Test Mode** first. A sandbox transaction is not a production payment.

**Verified locally on 2026-09-20 with Razorpay test keys** (real API + real database + Razorpay's real test servers):
- The keys are valid; the API creates real Razorpay test orders, and a wrong secret returns a clean HTTP 500 (never a 401, which would sign the shopper out).
- Checkout opens Razorpay's own window; the amount it shows equals the review page total and the stored payment amount to the paisa.
- Closing the window, a decline, and a forged signature each behave correctly: a forged payment is rejected by the verify endpoint, recorded as a failed attempt, and creates **no order**.
- Not yet verified: a real **successful** test payment (needs you to complete one in the window), webhook delivery, and refunds.

Bug found while testing: checkout charged Rs 79 Standard shipping on orders of Rs 999 or more while the page showed "Free" (the API had no free-shipping rule). Fixed in the API (`deliveryCost` in `order.types.ts`) with tests.


1. Create/open a Razorpay account (business KYC is needed for Live Mode, not for Test Mode). Switch the dashboard to **Test Mode**.
2. Dashboard → **Account & Settings → API Keys → Generate Test Key**. Copy the **Key Id** (`rzp_test_…`) and **Key Secret** (shown once).
3. Choose a webhook secret (a long random string you generate; not the key secret).
4. Render → folia-api → Environment: set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Save (Render redeploys).
5. Dashboard → **Account & Settings → Webhooks → Add New Webhook**:
   - URL: `https://folia-api.onrender.com/api/v1/payments/webhook`
   - Secret: the value from step 3
   - Active events (the code handles exactly these four): `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`
6. Sandbox test (use Razorpay's published test card/UPI values — confirm current ones in their Test Mode docs):
   - Place an order paying by card, then again by UPI.
   - Success path; failure path (use their failing test card/UPI); cancel the modal.
   - Refund an order from the admin refund action and wait for `refund.processed`.
7. Verify each of these, and record evidence (section 12):
   - Order creation happens **only after** payment confirmation (a gateway checkout has no order until verify).
   - Signature verification passes on verify, and a tampered signature is rejected.
   - The webhook arrives (Razorpay dashboard → Webhooks → delivery log shows 200) and the payment row reaches `CAPTURED`.
   - Failure leaves no order and releases reserved stock.
   - Refund reaches `PROCESSED`; amounts are in rupees in the app and paise only inside the Razorpay call.
8. Live Mode later: repeat with live keys, a small real payment, and a real refund. Never call sandbox results "production verified".

---

## 5. Resend (email)

Not configured. The app sends: email verification, password reset, order confirmed, order cancelled, order status changed, return requested/approved/rejected, refund processed, store credit issued, replacement issued, payment failed. **Seller emails do not exist** — sellers get in-app notifications only.

1. Create a Resend account. **Domains → Add Domain** for a domain you own; add the DNS records (SPF, DKIM) at your DNS host; wait for **Verified**.
2. **API Keys → Create API Key** with **sending** access only.
3. Render env: `RESEND_API_KEY` = the key; `RESEND_FROM_EMAIL` = `Folia <orders@your-domain.com>`. (The default `onboarding@resend.dev` only delivers to your own Resend account address.)
4. Confirm `FRONTEND_URL` is your real storefront URL (verification/reset links are built from it).
5. Test and check the **actual inbox** (also spam): register a new customer (verification), forgot-password (reset), place a COD order (confirmation), cancel an order.
6. Do not claim email works until each has arrived. Evidence: Resend dashboard → Emails log + a screenshot of the received message.

---

## 6. Shiprocket

Not configured; a real shipment/AWB/tracking has never been created.

1. Create/open a Shiprocket account; recharge the wallet (shipments consume real money — use small test orders).
2. Settings → **Pickup Addresses**: add and **verify** your pickup address (OTP). Note the address **nickname** exactly.
3. Create a **dedicated API user** (Settings → API) — its email/password are what the code logs in with, not your dashboard login.
4. Render env: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` (the API user), `SHIPROCKET_PICKUP_LOCATION` (the nickname from step 2), `SHIPROCKET_PICKUP_PINCODE` (6-digit PIN of that address).
5. Test: the cart-page estimate should now return a courier rate for a serviceable PIN (and fall back to the flat rate for unserviceable ones); place a COD order; in the admin, use **Ship this order**; confirm a real courier name and AWB are stored and a tracking link works; cancel/failed-shipment behaviour.
6. Record evidence (order id, AWB, Shiprocket panel screenshot). Never invent an AWB.

The current flat rates (₹79 near / ₹129 far, free above ₹999; delivery options ₹79/₹199/₹299) are **placeholders** in `apps/api/src/orders/order.types.ts`, `apps/api/src/shipping/shipping.service.ts` and their web mirrors — set them from your real Shiprocket rate card.

---

## 7. Durable object storage

**Important — this is more than configuration.** The API's storage layer (`apps/api/src/storage`) has exactly one implementation, `LocalStorageService`, writing to the container's ephemeral disk. There is **no S3 implementation and no storage environment variables**. Every seller-uploaded photo, seller verification document and return-evidence file is lost on each redeploy. (The bundled **demo** product images are unaffected: they are static files served by Vercel from `apps/web/public/demo/`.)

Do **not** "fix" this by making `/uploads` a public mount — seller KYC documents and return evidence must stay private.

### 7.1 Decisions and account steps (you)

1. Pick an S3-compatible provider (Cloudflare R2, AWS S3, or another). This is a cost/region/compliance choice — not made here.
2. Create the account, and **two buckets** (or one bucket with two prefixes and different policies):
   - **public-media** — product images and avatars. Public read is acceptable (or serve via the provider's CDN domain).
   - **private-docs** — `seller-verifications` and `return-evidence`. **No public access, ever.** These are served only through the API's authenticated `FilesController`.
3. Create **restricted credentials**: one key limited to these buckets with only get/put/delete/list (no account-wide admin key).
4. Turn on encryption at rest, and set lifecycle rules (for example, abort incomplete multipart uploads after 7 days; keep versioning/retention per your legal advice for KYC documents).
5. CORS: only needed if the browser will talk to the bucket directly. With the current design all uploads go browser → API → bucket, so **leave CORS closed** unless you later add direct uploads.

### 7.2 Engineering work required (needs your provider first)

A new `S3StorageService implements StorageService` (`upload`, `delete`, `createReadStream`) chosen in `StorageModule` by configuration, plus tests; existing `product_images.key` values map onto bucket keys. Proposed variable names (not yet in the code): `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. I did not implement this: without a provider account I cannot test it against a real bucket, and unverified S3 code would only look correct.

### 7.3 Acceptance tests once implemented

Upload a product image; retrieve it; upload a seller document and retrieve it as the owner (allowed), as another seller (403/404), as anonymous (401); same for return evidence; try guessing a private object URL directly on the bucket (must fail); redeploy the API and confirm every file is still retrievable; delete a product image and confirm the object is removed.

---

## 8. Database backups and restore testing

There is **no backup** today. Render's free Postgres has no automated backups or point-in-time recovery. **A backup that has never been restored is not verified.**

### Option A — paid managed Postgres (recommended)

Upgrade `folia-postgres` to a paid plan and check on Render's current pricing/docs page what retention and point-in-time recovery that plan includes (I have not asserted numbers). Turn on whatever automated backups it offers.

### Option B — scheduled `pg_dump` to durable external storage

1. A scheduled job (for example a GitHub Actions cron workflow, with the DB URL and storage keys in encrypted secrets — never in the repo) runs:
   ```bash
   pg_dump --format=custom --no-owner --dbname "$DATABASE_URL" --file "folia-$(date -u +%F).dump"
   ```
2. Encrypt it (`age` or `gpg`) before upload, then upload to a bucket that is **not** the one holding user files, in a different account/region if possible.
3. Retention example: 14 daily, 8 weekly, 6 monthly. Enforce with bucket lifecycle rules.
4. Monitoring: have the job ping a dead-man's-switch service (for example healthchecks.io) on success; alert when it goes quiet.

### Restore test (do this before you trust any backup)

1. Create a scratch Postgres (local Docker or a temporary managed instance).
2. ```bash
   createdb folia_restore_test
   pg_restore --no-owner --dbname folia_restore_test folia-YYYY-MM-DD.dump
   ```
3. Compare: row counts for `users`, `products`, `orders`, `payments`; `select max("createdAt") from orders;`.
4. Point a local API at it (`DATABASE_URL=…folia_restore_test`) and log in / open an order.
5. Write down how long it took and any manual steps: that is your real recovery time. Repeat quarterly.

Disaster recovery outline: provision Postgres → restore latest dump → point `DATABASE_URL` at it in Render → redeploy → run `curl /api/health/ready` → check the newest order/payment against Razorpay's dashboard for the gap between the last backup and the failure.

---

## 9. GST / tax

The tax is a **placeholder flat 8%** (`TAX_RATE` in `apps/api/src/orders/order.types.ts` and `apps/web/src/utils/pricing.ts`). The invoice shows a CGST+SGST or IGST split of that placeholder, and its header uses an invented company block with a `(mock GSTIN)` label (`apps/web/src/utils/invoice.ts`). **It is not a GST-compliant invoice** and must not be presented as one.

Decisions/data that must come from you and your tax professional before engineering can implement real GST:

1. Product classification: **HSN/SAC** code per product category (live plants, planters, soil, tools, décor may differ).
2. **GST rate** per category (0/5/12/18/28% as applicable).
3. **CGST+SGST vs IGST** rules (intra-state vs inter-state, from seller and buyer state).
4. Each seller's **GST registration status** and **GSTIN** (the seller form now collects an optional one; it is admin-visible only, checksum-validated, and not proof of registration).
5. The **marketplace invoicing model**: does Folia invoice the customer, or does each seller? Who is the supplier for each line? (Today the invoice is platform-level.)
6. Folia's **legal entity name**, registered/billing address, and **GSTIN** if applicable.
7. E-commerce operator obligations (tax collected at source / tax deducted at source on seller payouts): confirm with a CA which apply to you.

---

## 10. Seller payouts, invoicing identity, and legal

- **Payout provider — decision needed.** Payouts are currently recorded in the system and transferred manually outside it; the schema deliberately stores no full bank account number and no provider is configured. If you want automated payouts (for example RazorpayX) that is a provider/KYC/business decision first, then engineering.
- **Seller KYC review process** — who reviews uploaded documents, against what checklist, and how long they are retained (private storage must exist first: section 7).
- **Legal pages.** `/policies/privacy` and `/policies/terms` are illustrative placeholders and say so on the page. Replace them with lawyer-reviewed text; add grievance-officer/contact details and consumer-law disclosures as required for an Indian marketplace.
- **Real company details** on the invoice, the contact page (`ContactInfo.tsx` uses a fictional Bengaluru address and phone number), and the footer.
- **Enquiries — decide who answers them.** The contact form, the gardening-services form and the corporate-gifts form all save to the database (`enquiries` table) and show up in **Admin → Enquiries**. No email is sent when one arrives, so someone has to check that page (or you wire Resend to notify an inbox first: section 5). The gardening-services and corporate-gifts pages describe services in general terms and promise no prices or timelines; before launch, confirm which services you can really deliver, in which cities, and edit the wording in `apps/web/src/pages/GardeningServices.tsx` and `CorporateGifting.tsx` to match. The newsletter sign-up form has no backend endpoint yet.

---

## 11. Before a real launch, remove the demo content

Everything seeded from `apps/api/prisma/demo/catalog.json` is fictional: sellers, products, reviews, and their photographs/illustrations (credits in `apps/web/public/demo/CREDITS.md` and the site's `/policies/photo-credits` page; the Wikimedia photographs are used under CC BY / CC BY-SA / CC0 / public-domain terms and must stay credited while they are in use). Before real sellers and customers arrive:

1. Deactivate/delete the 8 demo sellers and their 55 products (admin marketplace pages, or SQL on the seller/product rows), keeping the roles, permissions and your admin.
2. Remove the `photo-credits` page and `apps/web/public/demo/` when the last demo image is gone.
3. Have sellers upload their own photography — which needs section 7 first.

---

## 12. Evidence log template

For every external integration record, with dates: what you did → what you observed → evidence (screenshot/log/IDs) → who verified.

| Integration | Test performed | Result | Evidence (IDs/links) | Date |
|---|---|---|---|---|
| Razorpay (test) | card success / UPI success / failure / refund / webhook delivery | | | |
| Resend | verification / reset / order confirmation | | | |
| Shiprocket | rate estimate / shipment + AWB / tracking | | | |
| Object storage | upload / private retrieval / unauthorised / redeploy persistence | | | |
| Backup | dump created / restored / row counts match / restore time | | | |

---

## 13a. Location features rely on two free third-party services

The delivery-location picker, "Use my current location" and the address-form autofill call, **from the visitor's browser**:

- **OpenStreetMap Nominatim** (`nominatim.openstreetmap.org/reverse`) — turns coordinates into an address. It is a free community service with a usage policy (light, user-initiated use; no bulk; identifiable traffic) and no uptime guarantee. Fine for a demo or low traffic; **for a real launch switch to a paid geocoder** (for example Google Maps, Mapbox or Ola Maps) — the only file to change is `apps/web/src/utils/geo.ts`.
- **India Post PIN data** (`api.postalpincode.in`) — PIN → city/state for manually entered PIN codes. Unofficial and unguaranteed. When it is unreachable the PIN still works for delivery estimates, but the state is unknown and the "Ships from my state" filter is disabled with an explanation.

Privacy as built: coordinates are used for one lookup and never stored; only PIN, city and state are kept, in the visitor's own browser (`localStorage`). Update your privacy policy to say that a lookup is sent to OpenStreetMap when someone clicks the button. "Ships from" comes from each seller's business-address state (and Folia's Bengaluru dispatch for Folia-owned products); **it is not a serviceability check** — real per-PIN serviceability needs Shiprocket (section 6).

---

## 13. Launch blocker register

**P0 — must be resolved before any real customer or payment**

- Production may hold known-password accounts (0.2) — run the seed with `SEED_LOCK_DEMO_ACCOUNTS=true`.
- Postgres has no backups and expires ~2026-10-03 (0, 8).
- Razorpay keys/webhook not configured; card/UPI never verified (4).
- No durable object storage; uploads vanish on redeploy; storage code for it does not exist yet (7).
- Vercel `VITE_REAL_*` flags unverified — without them production runs mock checkout (2).
- GST is a placeholder; invoice is not compliant (9).
- Legal pages and company identity are placeholders (10).

**P1 — needed for a credible launch**

- Resend not configured — no real emails (5).
- Shiprocket not configured — flat-rate placeholders, no real shipments (6).
- Payout provider/process and seller KYC process undecided (10).
- Live catalog is fictional demo content (11).

**P2 — improvements**

- Free-tier Render cold starts; monitoring/alerting; a restore drill schedule.
- Seller email notifications do not exist.
- Wishlist/coupons/search/notifications/admin-returns screens not smoke-tested against the real API with all flags on (2).
