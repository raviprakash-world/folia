# Frontend ↔ Backend Integration — Status

Phase 10 of the backend roadmap. This document exists because this
phase's central claim — "the frontend correctly talks to the real
backend" — could not be verified in the sandbox this was built in, and
that limitation needed to be stated plainly rather than smoothed over
or silently worked around.

## Why this phase is different from every phase before it

Phases 0–9 all had a real fallback even with `prisma generate` blocked
(see `apps/api/README.md`'s "Known Issues"): the actual business logic
could still be proven correct via unit tests against mocked Prisma
calls. That gave genuine, if partial, confidence in what shipped.

This phase's entire premise — a real browser, running the real
frontend, making a real HTTP request that reaches the real NestJS
backend, which talks to a real database, and returns a response the
frontend correctly parses into its existing state — requires a
live-booted backend with a working database connection. That has been
blocked since Phase 0. Nothing here changes that.

## What was actually done — auth domain only, deliberately scoped

Rather than attempt all 18 domains the roadmap lists (which would mean
producing a large amount of code with **zero** ability to verify any of
it — the opposite of this project's standard through Phase 9), this
phase does one domain, carefully, and stops.

1. **`apps/web/vite.config.ts`** — a dev-server proxy, `/api/auth/*` →
   the real backend, rewriting the path to add the `/v1` prefix the
   real backend actually uses (the mock handlers and the rest of this
   frontend are unversioned; the real backend is versioned throughout
   except its health check — see `apps/api/README.md`'s API
   conventions). **Off by default** (`VITE_REAL_AUTH_API` unset) —
   nothing about the normal dev experience changes unless you opt in.
   Scoped to `/api/auth` specifically: proxying all of `/api/*` would
   have silently broken every other domain's MSW mocking, which is not
   this phase's job.

2. **`apps/web/src/mocks/browser.ts`** — when the same flag is set, the
   auth handlers are excluded from MSW's registered handler set (MSW's
   `onUnhandledRequest: 'bypass'`, already configured, means those
   specific requests then reach the real network — i.e., the proxy
   above — instead of erroring). Every other domain's handlers stay
   registered regardless of this flag's value.

3. **`apps/web/src/services/apiClient.ts`** — a real, working
   refresh-token interceptor, which never needed to exist against MSW's
   mock (fake tokens never expire meaningfully). Deliberately does
   **not** import `authStore` directly (that would create a real
   circular dependency — traced and confirmed before writing this, not
   assumed away); `authStore` calls exported setters into `apiClient`
   instead, keeping `apiClient` decoupled from any particular state
   library. Concurrent 401s from multiple in-flight requests are
   deduplicated to one real refresh call, not one per failed request.

4. **`apps/web/src/services/authService.ts`** — a real `refresh()`
   function calling `POST /auth/refresh`, matching the real backend's
   actual contract (Phase 1) — has no MSW handler and simply isn't
   called unless the flag is on.

5. **`apps/web/src/store/authStore.ts`** — every point where the token
   changes (login, register, logout, refresh success, refresh failure,
   and hydration after a page reload) now also syncs `apiClient`'s
   module-level token, and registers the refresh handler once at module
   load.

## What is and is not actually verified

**Verified, genuinely:**
- The whole frontend still compiles (`tsc -b`), lints (zero warnings),
  and produces a real production build after every change in this
  phase — checked after each file, not just at the end.
- `vite.config.ts`'s proxy rewrite logic was checked against Vite's
  actual `ConfigEnv`/`loadEnv` API (a first draft assumed an `env`
  property on the config callback's argument that does not exist —
  caught by checking Vite's real type definitions directly, not by
  assuming the pattern was right, and fixed before it could have been a
  silent no-op).
- The MSW-handler-exclusion filter's reference-equality logic was
  proven with a standalone script mimicking the actual spread pattern
  used in `handlers.ts`, not assumed to work.
- Every backend endpoint this integration calls
  (`/auth/login`, `/auth/register`, `/auth/logout`, `/auth/me`,
  `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`,
  `/auth/change-password`) was matched against the real, already-tested
  backend contract (`apps/api/src/auth/`, 106+ passing tests across
  Phase 1) by reading both sides side by side.

**NOT verified, and cannot be from this sandbox:**
- Whether a real browser can actually complete a login round-trip
  against the real backend.
- Whether the httpOnly refresh cookie is actually set and read back
  correctly through the dev proxy.
- Whether the 401 → refresh → retry flow actually works in practice,
  not just in the code's logical structure.
- Whether Prisma's `Decimal`/`Date` serialization over real JSON lands
  correctly in the frontend's existing type expectations (this was
  designed for and checked at the type level throughout Phases 1–9, but
  never observed over a real wire).

## How to actually verify this, if you have a working environment

1. `cd apps/api && npx prisma generate && npx prisma migrate dev && npm run prisma:seed && npm run start:dev`
2. `cd apps/web && cp .env.example .env` and set `VITE_REAL_AUTH_API=true`
3. `npm run dev`
4. Try logging in with the seeded demo account (`demo@folia.example` /
   `folia-demo`, per `apps/api/README.md`'s "Demo accounts").
5. Confirm in DevTools → Network that the request actually left for
   `/api/auth/login` and a `Set-Cookie` header came back.
6. Confirm in DevTools → Application → Cookies that the refresh cookie
   is present and marked httpOnly.
7. Manually expire the access token (or wait out its `JWT_ACCESS_EXPIRY`
   window) and confirm a subsequent authenticated request triggers a
   real `/auth/refresh` call and transparently retries, rather than
   showing an error.
8. Only once all of that holds: consider the auth domain verified, and
   only then would removing `authHandlers` from MSW entirely (rather
   than just excluding them behind a flag) be appropriate — per the
   roadmap's own rule, not done here.

## Remaining domains

Not started: Users/profile, Products, Categories, Collections, Search,
Inventory, Wishlist, Cart, Addresses, Checkout, Orders, Tracking,
Returns, Notifications, Recommendations, Analytics, Admin. Each would
need the same treatment — real code, matched carefully against the
existing backend contract, with the same explicit verified/unverified
accounting — not a bulk pass across all of them at once.
