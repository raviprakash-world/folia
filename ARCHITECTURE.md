# Architecture

This documents how Folia is built: routing, state, the service layer, the
mock backend, and the decisions behind each. `README.md` covers what the
project is and how to run it; `CHANGELOG.md` covers what shipped in each
phase. This file covers *why it's built the way it is*.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router v7 ·
Framer Motion · Zustand · TanStack Query · React Hook Form + Zod · Axios ·
MSW · jsPDF (one deliberate exception — see Notable Decisions) · Lucide
React · Swiper · ESLint + Prettier.

## Layered architecture

```
┌─────────────────────────────────────────────────────────┐
│  Pages (src/pages/)                                      │
│  Route-level components. Compose components + hooks.      │
│  Never call services or MSW directly.                     │
└───────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│  Components (src/components/)                                │
│  common/ ui/ layout/ product/ cart/ wishlist/ blog/ contact/  │
│  auth/ account/ checkout/ order/ forms/                       │
└───────────────────────┬───────────────────────────────────┘
                         │
        ┌────────────────┼─────────────────┐
        │                │                 │
┌───────▼──────┐  ┌───────▼───────┐  ┌──────▼───────┐
│ Zustand       │  │ TanStack      │  │ Hooks         │
│ stores        │  │ Query hooks   │  │ (derived      │
│ (client       │  │ (server-      │  │ selectors,    │
│ state)        │  │ state cache)  │  │ orchestration)│
└───────┬──────┘  └───────┬───────┘  └──────┬───────┘
        │                 │                  │
        │         ┌────────▼───────┐         │
        │         │ Service layer   │◄────────┘
        │         │ (src/services/) │
        │         └────────┬───────┘
        │                  │
        │         ┌────────▼───────┐
        │         │ MSW mock        │
        │         │ backend         │
        │         │ (src/mocks/)    │
        │         └────────────────┘
        │
   (persist to localStorage directly —
    cart/wishlist/orders/etc. never
    touch the service layer, since
    there's no real backend behind them)
```

Two kinds of client state, deliberately not mixed:

- **Pure client state** (cart, wishlist, orders, recently-viewed, checkout
  flow, UI/toast/notifications): a Zustand store, `persist`-backed to
  `localStorage` where it should survive a reload, talking to nothing.
- **Server-shaped state** (products, categories, reviews, addresses,
  auth): a service function calling MSW, wrapped in either a TanStack
  Query hook (read-heavy, cacheable — products) or a Zustand store with
  async actions (needs local optimistic/cached state too — auth,
  addresses).

## Routing

```
/                              Home
/shop, /collections/:slug      Product listing
/product/:slug                 Product detail
/search, /cart, /wishlist      (guest-accessible)
/about, /contact, /blog*, /faq, /policies/:slug
/account/login, /register, /forgot-password, /reset-password

── ProtectedRoute (redirects to /account/login, ?from= preserved) ──
  /account                     AccountLayout (sidebar/mobile nav/breadcrumbs)
    ├─ /                       Overview (dashboard)
    ├─ /profile
    ├─ /addresses
    ├─ /orders, /orders/:id
    ├─ /settings
    ├─ /security
    └─ /notifications
  /checkout                    CheckoutLayout (stepper; redirects to /cart if empty)
    ├─ /shipping
    ├─ /delivery
    ├─ /payment
    └─ /review
  /checkout/confirmation/:orderId   (own page, no stepper chrome)

/*                              404
```

Every route component is `lazy()`-loaded. `/checkout/*` reuses the exact
same `ProtectedRoute` as `/account/*` — a guest gets redirected to login
with a return path, not a separate guest-checkout implementation. Browsing,
cart, and wishlist stay fully guest-accessible; only placing an order and
the account dashboard require a session.

## State management — every Zustand store

| Store | Persisted? | Purpose |
|---|---|---|
| `cartStore` | Yes | Cart line items (variant-aware, `productId::variantId` keys), coupon, shipping estimate. `couponStatus`/`shippingStatus`/errors excluded from persistence (transient). |
| `wishlistStore` | Yes | Saved product references, toggle/add/remove. |
| `authStore` | Yes (user + token only) | Mock session. `refreshSession` re-validates the token against `/api/auth/me` once per app load. |
| `addressStore` | Yes (cache) | MSW-backed CRUD; cache is always overwritten by the server response on fetch, not trusted blindly like `authStore`'s token. |
| `orderStore` | Yes | Full order history — pure client-side, no backend (orders are generated at checkout, not fetched). |
| `checkoutStore` | **No** | In-progress checkout selections. Deliberately not persisted — a refresh mid-checkout restarts the flow, and no payment detail (even masked) ever touches `localStorage`. |
| `notificationStore` | Yes | Notification center feed. One-time seed for types with no live trigger (price drop, promotion). |
| `preferencesStore` | Yes | Notification-preference toggles (email/SMS opt-ins) — separate from the notification *feed* above. |
| `recentlyViewedStore` | Yes | Last 20 viewed products, deduplicated, most-recent-first. |
| `toastStore` | No | Ephemeral toast queue. |
| `uiStore` | No | Slide-cart drawer open/closed — lets `ProductDetail` (a different branch of the route tree) open a drawer that lives in `Navbar`. |

**The `hasHydrated` pattern**, used by every persisted store except the
two intentionally-ephemeral ones: Zustand's `persist` middleware resolves
asynchronously even for synchronous storage like `localStorage` (at least
one microtask). Without a `hasHydrated` flag, gated in the UI, a page
reload would flash the *default* empty state (cart badge "0", "not logged
in", empty preference toggles) for one tick before the real persisted data
loads. Every store above implements this identically: a boolean field, an
`onRehydrateStorage` callback that flips it, and consumers check it before
rendering anything derived from persisted state.

## Service layer — src/services/

One file per domain, each wrapping Axios calls to `/api/*` (routed to MSW
in dev, tree-shaken out of production entirely — see Mock backend below).

| Service | Backs |
|---|---|
| `apiClient.ts` | Shared Axios instance (`baseURL: '/api'`) |
| `productService.ts` | Product listing/detail/related |
| `categoryService.ts` | Categories, collections |
| `reviewService.ts` | Product reviews |
| `authService.ts` | login/register/logout/me/forgot/reset/change-password/update-profile |
| `addressService.ts` | Address CRUD |
| `contactService.ts` | Contact form submission |
| `newsletterService.ts` | Newsletter subscribe (typed `NewsletterError` for duplicate emails) |
| `couponService.ts` | Coupon code validation (not MSW — a local async function; see Notable Decisions) |
| `shippingService.ts` | Cart's ZIP-based shipping estimate (also not MSW) |
| `deliveryService.ts` | Checkout's delivery-method availability check (also not MSW) |
| `paymentService.ts` | Mock payment processing, ~15% intentional decline rate on card/UPI/net-banking |
| `trackingService.ts` | Wraps the tracking MSW endpoint |

## Mock backend (MSW) — every endpoint

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products` | Filter/sort/paginate/search |
| GET | `/api/products/:slug` | Single product |
| GET | `/api/products/:slug/related` | Same-category products |
| GET | `/api/categories` | Category list |
| GET | `/api/collections/:slug` | Curated collection metadata |
| GET | `/api/reviews?productId=` | Reviews for a product |
| POST | `/api/auth/login` | |
| POST | `/api/auth/register` | Email-uniqueness checked against the session-scoped user list |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | Bearer-token validation |
| PUT | `/api/auth/me` | Profile update (name/email/phone/avatar) |
| POST | `/api/auth/forgot-password` | Same response whether or not the email exists (no account enumeration) |
| POST | `/api/auth/reset-password` | Validates a token issued by forgot-password |
| POST | `/api/auth/change-password` | Requires an active session + current password (distinct from reset-password's mailed-token flow) |
| GET | `/api/addresses` | |
| POST | `/api/addresses` | Server-side default-flag exclusivity |
| PUT | `/api/addresses/:id` | |
| DELETE | `/api/addresses/:id` | Auto-promotes a new default if the deleted address was one |
| POST | `/api/contact` | ~10% intentional failure rate, so the error state is reachable on a normal pass |
| POST | `/api/newsletter/subscribe` | 409 on a duplicate email |
| GET | `/api/orders/:id/tracking` | See below |

**MSW only runs in dev** (`src/mocks/index.ts` checks `import.meta.env.DEV`)
and is confirmed tree-shaken out of production by grepping `dist/` for
`setupWorker` after every build — not assumed, checked.

**Why not everything is an MSW endpoint.** Coupon validation, the cart's
shipping estimate, and checkout's delivery availability are local async
functions (`setTimeout`-simulated network delay, can fail with a real
error) rather than MSW handlers. They don't need queryable, persistent
backend *state* — a coupon code is validated, not stored; a shipping
estimate is computed, not fetched. Adding MSW surface for logic that's
genuinely stateless would be scope growth without a real architectural
payoff. Addresses, by contrast, need real CRUD with server-side state
(default-flag exclusivity spanning multiple records) — that's an MSW
endpoint. Orders are pure client-side for the same reason cart/wishlist
are: nothing external needs to persist them, and the brief never asked
for an orders API.

### The tracking endpoint's design

`GET /api/orders/:id/tracking` doesn't look up a stored order — orders
live in client-only `orderStore`, not on any "server." Instead the client
sends `placedAt`, `windowHours` (derived from the delivery method),
`destinationCity`, and (once cancelled/returned) a `frozenAt` timestamp as
query params. The handler:

1. Seeds a courier and tracking number deterministically from the order
   ID (`utils/tracking.ts`'s hash function) — refreshing the page never
   changes which courier handled an order.
2. Computes elapsed time between `placedAt` and now (or `frozenAt`), and
   derives how many of the 8 tracking stages should be complete.
3. Deterministically decides (~1 in 6 orders, same hash-seeded approach)
   whether this order is "delayed," extending the effective window.
4. Once the final stage is reached, generates a fictional proof-of-
   delivery record.

This is the same *elapsed-time-derivation* pattern used for refund status
(`utils/refund.ts`'s `deriveRefundStatus`) — rather than a real background
job or timer (which wouldn't survive a page reload in a client-only app),
state is computed fresh each time from a fixed request/event timestamp and
the current time.

## Notable decisions

**Fictional couriers, not the real ones.** Blue Dart, Delhivery, DTDC,
Ekart, and XpressBees are real, currently-operating companies with real
trademarks. `src/data/couriers.ts` uses five invented names
(SwiftPost, Cascade Express, TrailRunner Logistics, Northline Courier,
QuickHatch Delivery) in the same structural role. Consistent with this
project's approach from Phase 1 onward (declining to clone Kyari's actual
branding; swapping real social-media icons for generic ones in Phase 2).

**jsPDF is a deliberate, scoped exception to "continue using the existing
stack."** Phase 6 shipped an honestly-labeled `.txt` invoice, explicitly
declining to add a PDF library. Phase 7 asked twice, with enough detail
(GST, invoice number, branding) to read as wanting the real thing. jsPDF
is small, dependency-free, and does exactly this one job — loaded via a
dynamic `import()` inside `utils/invoice.ts`'s `downloadInvoice()`, so its
~625KB dependency tree (including `html2canvas`, pulled in by jsPDF
itself) never touches the main bundle. Verified in the production build
output, not assumed.

**No PDF-embedded QR code** — the invoice's QR placeholder is explicitly
labeled "not scannable." A real scannable QR would need a second library;
that wasn't worth adding for a decorative element on a mock invoice.

**Checkout requires login; browsing doesn't.** Rather than build a
parallel guest-checkout path, `/checkout/*` reuses `ProtectedRoute`
verbatim. This was a considered tradeoff, not an oversight: Address Book
and Order history are already account-scoped, so a coherent design either
builds guest checkout as an entirely separate flow (significant added
scope) or gates checkout behind the account system that already exists.

**Elapsed-time derivation over background timers,** used for both
delivery tracking and refund status. A client-only app with no real
backend can't run a job that ticks a status forward while nobody's
looking — and even if it could via `setInterval`, that wouldn't survive a
page reload. Deriving status fresh from `(fixed timestamp, now)` on every
read is simpler, stateless, and correct after any reload.

**Order line items snapshot price, name, and variant at add-time**
(inherited from Phase 4's cart design) — a placed order's total shouldn't
change retroactively if a product's price changes later.

## Known simplifications, documented rather than hidden

- **Guest and account carts aren't merged** on login — cart state is
  entirely local, independent of the auth store by design (see
  "Checkout requires login" above); there's no account-side cart to merge
  with.
- **Returns don't split the refund by item.** Selecting specific items in
  the return modal is recorded for display, but the refund amount is
  always the whole order's total — partial-refund math (recomputing
  tax/shipping proportionally) wasn't worth the scope for a demo return
  flow.
- **Package weight/dimensions are a formula, not real product data.**
  This catalog doesn't track physical dimensions per product, so
  `utils/packageDetails.ts` derives a plausible figure from item count.
  Display-only; never used in any cost calculation.
- **Auth sessions don't survive a reload for non-demo accounts.** The
  mock user "database" is an in-memory array that resets every reload,
  while the auth token persists in `localStorage`. `App.tsx` calls
  `refreshSession()` on load to catch this mismatch and shows an
  explanatory toast rather than failing silently. Only the seeded demo
  account (`demo@folia.example` / `folia-demo`) survives a reload.
- **Collections spanning multiple categories don't cross-filter
  products.** `Category.tsx` filters by a single `categorySlug` when one
  exists; a curated collection like "gifting" shows the full catalog
  under that collection's framing copy rather than a true cross-category
  product filter.

## Folder structure

```
src/
├── components/
│   ├── common/      # FormField, PasswordInput, Alert, Toast, Modal,
│   │                #   LoadingOverlay, Breadcrumb, PageHeader, Accordion,
│   │                #   EmptyState, PageLoader, Logo, Pagination
│   ├── layout/      # Navbar, Footer, MobileNav, MegaMenu, SearchDrawer, Layout
│   ├── ui/          # Button, Tag, Card, Container — design-system primitives
│   ├── product/     # Listing, filters, gallery, variants, reviews, cards
│   ├── cart/        # SlideCart, CartLineItem, CartSummary, CouponInput,
│   │                #   ShippingEstimator
│   ├── wishlist/    # WishlistGrid
│   ├── blog/        # BlogCard, FeaturedPost
│   ├── contact/     # ContactForm, ContactInfo
│   ├── auth/        # ProtectedRoute
│   ├── account/     # AccountLayout, AccountSidebar, AccountMobileNav,
│   │                #   AddressForm, AddressCard, accountNavItems
│   ├── checkout/    # CheckoutLayout, CheckoutStepper, DeliveryOptionCard,
│   │                #   PaymentForms
│   ├── order/       # OrderSummary, OrderRow, TrackingTimeline
│   └── forms/       # NewsletterForm
├── pages/           # Route-level components, all lazy-loaded
├── routes/          # Router config
├── hooks/           # useProducts, useCart, useWishlist, useAuth, useBlog,
│                    #   useAddresses, useOrderTracking, etc.
├── services/        # API layer — see table above
├── store/           # Zustand stores — see table above
├── utils/           # cn, pricing, currency, validation schemas, fakeJwt,
│                    #   apiError, region, tracking, refund, orderId,
│                    #   packageDetails, invoice (PDF), orderStatus
├── mocks/           # MSW handlers — see table above
├── data/            # Mock content fixtures — products, reviews, blog,
│                    #   faq, policies, users, couriers, countries,
│                    #   deliveryMethods, paymentMethods, trackingStages
└── types/           # Shared TypeScript types, one file per domain
```
