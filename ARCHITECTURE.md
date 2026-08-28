# Architecture

This documents how Folia is built: routing, state, the service layer, the
mock backend, and the decisions behind each. `README.md` covers what the
project is and how to run it; `CHANGELOG.md` covers what shipped in each
phase. This file covers *why it's built the way it is*.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router v7 ·
Framer Motion · Zustand · TanStack Query · React Hook Form + Zod · Axios ·
MSW · jsPDF and recharts (two deliberate exceptions — see Notable
Decisions) · Lucide React · Swiper · ESLint + Prettier.

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

/admin/login                    AdminLogin (public — reuses authStore.login)
── ProtectedRoute requireRole="admin" redirectTo="/admin/login" ──
  /admin                        AdminLayout
    ├─ /                        Overview
    ├─ /revenue
    ├─ /orders
    ├─ /products
    ├─ /customers
    └─ /search

/*                              404
```

Every route component is `lazy()`-loaded. `/checkout/*` reuses the exact
same `ProtectedRoute` as `/account/*` — a guest gets redirected to login
with a return path, not a separate guest-checkout implementation. Browsing,
cart, and wishlist stay fully guest-accessible; only placing an order and
the account dashboard require a session. `/admin/*` reuses the same
`ProtectedRoute` component with two added props (`requireRole`,
`redirectTo`) rather than a second route-guard component — a logged-in
customer without the admin role is redirected to `/admin/login`, same as
a logged-out visitor.

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
| `themeStore` | Yes (mode only) | Light/dark/system preference. Live `systemPrefersDark` tracked separately, never persisted, so "System" always reflects the actual current OS setting. |
| `searchStore` | Yes | Recent searches (max 10, deduplicated) and search analytics events — both feed the admin Search Analytics page directly, not just a hypothetical future one. |
| `toastStore` | No | Ephemeral toast queue. |
| `uiStore` | No | Cross-tree ephemeral UI state — slide-cart drawer and search overlay open/closed, letting components in different route-tree branches (e.g. `ProductDetail` and `Navbar`) coordinate a shared drawer without prop-drilling. |

**No dedicated admin store.** The admin dashboard reads from the stores
above (`orderStore`, `wishlistStore`, `recentlyViewedStore`,
`searchStore`) via `hooks/useAdminAnalytics.ts` — every number on every
admin page is *derived*, computed fresh from existing state plus the
deterministic mock baseline described under "Analytics & Admin
Dashboard" below, never stored redundantly in a parallel structure.

**The `hasHydrated` pattern**, used by every persisted store except the
three intentionally-ephemeral ones (`checkoutStore`, `toastStore`,
`uiStore`): Zustand's `persist` middleware resolves asynchronously even
for synchronous storage like `localStorage` (at least one microtask).
Without a `hasHydrated` flag, gated in the UI, a page reload would flash
the *default* empty state (cart badge "0", "not logged in", "System" theme
highlighted instead of a saved "Dark") for one tick before the real
persisted data loads. Every persisted store implements this identically: a
boolean field, an `onRehydrateStorage` callback that flips it, and
consumers check it before rendering anything derived from persisted state.
`themeStore` was the last holdout to get this (caught during Phase 8's
regression pass) — all 10 persisted stores now implement it consistently.

## Service layer — src/services/

One file per domain, each wrapping Axios calls to `/api/*` (routed to MSW
in dev, tree-shaken out of production entirely — see Mock backend below).

| Service | Backs |
|---|---|
| `apiClient.ts` | Shared Axios instance (`baseURL: '/api'`) |
| `productService.ts` | Product listing/detail |
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

## Dark mode

Implemented via CSS variables under a `.dark` class selector
(`@custom-variant dark (&:where(.dark, .dark *))` in `index.css`), not
`dark:` utility prefixes scattered across components — Tailwind v4
utilities reference CSS variables at runtime rather than baking in hex
values, so overriding a variable's value under `.dark` re-colors every
existing usage of that utility automatically.

**The one token that couldn't just invert**: `pine` is used both as
heading *text* (would need to become light in dark mode) and brand *fill*
for buttons/hero/footer/tags (needs to stay dark green in both modes,
since those blocks pair it with light text). Resolved with a second,
independent token — `--color-heading` — requiring a single scripted
rename of `text-pine` → `text-heading` at its call sites, rather than
maintaining two colors that happened to share a value in light mode only
by coincidence.

- `themeStore.ts` + `useThemeSync.ts` (mounted once at `App` root): persisted
  mode, live system-preference tracking via `matchMedia`, applies
  `.dark` to `document.documentElement`.
- FOIT/FOUT prevention is a synchronous inline script in `index.html`,
  reading the same localStorage key the store persists to — this has to
  happen before React mounts, since `useEffect`-based theme application
  runs after first paint.
- `stone`/`ink` (backgrounds, surfaces, borders, body text) invert
  cleanly — each plays exactly one role. `pine`/`fern`/`ochre`/`rust`
  mostly stay close to their light-mode values (used as fill+contrasting-
  text pairs that would break if inverted), with a few brightened for
  legibility as isolated text/icons against a dark background.
- Shadows switch from pine-tinted low-opacity (light mode) to
  higher-opacity black (dark mode) — a shadow tinted the same color as an
  already-dark background does nothing useful.

## Search algorithm & recommendation engine

Both built on the same underlying signal: what a person has wishlisted,
recently viewed, purchased, and searched for (`hooks/useUserSignals.ts`,
one extraction point, not recomputed separately by each consumer) — but
they solve different problems with deliberately separate scoring
functions (see "Notable decisions" below for why they aren't unified into
one).

### Search algorithm

`components/layout/SearchOverlay.tsx` (thin, always-mounted, owns the
global ⌘K/Ctrl+K listener) plus the `React.lazy`-loaded
`SearchOverlayContent.tsx` for the actual UI. Product matching reuses the
*existing* MSW-backed `useProducts` hook rather than re-implementing
filtering client-side — the debounced query is sent to
`GET /api/products?search=`, and only the already-matched results are
then ranked.

Ranking (`utils/searchRanking.ts`'s `scoreProduct`) is additive point
scoring, highest wins, ties broken by product ID for full determinism:

| Signal | Points |
|---|---|
| Exact name match | 10,000 |
| Prefix name match | 5,000 |
| Category name matches the query | 800 |
| Bestseller badge | 400 |
| Purchased before (this session's order history) | 350 |
| Recently viewed | 300 |
| Wishlisted | 300 |
| Trending (top of the homepage's trending list) | 200 |
| Rating | rating × 20 (max 100) |

Categories, collections, and blog posts are ranked separately
(`utils/textMatch.ts`'s `sortByRelevance`) with a simpler exact >
prefix > contains ordering — these datasets are small enough (a handful
of categories, ~10 blog posts) that the full multi-signal product
algorithm would be overkill. `findDidYouMean` runs only when a query
returns zero results, using real Levenshtein edit distance (threshold
scaled to query length: 1 for ≤5 characters, 2 for longer) against every
product/category/collection name — verified against hand-checked test
cases before being trusted, not assumed correct.

### Recommendation engine

`utils/recommendations.ts` — five pure functions, all deterministic
(seeded by product ID via the same `hashOrderId` hash used for courier
assignment, or by the person's actual accumulated signals; never
`Math.random()`):

- **`getFrequentlyBoughtTogether`** — a fixed complementary-category chain
  (`{ plants: [vessels, tools], vessels: [plants, tools], tools: [plants, vessels] }`),
  seeded pick within the matching category so the same product always
  recommends the same complement.
- **`getSimilarProducts`** — category match (500 pts) + price proximity
  (up to 200 pts, linearly decaying) + care-level match (100 pts) +
  rating (×10). The closest honest proxies this catalog has for
  "tags, color, size," which aren't real fields in its schema.
- **`getCustomersAlsoViewed`** — explicitly mocked (no real cross-customer
  data exists behind it), a deterministic pseudo-shuffle seeded by
  `productId::candidateId` pairs.
- **`getCartComplements`** — `getFrequentlyBoughtTogether` applied to
  every item currently in the cart, deduplicated, excluding items already
  present.
- **`getPersonalizedRecommendations`** — favorite categories derived from
  weighted signal frequency (purchases ×4, wishlist ×3, recently-viewed
  ×2), boosted by recent-search-term matches (+300) and bestseller status
  (+150). Falls back to bestsellers entirely for signal-less guests.

Four sections consume these, all reusing the existing `ProductCarousel`/
`SectionHeading` components: Home's "Recommended for You," Product
Detail's "Similar Products"/"Frequently Bought Together"/"Customers Also
Viewed," Cart's "Complete Your Setup," Dashboard's "Picks for You."

## Analytics & Admin Dashboard

`/admin/*`, gated by `ProtectedRoute requireRole="admin"`. No dedicated
Zustand store — every number is derived, computed by
`hooks/useAdminAnalytics.ts` from the existing customer-facing stores
plus a deterministic mock baseline.

### The honesty problem this section exists to solve

This is a client-only app: one browser, one `localStorage`, one real
customer. Metrics like "Total Customers" or "Customer Lifetime Value" are
inherently multi-customer and cannot be honestly computed from that
alone. Rather than hardcode plausible-looking numbers, `data/mockPlatformHistory.ts`
generates a deterministic ~90-day baseline (~140 mock customers, weighted
order-status distribution, mild weekend/trend variation, cross-referencing
the real product catalog) using a seeded PRNG
(`utils/seededRandom.ts` — mulberry32, seeded via the existing
`hashOrderId` hash, verified for determinism/distribution/seed-sensitivity
in isolation before being trusted). `utils/analytics.ts`'s
`getUnifiedOrders` is the one join point every metric goes through,
merging this baseline with real live orders from `orderStore` — **a real
order placed in the demo genuinely moves every chart derived from
orders**, not just the mock baseline sitting inertly underneath it.

What's genuinely 100% real, no baseline involved: the search
click-through rate and no-result-search list (both computed directly from
real logged `SearchAnalyticsEvent`s in `searchStore`), and the
"Frequently Bought Together" *analytics* table on the Products page
(real product co-occurrence counted across the combined order history —
distinct from, and a genuine complement to, the recommendation engine's
fixed category-chain logic above).

### Widget library (`components/admin/`)

`StatCard`, `MetricCard` (includes a real period-over-period trend — this
window's revenue vs. the equal-length window immediately before it),
`LineChartWidget`, `AreaChartWidget`, `BarChartWidget`, `PieChartWidget`,
`TableWidget`, `ActivityFeed`. Charts are theme-aware by construction:
colors are passed as literal `"var(--color-fern)"` strings directly into
recharts' `stroke`/`fill` props, so toggling `.dark` re-colors every
chart instantly through the same CSS-variable mechanism the rest of the
app's theming relies on — no JS re-render or re-coloring logic needed.
Every chart carries `role="img"` with a real `aria-label` description as
a screen-reader text alternative. Chart mount/update animation is gated
by a live `usePrefersReducedMotion` hook — recharts animates via its own
internal `requestAnimationFrame` logic, not CSS, so the app's existing
global reduced-motion CSS override (which only catches CSS
transitions/animations) has no effect on it; this needed a separate,
explicit fix.

### Six pages

Overview, Revenue (daily/weekly/monthly/yearly, gross/net/discounts/
shipping), Orders (per-day volume, status breakdown, delivery/
cancellation/return rates), Products (best/worst sellers, most-viewed/
wishlisted/returned, frequently-bought-together pairs), Customers,
Search — each with a date-range filter and a CSV export button that
genuinely downloads the visible data (`Blob`/`URL.createObjectURL`
client-side, no fake "export started" toast with nothing behind it).

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

**One CSS token can't serve two incompatible roles, so `pine`/`heading`
were split rather than compromised.** Covered in detail under "Dark mode"
above — noted here too since it's the kind of decision that determines
whether a feature request touches 5 files or 50, and it's worth being
able to find from either section.

**Recommendation scoring and search scoring are deliberately separate
functions, not one function serving both.** `scoreProduct` (search) needs
a typed query to score exact/prefix matches against; recommendations have
no query, only accumulated signals. Sharing the small pieces that
actually overlap (`getMatchQuality`, `UserSignals`, `hashOrderId`) while
keeping the two scoring functions themselves separate avoided forcing an
awkward "optional query" parameter into logic that's conceptually
different, just to technically reuse one function.

**recharts is a second deliberate, scoped exception to "continue using
the existing stack,"** for the same reason jsPDF was: a real analytics
dashboard needs a real charting library, and building one from scratch
would be far more code than adopting a well-established one. Chart colors
are passed as literal CSS-variable strings rather than resolved hex
values, so theming stays entirely CSS-driven — consistent with how the
rest of the app's dark mode works, rather than introducing a second,
JS-based re-coloring mechanism just for charts.

**Admin is a role on the same `User` type, not a parallel account
system.** A `role?: 'customer' | 'admin'` field and one extended
`ProtectedRoute` prop were enough — building a separate admin
authentication stack would have duplicated the entire session/token/
hydration machinery `authStore` already handles correctly.

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
- **"Frequently Bought Together" doesn't have the exact category chain
  the feature was specified with.** This catalog has 3 categories
  (Plants/Vessels/Tools), not literal Fertilizer/Plant Food/Decorative
  Pebbles products — `utils/recommendations.ts` applies the same
  complementary-category *pattern* (a plant needs a vessel and care
  tools) to what actually exists in the catalog.
- **"Similar Products" doesn't score by tags, color, or size**, because
  this catalog doesn't track those as real product fields. It uses
  category, price proximity, and care-level as the closest honest
  proxies — not invented data pretending to be real attributes.
- **"Customers Also Viewed" has no real cross-customer behavioral data
  behind it** — there's no backend tracking what other people viewed. It's
  a deterministic pseudo-selection seeded by product ID, documented as a
  mock in the code rather than presented as if it were real.
- **The admin dashboard's customer-count metrics (Total/Active/New/
  Returning Customers, Lifetime Value) are a deterministic mock baseline
  combined with this session's real data**, not real multi-tenant
  analytics — this client-only app has exactly one real customer per
  browser. Every chart genuinely responds to real orders placed in the
  demo (see "Analytics & Admin Dashboard" above), but the underlying
  ~140-customer baseline is synthetic, seeded, and documented as such in
  both the code and this file, not silently presented as live data.

## Folder structure

```
src/
├── components/
│   ├── common/      # FormField, PasswordInput, Alert, Toast, Modal,
│   │                #   LoadingOverlay, Breadcrumb, PageHeader, Accordion,
│   │                #   EmptyState, PageLoader, Logo, Pagination,
│   │                #   ThemeToggle, HighlightText
│   ├── layout/      # Navbar, Footer, MobileNav, MegaMenu, SearchOverlay,
│   │                #   SearchOverlayContent, Layout
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
│   ├── home/        # BestSellers, TrendingProducts, RecommendedForYou,
│   │                #   FeaturedCollections, Benefits, Testimonials,
│   │                #   PromoBanners, BlogPreview
│   ├── admin/       # AdminLayout, AdminSidebar, AdminMobileNav,
│   │                #   StatCard, MetricCard, TableWidget, ActivityFeed,
│   │                #   DateRangeFilter, ExportButton, charts/ (Line,
│   │                #   Area, Bar, Pie widgets)
│   └── forms/       # NewsletterForm
├── pages/           # Route-level components, all lazy-loaded
├── routes/          # Router config
├── hooks/           # useProducts, useCart, useWishlist, useAuth, useBlog,
│                    #   useAddresses, useOrderTracking, useUserSignals,
│                    #   useSearchResults, useRecommendations, useThemeSync,
│                    #   useFocusTrap, useAdminAnalytics,
│                    #   usePrefersReducedMotion, etc.
├── services/        # API layer — see table above
├── store/           # Zustand stores — see table above
├── utils/           # cn, pricing, currency, validation schemas, fakeJwt,
│                    #   apiError, region, tracking, refund, orderId,
│                    #   packageDetails, invoice (PDF), orderStatus,
│                    #   textMatch, searchRanking, recommendations,
│                    #   seededRandom, analytics
├── mocks/           # MSW handlers — see table above
├── data/            # Mock content fixtures — products, reviews, blog,
│                    #   faq, policies, users, couriers, countries,
│                    #   deliveryMethods, paymentMethods, trackingStages,
│                    #   trendingSearches, mockPlatformHistory
└── types/           # Shared TypeScript types, one file per domain
```
