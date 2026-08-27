# Folia — a premium plant & home décor storefront (portfolio project)

An original, production-grade React storefront built to demonstrate senior-level
frontend architecture — not a clone of any real business. Inspired by the *category*
of premium D2C plant/home-goods shopping experiences; the visual identity, copy,
layout, and component design are original.

This is being built in phases. See **Build status** below for what's real vs. stubbed.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router v7 ·
Framer Motion · Zustand · TanStack Query · React Hook Form + Zod · Axios ·
Lucide React · Swiper · MSW · ESLint + Prettier

Forms and mock authentication (Phase 5) use React Hook Form + Zod throughout —
see [Forms & auth](#forms--auth) below.

## Getting started

```bash
npm install
npm run dev       # start dev server
npm run build     # typecheck + production build
npm run lint       # eslint, zero warnings enforced
npm run format     # prettier --write
npm run preview    # preview the production build locally
```

Requires Node 20+.

## Design system

Every color, font, radius, and shadow used in the UI is a token defined once in
`src/index.css` under `@theme` (Tailwind v4's CSS-first config) — nothing is a
one-off magic hex value in a component.

**Palette:** `pine` (deep forest, primary dark), `fern` (mid green, interactive),
`stone` (warm-grey paper background), `ink` (text), `ochre` (accent/CTA),
`rust` (functional — sale badges/errors only).

**Type:** Bricolage Grotesque (display, used large and sparingly), Inter (body),
IBM Plex Mono (prices, SKUs, meta — a nod to physical plant-nursery tags).

**Signature element:** `<Tag>` (`src/components/ui/Tag.tsx`) — a die-cut label
motif with a punched-hole detail, referencing real nursery tags. Used for
badges, prices, and stock labels throughout instead of a generic pill.

## Project structure

```
src/
├── components/
│   ├── common/      # FormField, PasswordInput, Alert, Toast, Modal, LoadingOverlay,
│   │                #   Breadcrumb, PageHeader, Accordion, EmptyState, PageLoader, Logo
│   ├── layout/      # Navbar, Footer, MobileNav, MegaMenu, SearchDrawer, Layout shell
│   ├── ui/          # Design-system primitives: Button, Tag, Card, Container
│   ├── product/     # Listing, filters, gallery, variants, reviews, cards
│   ├── cart/        # SlideCart, CartLineItem, CartSummary, CouponInput, ShippingEstimator
│   ├── wishlist/    # WishlistGrid
│   ├── blog/        # BlogCard, FeaturedPost
│   ├── contact/     # ContactForm, ContactInfo
│   ├── auth/        # ProtectedRoute
│   └── forms/       # NewsletterForm
├── pages/           # Route-level components, each lazy-loaded — every route
│                    #   renders real content; none are placeholders
├── routes/          # Router config (code-split route tree)
├── hooks/           # useProducts, useCart, useWishlist, useAuth, useBlog, etc.
├── services/        # API layer — one file per domain, all calling the mock backend
├── store/           # Zustand stores — cart, wishlist, auth, ui, toast
├── utils/           # cn(), pricing, currency, validation schemas, fakeJwt, apiError
├── mocks/           # MSW handlers — products/categories/reviews, auth, contact/newsletter
├── data/            # Mock content fixtures — products, reviews, blog, faq, policies, users
├── types/           # Shared TypeScript types, one file per domain
└── styles/          # (token rationale notes, if split out from index.css)
```

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffolding, Tailwind, design tokens, shared UI primitives, routing, layout | ✅ Done |
| 2 | Homepage sections, full nav (mega menu, search drawer), footer polish | ✅ Done |
| 3 | Product listing (filters/sort/pagination), product detail, MSW mock API | ✅ Done |
| 4 | Cart, wishlist, Zustand stores, persistence | ✅ Done |
| 5 | Static pages, forms (RHF + Zod), mock authentication, blog, FAQ | ✅ Done |
| 6 | Animation pass, performance, accessibility audit, SEO | Not started |

Every route now renders real content — no placeholder pages remain anywhere
in the app (see the Phase 5 changelog at the bottom of this file for what
that took).

## Mock backend

`src/mocks/handlers.ts` defines the MSW-powered API: `/api/products` (filter,
sort, paginate, search), `/api/products/:slug`, `/api/products/:slug/related`,
`/api/categories`, `/api/collections/:slug`, `/api/reviews`. Backed by a
generated 24-product catalog (`src/data/products.ts`, 72 reviews in
`src/data/reviews.ts`) with an artificial 350ms delay so loading states are
exercised, not just assumed to work.

MSW only starts in dev (`src/mocks/index.ts` checks `import.meta.env.DEV`) and
is fully tree-shaken out of the production bundle — verified by grepping
`dist/` for `setupWorker` after a build. Swapping to a real backend later means
changing `src/services/apiClient.ts`'s `baseURL` and deleting `src/mocks/` —
nothing in components or hooks needs to change, since they only ever call the
`src/services/` functions.

## Cart & wishlist

Two independent Zustand stores (`src/store/cartStore.ts`,
`src/store/wishlistStore.ts`), both persisted to `localStorage` via the
`persist` middleware — cart and wishlist work fully for guest visitors, no
auth required — and stay that way even now that Phase 5 added real
authentication, by design (see "Forms & auth" below for why cart/wishlist
are deliberately independent of the auth store).

- **Cart lines are keyed by `productId::variantId`**, not just product ID, so
  the same plant in different pot sizes are separate lines. Each line snapshots
  price/name/variant at add-time rather than re-deriving it from the live
  catalog — a real cart shouldn't change retroactively if a price changes.
- **Stock validation** caps each line at `product.stockCount`, captured as
  `maxQuantity` on the line. Variants only carry an `inStock` boolean in this
  catalog (no per-variant count), so the cap is uniform per product — a
  documented simplification, not a silent one.
- **Coupon validation and shipping estimation are genuinely async**
  (`src/services/couponService.ts`, `src/services/shippingService.ts`,
  simulated network delay, can fail with a real error message) — that's
  where the optimistic-UI requirement actually applies. Cart add/remove/
  quantity changes are synchronous local state with no network round-trip,
  so they don't get fake optimistic-UI treatment; there's nothing to be
  optimistic about.
- **`hasHydrated` flags on both stores** gate the cart badge, drawer, and
  full cart/wishlist pages. `localStorage` reads inside Zustand's `persist`
  middleware resolve asynchronously (at least one microtask), so without this
  gate the cart badge would flash "0" before jumping to the real count on
  every page load — a real bug, fixed properly rather than routed around.
- **Wishlist → cart** for a product with variants redirects to the product
  page instead of guessing a variant, since a wishlist entry never records
  which variant was intended.
- **Checkout** is an honest dead end: clicking "Proceed to checkout" shows an
  inline note explaining this is a portfolio project with no payment
  processor, rather than a silently-broken button or a fake payment form.

### Known simplification: stale stock snapshots

A cart line's `maxQuantity` is captured once, at add-time. If a product's
real stock changes afterward (sells out elsewhere, restocks), the cart line
doesn't know. A production app would revalidate against live inventory at
checkout; that's out of scope here since there's no real inventory system
behind this mock catalog to revalidate against.

## Forms & auth

Every form in the app (`Contact`, `Newsletter`, `Login`, `Register`,
`ForgotPassword`, `ResetPassword`) uses React Hook Form + Zod, through two
shared primitives: `src/components/common/FormField.tsx` (label + input or
textarea + error, wired to RHF's `register`/`errors`) and
`src/components/common/PasswordInput.tsx` (adds the show/hide toggle).
Schemas live in `src/utils/validation.ts` — one file, not scattered per-form,
so validation rules stay consistent (e.g. the same password-strength regex
backs both Register and Reset Password).

**Auth is mock, loudly.** `src/types/auth.ts` and
`src/utils/fakeJwt.ts` both carry comments making this explicit: passwords
are compared as plain strings against a seeded in-memory list
(`src/data/users.ts`), and the "JWT" is a base64 payload with no real
signature. This exists to demonstrate the auth *flow* — forms, protected
routes, a persisted session, a session-verification round trip — not to be
copied into a production system.

- `src/store/authStore.ts` follows the exact same `hasHydrated` pattern as
  `cartStore`/`wishlistStore` (same bug class avoided: without it,
  `ProtectedRoute` would flash-redirect a logged-in user to `/login` on
  every page reload, before the persisted session had a chance to load).
- `src/components/auth/ProtectedRoute.tsx` guards only `/account` — cart,
  wishlist, shop, and checkout all stay fully usable as a guest, by design
  (see "Cart & wishlist" above; the cart/wishlist stores have zero imports
  from anywhere in the auth domain — verified, not just claimed).
- `App.tsx` calls `refreshSession()` once, right after the auth store
  rehydrates, to verify a persisted token against the mock `/api/auth/me`
  endpoint — see "Known issues" below for what that means in practice given
  the mock backend's in-memory user list.
- Forgot Password deliberately returns the same success response whether or
  not the email is registered (`src/mocks/authHandlers.ts`) — correct
  real-world practice to avoid leaking which emails have accounts. Since
  there's no real email delivery in this mock, the response includes a
  `devToken` the UI surfaces as a demo "Continue to reset password" link,
  clearly labeled as standing in for what would normally arrive by email.
- The mock `/api/contact` endpoint fails ~10% of the time, on purpose
  (`src/mocks/contactHandlers.ts`) — the contact form's error state is
  reachable on an ordinary review pass, not just a theoretical code path
  nobody ever exercises.

## Content pages

Blog (`src/data/blog.ts`, 10 posts) and FAQ (`src/data/faq.ts`, 13 entries
across 4 categories) are static data, not MSW-backed — unlike the product
catalog, this content never changes shape at runtime, so adding MSW surface
for it would be scope growth without a real payoff. Filtering, search, and
pagination for both are plain `useMemo`-based client-side logic
(`src/hooks/useBlog.ts`).

The shared `Accordion` component (`src/components/common/Accordion.tsx`,
originally built in Phase 3 for the product FAQ) now animates open/closed
with Framer Motion — used by both the FAQ page and Product Detail's FAQ
section, so the improvement benefits both call sites, not just the new one.



- **Auth sessions don't survive a page reload for non-demo accounts.** The
  mock user "database" (`src/mocks/authHandlers.ts`) is an in-memory array
  that resets on every reload, while the auth store's token persists in
  localStorage. On load, `App.tsx` calls `refreshSession()` to verify the
  token against `/api/auth/me` — for any account registered earlier in a
  previous session, that verification now fails (correctly), logs the
  person out, and shows an explanatory toast. Only the seeded demo account
  (`demo@folia.example` / `folia-demo`) survives a reload. This is an
  honest consequence of a mock backend with no real database, not a bug —
  but it's worth knowing before a review session where someone registers,
  reloads, and wonders why they were signed out.
- **Guest and account carts aren't merged.** Adding items as a guest, then
  logging in, doesn't combine a pre-existing account cart with the guest
  cart (there's no account-side cart to merge with, since cart state is
  entirely local/localStorage-based, independent of the auth store by
  design — see "Cart & wishlist" above). Flagged in the FAQ page's own
  content as a roadmap item, not hidden.
- **Curated collections vs. real categories.** Real categories
  (plants/vessels/tools) resolve their metadata synchronously from local
  data; curated collections (e.g. "gifting", spanning multiple categories)
  fetch their framing copy from `/api/collections/:slug` via
  `useCollection`. Either way, the *product filtering* for a collection page
  still only narrows by a single `categorySlug` when one exists — a
  collection that's supposed to span categories currently shows the full
  catalog under that collection's title/description rather than a true
  cross-category product filter. A real backend would resolve a collection's
  product set server-side; building that mapping into the mock catalog
  wasn't worth the scope for a demo collections page.

## Notes on scope vs. the original brief

This project takes inspiration from the *feature richness* of modern premium
plant/home-décor e-commerce sites, not from any specific company's design,
layout, or branding — see the design plan discussion for the reasoning. No
assets, copy, or code were copied from a reference site.

## Changelog — Phase 5

**Pages** (all real content, none placeholders): About, Contact, FAQ, four
Policy pages (Shipping/Returns/Privacy/Terms), Blog Listing, Blog Detail,
Account landing (protected), Login, Register, Forgot Password, Reset
Password. Replaced the stale `Search.tsx` placeholder (labeled "Phase 3",
which had already happened) with a real search-results page, and wired the
search drawer's Enter-to-submit to actually navigate there.

**Forms**: Contact (name/email/phone/subject/message, real MSW submission,
~10%-intentional failure rate so the error state is reachable), Newsletter
(rewritten to hit a real MSW endpoint with duplicate-subscription handling —
was previously Phase 2's local-only fake), Login (email/password, show/hide,
remember me), Register (password strength + confirmation + mock email
uniqueness), Forgot/Reset Password (no account-enumeration leak, demo
continuation link standing in for real email delivery).

**Mock authentication**: login/register/logout/current-user/forgot/reset
endpoints (`src/mocks/authHandlers.ts`), a persisted `authStore` with the
same hydration-gating pattern as cart/wishlist, `ProtectedRoute`, and a
session-verification bootstrap (`refreshSession`) that runs once on app
load — see "Forms & auth" above for what that surfaces given the mock
backend's in-memory user list.

**Reusable components added**, each for a genuine, non-contrived use:
`FormField`, `PasswordInput`, `Alert`, `Toast` + `toastStore`,
`LoadingOverlay`, `Modal` (real focus trap: Tab-cycling, focus restored to
the trigger on close), `Breadcrumb` (extracted from Product Detail's
existing inline markup), `PageHeader`.

**Fixes and cleanup that came out of the "no dead code" pass** — not
cosmetic, each one either removed something genuinely unused or wired up
something that was built but never connected:
- Deleted `components/ui/Input.tsx` (Phase 1 component, never imported
  anywhere — `FormField` supersedes it).
- Deleted `PlaceholderPage.tsx` once nothing referenced it.
- Consolidated `AuthSession`/`AuthError` (defined in Phase 5 but initially
  left unused) into `authService.ts`'s actual error handling, replacing a
  duplicate local `AuthResponse` interface — now consistent with the
  `CouponError`/`ShippingError`/`NewsletterError` pattern already
  established in Phase 4/5.
- Wired `fetchCurrentUser` (built but never called) into the new
  `refreshSession` bootstrap.
- Wired `fetchCollectionBySlug` (built in Phase 3 with a matching MSW
  handler, but never actually called — `Category.tsx` had always bypassed
  it with a static lookup) into a new `useCollection` hook, now used for
  curated collection pages.
- Removed `useIsAuthenticated` (built speculatively, no consumer ever
  needed the boolean form over the user object itself).
- Un-exported `ProductCardSkeleton` (internal-only helper that had no
  external consumer).

**Performance**: caught and fixed a real regression, not just re-flagged
it. `useCurrentUser` → `authStore` pulled `axios` into the eager bundle via
the non-lazy `Navbar`, on top of the existing `framer-motion` pull from
`MegaMenu`/`SearchDrawer`/`ToastViewport` — pushed the main chunk to 571KB
and brought back Vite's chunk-size warning. Fixed with `vite.config.ts`
manual chunking (`framer-motion`, `axios`, `zustand` each split into their
own parallel-fetched, independently-cacheable chunk) — main chunk down to
447KB, warning gone.

**Verification**: `npx tsc -b`, `eslint . --max-warnings 0`, and
`npm run build` all pass clean. Confirmed zero `TODO`/`FIXME` comments,
zero `console.log`, zero `@ts-ignore`/`@ts-expect-error`, zero real `any`
usage, and — via a full export-reference scan across every file in `src/`,
not just a grep for the word "TODO" — zero orphaned files and zero
genuinely dead exports (the handful of type-only exports that remain
unimported elsewhere are self-documenting domain types with no runtime
cost, consumed within their own file; left in deliberately, not missed).
