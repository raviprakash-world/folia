# Changelog

All notable changes to Folia, phase by phase. See `README.md` for what the
project is and how to run it, and `ARCHITECTURE.md` for how it's built.

## Phase 5 — Static Pages, Forms & Mock Authentication

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

## Phase 6 — Customer Account, Address Management & Checkout

**Account dashboard** replaces Phase 5's placeholder: `AccountLayout`
(desktop sidebar, mobile pill nav, breadcrumbs, animated route
transitions) wraps Overview (real stats from actual stores, not fake
numbers), My Profile (edit name/email), Address Book, Orders, Settings,
Security, and Notifications. Wishlist stays a link out to its existing
top-level page rather than being duplicated inside the dashboard shell.

**Address Book**: full CRUD exactly per spec —
`GET/POST/PUT/DELETE /api/addresses`, `Address` model matching the given
interface field-for-field (plus a `label` nickname field, since the
feature list explicitly asked for one beyond the literal interface).
Default shipping/billing exclusivity enforced server-side. Search, PIN/
postal-code validation (country-aware, 5 countries), and a mock delivery-
availability check are all real, working features — not stubs.

**Checkout flow**: Cart → Shipping → Delivery → Payment → Review →
Confirmation, each step with back navigation, validation, loading state,
and error state, plus a persistent progress stepper. Delivery offers
Standard/Express/Same-Day/Pickup with real cost/eta, gated by a mock
per-address availability check. Payment supports Credit Card, Debit Card,
UPI, Net Banking, Wallet, and Cash on Delivery, including saved (mock)
cards, real client-side validation, and a genuinely reachable decline/retry
path — not just success. Order IDs are realistic (`FOL-YYYYMMDD-####`).

**Order placement & confirmation**: a full `Order` object (items, every
cost line, both addresses, delivery method, payment summary) is persisted
on placement. The confirmation page has a real spring-animated success
state, reuses `OrderSummary` and the existing `ShareButtons` component
as-is, and offers a real JSON-backed mock invoice download.

**Reused, not duplicated**: `AddressCard`/`AddressForm` (address book +
checkout's address step), `Modal` (address delete confirm — same pattern
as Phase 5's logout confirm), `OrderSummary` (Review preview, Confirmation,
Order Detail — one component, three call sites), the extracted
`isFarRegion` heuristic (cart's shipping estimate + checkout's delivery
availability), `resetPasswordSchema`'s base fields (extracted into a
shared `passwordFieldsSchema` so the new authenticated change-password
flow doesn't duplicate the password-strength rule — fixed a first draft
that reached into zod internals to avoid this duplication, which was the
wrong way to reuse it).

**Real bugs caught and fixed properly, not routed around**:
- `AccountSidebar.tsx` exported a non-component constant alongside its
  component, tripping `react-refresh` — fixed by extracting
  `accountNavItems` to its own file, the same fix pattern as every prior
  phase's version of this issue.
- `AddressForm.tsx`'s use of React Hook Form's `watch()` tripped a React
  Compiler memoization warning — fixed with RHF's `useWatch` hook, the
  correct API for this, after confirming no other file in the codebase
  had the same pattern needing the same fix.
- `CheckoutDelivery.tsx` called `setState` synchronously inside a
  `useEffect` body (same rule Phase 2's `SearchDrawer` fix caught) —
  restructured to derive `loading`/`error`/`availability` from a single
  result object keyed by postal code, which also fixed a latent race
  condition (a slow response for an old address could no longer overwrite
  a newer one).
- Two hooks (`useDefaultShippingAddress`, `useDefaultBillingAddress`) were
  built but never called anywhere — the same "wired but not connected"
  pattern Phase 5 caught with `fetchCurrentUser`. Fixed by using them in
  `CheckoutShipping.tsx` to replace inline duplicate default-lookup logic,
  not by deleting them.

**Verification**: `npx tsc -b`, `eslint . --max-warnings 0`, and
`npm run build` all pass clean throughout — checkpointed after every
major batch of work, not just once at the end. Re-ran Phase 5's full
dead-code checklist (`TODO`/`FIXME`, `console.log`, `@ts-ignore`/
`@ts-expect-error`, real `any` usage, full export-reference scan) against
the entire codebase, not just the new files. Confirmed explicitly that
guest shopping remains fully independent of the new auth-gated checkout
(cart/wishlist stores have zero imports from the auth domain) and that
the main JS bundle (464KB) stays under Vite's warning threshold despite
the scope added this phase.

## Phase 7 — Orders, Tracking & Customer Experience

**Delivery tracking**, the showcase feature: `TrackingTimeline`
(`src/components/order/TrackingTimeline.tsx`) renders an animated progress
bar, an 8-stage visual timeline (Order Placed → Payment Confirmed → Packed
→ Picked Up → Shipped → In Transit → Out For Delivery → Delivered) with a
timestamp per completed milestone, a fictional courier card (name, tracking
number, support phone/email), the estimated delivery window, current
location, package weight/dimensions, delivery instructions pulled from the
shipping address, an occasional deterministic delay banner, a proof-of-
delivery placeholder once delivered, and a shipment-history log — all
backed by a real `GET /api/orders/:id/tracking` MSW endpoint that computes
stage progress from actual elapsed time rather than random or hard-coded
data. Embedded directly in `AccountOrderDetail` rather than a separate
route, since that page already needed to show tracking per its own
requirements — no reason to split it across two pages.

**Order Details is fully functional**: Download Invoice (now a real PDF —
see below), Reorder (adds items to cart, goes to checkout), Buy Again
(adds to cart, stays put), Cancel Order (reason + note, only offered while
an order is actually cancellable), Return Order (per-item selection +
reason + note, only offered within the return window on delivered orders),
Contact Support (prefills the Contact page with the order number via
router state), editable customer notes, and the full tracking timeline —
all on one page, none of it a placeholder.

**Orders Listing**: search (by order number or item name), sort (date or
total, either direction), status filter tabs (All/Active/Delivered/
Cancelled/Returned/Refunded), pagination, loading and empty states.

**Address Book extended**: company name, alternate phone, delivery
instructions, preferred delivery time slot, a geolocation placeholder
(explicitly mock — no real browser permission is ever requested), and
real rule-based validation warnings computed live from the entered fields
(PO Box detection, a missing-landmark nudge) — not random, not
network-validated, just structural advice a reviewer can verify by reading
the rule.

**Notification center**: a real feed (not just the Phase 6 preference
toggles, which stay on the same page rather than forking into a second
confusingly-named "notifications" page) — six types (Order, Shipping,
Promotion, Wishlist, Account, Security), mark-as-read, mark-all-read,
archive, delete, per-type filtering, and a Navbar bell with an unread
badge using the exact pattern already established by the cart/wishlist
icons. Real events (order placed, payment successful, order cancelled,
return requested, password changed, profile updated) all fire genuine
notifications; a couple of illustrative examples are seeded once for types
this mock catalog has no live trigger for (price drops, promotions).

**Dashboard expanded**: total/active/delivered order counts, wishlist
count, saved-address count, total savings (sum of order discounts), mock
reward points (1 point per dollar spent — documented as a simple mock, no
real loyalty backend), and a recently-viewed products section.

**Recently Viewed**: a dedicated store (`recentlyViewedStore.ts`),
persisted, capped at 20 entries, automatic de-duplication (re-viewing a
product moves it to the front instead of creating a second entry),
most-recent-first, with a "Clear history" action on the dashboard. Wired
into `ProductDetail.tsx` with a `useEffect` that records a view once
product data loads.

**Profile**: phone and a mock avatar upload (`FileReader`-based, capped at
2MB, stored as a data URL — never a real server-hosted image) added
end-to-end (type → MSW handler → service → store → UI), with the avatar
now showing in the Navbar's account icon.

**Invoice generation upgraded to a real PDF.** Phase 6 shipped an
honestly-labeled `.txt` mock invoice, explicitly declining to add a PDF
library at the time. Phase 7 asked twice, with enough detail (GST,
invoice number, company branding) to read as wanting the real thing — so
`jsPDF` was added as a deliberate, scoped, explained exception to
"continue using the existing stack" (see ARCHITECTURE.md's Notable
Decisions). Company branding, invoice number, order number, customer/
shipping/billing details, itemized costs, tax summary, payment summary, a
QR placeholder (explicitly labeled not scannable — no real QR-generation
library was added for this), and a support-contact footer. Loaded via a
dynamic `import()` so jsPDF's dependency tree (~625KB, including
`html2canvas` and `purify.es`) never touches the main bundle — confirmed
by checking the production build output, not just assumed.

**Returns & cancellation**: cancel (with reason), return (per-item
selection + reason), and a refund-status simulation that mirrors the
tracking feature's approach — status is derived from real elapsed time
since the request (a short 3-minute processing window, so the
processing → refunded transition is actually observable in a demo
session) rather than a background timer that wouldn't survive a page
reload. Cash-on-delivery cancellations correctly show no refund at all,
since nothing was ever charged.

**Fictional couriers, not the real ones the brief named.** Blue Dart,
Delhivery, DTDC, Ekart, and XpressBees are real, currently-operating
logistics companies with real trademarks. Five fictional couriers
(SwiftPost, Cascade Express, TrailRunner Logistics, Northline Courier,
QuickHatch Delivery) fill the same structural role — consistent with this
project's approach throughout (Phase 1's original brand-cloning refusal,
Phase 2's swap of real social icons for generic ones).

**Real bugs caught and fixed properly, not routed around**:
- `OrderItem` was missing `variantId` (only the display label was
  stored) — would have silently broken Reorder/Buy Again for any variant
  product, since the cart needs a variant ID to build its line-item key.
  Added the field and updated the one place that constructs `OrderItem`s.
- `order.createdAt` was being truncated to a bare date
  (`YYYY-MM-DD`) with no time component — harmless for display, but it
  would have broken the tracking simulation's elapsed-hours math for
  short delivery windows (Store Pickup's 2-hour window would look wildly
  wrong, since every order would appear to have been placed at midnight
  regardless of actual time). Fixed to store a full ISO timestamp, with a
  new `formatDate` display helper so nothing shows a raw timestamp.
- Courier/tracking-number assignment is seeded by order ID — originally
  the ID was generated at submit time, meaning the Review step's preview
  could show a *different* courier than what actually got placed. Fixed
  by generating the order ID once at Review-step mount.
- `statusTone` (the order-status-to-badge-color mapping) was duplicated
  verbatim in two files; extracted to `utils/orderStatus.ts` before
  finishing the type extension that touched both call sites.
- Found `preferencesStore` was the only persisted store in the entire app
  *not* implementing the `hasHydrated` gating pattern every other
  persisted store uses — caught during the Phase 7 regression pass, not
  reported by any test. Fixed for consistency; the notification-
  preferences page now shows a loading skeleton instead of momentarily
  flashing default toggle states before the real ones load.
- A `jsPDF` color-setting call broke TypeScript's tuple-spread inference
  when the color was chosen via a ternary — fixed by destructuring
  instead of spreading, not by loosening a type.

**Regression testing**: a systematic pass across all 7 phases before
packaging, not just the new work — confirmed guest shopping remains fully
independent of auth (grepped for any auth import in cart/wishlist —
none), `ProtectedRoute` still scopes to exactly `/account` and
`/checkout`, all 31 route components are lazy-loaded, and Phase 1's
design tokens, Phase 3's MSW product handlers, and Phase 4's pricing math
and persistence config are all untouched.

**Verification**: `npx tsc -b`, `eslint . --max-warnings 0`, and
`npm run build` all pass clean, checkpointed after every major batch of
work rather than once at the end. `npm run preview` was actually started
and 8 routes (including a dynamic product-detail route) were checked for
a real HTTP 200 through the production build's SPA routing — not assumed
to work from the dev server behaving correctly. Full dead-export scan
across the entire `src/` tree: every unreferenced export found is a
self-documenting domain type used within its own file (zero runtime
cost); nothing genuinely orphaned remains. Bundle impact of this phase's
largest addition (jsPDF) confirmed via the actual build output: main
chunk 465.78KB, up only ~1.5KB from 464.22KB before jsPDF was added —
everything else it pulls in is lazy.

## Phase 8 — Premium User Experience (Dark Mode, Advanced Search, Recommendation Engine)

### Dark mode

Full light/dark/system theming, implemented via CSS variables rather than
`dark:` utility prefixes scattered across components — meaning most of the
app required **zero component changes** to support both themes.

The one hard problem: `pine` (the brand color) plays two incompatible
roles — heading *text* (needs to invert to light in dark mode, since dark
green on a dark background is unreadable) and brand *fill* for buttons/
hero/footer/tags (needs to stay dark green in both modes, since those
blocks pair it with light text and would break if it inverted). Resolved
with one new token, `--color-heading`, independent of `pine`, requiring a
single scripted rename of `text-pine` → `text-heading` at its 53 call
sites — verified zero false-positive collision risk before running it
(confirmed `pine-light` is never used as text, only as a `bg-` hover
state), and confirmed afterward that all 20 `bg-pine` brand-fill usages
were untouched. Everything else (the `stone`/`ink` families — page
backgrounds, card surfaces, borders, body text) inverts automatically via
`.dark` CSS variable overrides, since Tailwind v4 utilities reference
variables at runtime rather than baking in hex values.

- **`themeStore.ts`**: persisted `mode` (light/dark/system); live
  `systemPrefersDark` tracked separately, never persisted, so "System"
  always reflects the actual current OS setting rather than a stale
  snapshot from whenever the preference was last saved.
- **`useThemeSync.ts`**: applies the resolved theme to `<html class="dark">`
  and listens for live `prefers-color-scheme` changes — "System" mode
  updates immediately if the OS setting changes, no reload needed.
  Mounted once, at `App` root.
- **FOIT/FOUT prevention**: a synchronous inline script in `index.html`'s
  `<head>`, reading the same `folia-theme` localStorage key the store
  persists to, sets the `.dark` class before first paint — React's
  `useEffect`-based theme application runs after paint, too late to avoid
  a flash on a slow device.
- **`ThemeToggle.tsx`**: one component, two renderings (compact icon-only
  for the Navbar, labeled for Account Settings) — same store, not two
  implementations.
- **Theme-aware shadows**: dark-mode shadow variables switch from
  pine-tinted low-opacity to higher-opacity black, since a shadow based on
  a dark color is nearly invisible against an already-dark background.
- **Two requirements didn't map onto this app, flagged rather than faked**:
  no code blocks exist anywhere (this is a storefront, not a docs site),
  and no real photographic images exist (a Phase 1 decision — every
  "photo" is a `bg-stone-dark` placeholder, which inverts automatically
  along with every other surface token).

### Advanced Search

Replaced the Phase 2 `SearchDrawer` (a dropdown that locally filtered a
hardcoded product subset, and whose "recent searches" were never actually
persisted despite looking like it) with a full command-palette overlay.

- **`SearchOverlay.tsx`** (thin, always-mounted — owns the global ⌘K/
  Ctrl+K listener) + **`SearchOverlayContent.tsx`** (the actual heavy UI,
  `React.lazy`-loaded so its ~12KB plus the ranking/matching logic it
  pulls in never touches the main bundle until someone actually opens
  search). Full-screen, backdrop blur, Framer Motion animation.
- **`useFocusTrap.ts`**: extracted from `Modal.tsx`'s existing inline
  focus-trap implementation, since the overlay needed the identical
  Tab-cycling/Escape/focus-restoration behavior and writing it a second
  time would have been exactly the duplicate logic this phase's
  instructions explicitly ruled out. `Modal` now uses the same hook.
- **`searchStore.ts`**: persisted recent searches (max 10, deduplicated,
  most-recent-first) — a real fix, not just a rewrite, since Phase 2's
  version was never actually persisted. Also logs search analytics events
  (query, result count, clicked result) for a future admin dashboard that
  doesn't exist yet in this app — the capture point is real, documented
  as forward-looking infrastructure rather than oversold as a finished
  dashboard.
- **`trendingSearches.ts`**: deterministic date-based rotation (a fixed
  pool, sliced by day-of-year ÷ rotation period) — never `Math.random()`.
- **`textMatch.ts`**: highlight-range splitting (reused by `HighlightText.tsx`
  across every suggestion type), relevance scoring for the smaller
  category/collection/blog datasets, and a real Levenshtein-distance
  "did you mean" — verified against known test cases before trusting it.
- **`searchRanking.ts`**: the explicitly-required reusable ranking
  utility — a pure function (`scoreProduct`/`rankProducts`), no UI
  component embeds this logic. Scores exact/prefix match, category
  relevance, bestseller status, recently-viewed/wishlist/purchase-
  history/trending signals, and rating.
- **`useSearchResults.ts`**: composes the debounced query with the
  *existing* MSW-backed `useProducts` hook (extended with a minimal,
  backward-compatible `enabled` option, not a parallel hook) plus static
  category/collection/blog matching — reuses established data sources
  rather than re-fetching or re-filtering independently.
- Full keyboard navigation (Arrow Up/Down/Enter/Escape/Tab), a premium
  zero-results state (did-you-mean, trending fallback, popular
  categories, continue-browsing action), loading skeletons, and result
  counts.

### Recommendation Engine

- **`useUserSignals.ts`**: extracted shared signal-gathering (wishlist,
  recently-viewed, purchase history, search history) so `useSearchResults`
  and the new recommendation hooks compute the same signals once, not
  twice. While extracting it, found and fixed a real memoization bug: the
  original code mapped over store arrays *inside* the Zustand selector
  itself, which creates a new array reference every render regardless of
  whether the underlying data changed — quietly undermining "memoized
  ranking," one of this phase's explicit requirements. Fixed by selecting
  the raw stable array first, deriving via `useMemo` second.
- **`recommendations.ts`**: the deterministic engine —
  `getFrequentlyBoughtTogether` (category-chain, seeded pick),
  `getSimilarProducts` (category + price proximity + care-level + rating),
  `getCustomersAlsoViewed` (honestly mocked — no real cross-customer data
  exists behind it, documented as such), `getCartComplements`,
  `getPersonalizedRecommendations` (weighted category frequency from
  wishlist/recently-viewed/purchases, boosted by search-history matches,
  falls back to bestsellers for signal-less guests). Every function is
  pure and seeded by product ID or actual persisted signals — no
  `Math.random()` anywhere in the chain, so results are stable across
  reloads for the same account state.
- **Two gaps in the brief that don't map onto this catalog, documented
  rather than hidden**: this catalog has 3 categories (Plants/Vessels/
  Tools), not the brief's literal Fertilizer/Plant Food/Decorative
  Pebbles chain — the same complementary-category *pattern* is applied to
  what actually exists. Similarly, "tags, color, size" aren't real fields
  in this catalog's schema — `getSimilarProducts` uses category, price
  proximity, and care-level as the closest honest proxies.
- **Four sections wired**, all reusing the existing `ProductCarousel`/
  `SectionHeading` components (zero new UI primitives): Home's
  "Recommended for You," Product Detail's three-way split ("Similar
  Products" / "Frequently Bought Together" / "Customers Also Viewed"),
  Cart's "Complete Your Setup," Dashboard's "Picks for You."
- **Real cleanup, not orphaned code**: replacing Product Detail's old
  MSW-fetched "You might also like" section (same-category-only, Phase 3)
  with the richer client-side `getSimilarProducts` made `useRelatedProducts`,
  `fetchRelatedProducts`, and their MSW handler genuinely dead — confirmed
  via grep for zero remaining call sites before removing all three,
  consistent with the no-dead-code discipline maintained since Phase 5.

### Bugs caught and fixed during this phase's regression passes

- The same `react-hooks/set-state-in-effect` issue hit for a third time
  in this project (Phase 2's `SearchDrawer`, Phase 7's `CheckoutDelivery`,
  now `SearchOverlayContent`'s active-index reset) — fixed this time using
  React's own documented "adjust state during render" pattern (compare
  against a previous value stored in state, `setState` conditionally
  during render) rather than an effect, which avoids the extra
  effect-triggered render pass entirely.
- Found `themeStore` was the only persisted store in the entire app *not*
  implementing the `hasHydrated` gating pattern every other store uses —
  the same class of bug caught in `preferencesStore` during Phase 7's
  regression pass. The actual page theme was already protected by the
  inline anti-flash script, but `ThemeToggle`'s active-button state could
  have flashed "System" before flipping to a saved "Dark" preference.
  Fixed for consistency; all 10 persisted stores in the app now implement
  the pattern identically.
- The dead-export scan caught `recentSearchesSeed` (orphaned once the old
  `SearchDrawer` was deleted) and a docstring on `scoreProduct` that
  overclaimed a reuse that didn't actually materialize (recommendation
  scoring has no text query to match against, so `recommendations.ts`
  ended up with its own scoring functions instead). Caught my own first
  correction of that docstring being itself slightly wrong — it
  misattributed which file a shared type lived in — by checking the
  actual imports before finalizing the fix rather than trusting the first
  pass.

### Verification

`npx tsc -b`, `eslint . --max-warnings 0`, `npm run build`, and
`npm run preview` all checkpointed after every major sub-phase (dark
mode, then search, then recommendations), not once at the end. 15 routes
across every phase confirmed HTTP 200 through the production preview
build after each checkpoint. Bundle impact tracked precisely at every
step: dark mode added 2.47KB to the main chunk; search added 0.61KB
(`SearchOverlayContent` correctly isolated into its own lazy chunk,
confirmed in the build output); the recommendation engine moved the main
chunk by roughly 60 bytes. No chunk-size warning at any checkpoint.

## Phase 9 — Admin Analytics Dashboard

**A real bug fix before this phase started**: `SearchOverlayContent.tsx`
had a Zustand selector calling `.map()` inline
(`useRecentlyViewedStore((s) => s.items.map(...))`), returning a brand-new
array reference on every single call. Zustand's `useStore` is built on
React's `useSyncExternalStore`, which calls the selector multiple times
per render to detect concurrent-mode tearing — when the selector always
returns "something different," React concludes the snapshot changed and
re-renders to reconcile, which calls the selector again, forever. This is
a well-documented Zustand/`useSyncExternalStore` failure mode, and a more
severe version of a pattern already partially fixed earlier this project
(`useUserSignals.ts`) — that earlier fix was described as a memoization
optimization, which undersold it; it's a correctness bug, not just wasted
computation. Grepped the entire codebase for the same anti-pattern before
calling it fixed; this was the only remaining instance.

### Admin authentication

Extends the *existing* `User`/`SeedUser` types with an optional `role`
field rather than building a parallel user system — a seeded demo admin
account (`admin@folia.example` / `folia-admin`) is just another row in
the same mock user list. `ProtectedRoute` gained an optional `requireRole`
prop and configurable `redirectTo`, reused for both `/account/*` and
`/admin/*` rather than a second route-guard component.
`AdminLogin.tsx` reuses the exact same `authStore.login` action and
`loginSchema` as customer login — a real customer account can
authenticate there, but is immediately signed back out with an
explanation rather than left in a confusing half-logged-in state on the
admin screen.

### The mock data problem, and how it's handled honestly

This app has no real backend — one browser, one `localStorage`, one
customer. Several requested metrics (Total/Active/New/Returning
Customers, Customer Lifetime Value, Most Viewed, Most Wishlisted) are
inherently *multi-customer* and can't be honestly derived from a single
session. Rather than hardcode fabricated numbers, `utils/seededRandom.ts`
(a deterministic mulberry32 PRNG, seeded via the existing `hashOrderId`
hash rather than reimplementing string-hashing — verified for
determinism, distribution, and seed-sensitivity in isolation before
trusting it) generates `data/mockPlatformHistory.ts`: ~90 days of
baseline mock orders across ~140 mock customers, cross-referencing the
*real* product catalog, with weighted status distribution and mild
weekend/trend variation. `utils/analytics.ts` merges this baseline with
real live data from `orderStore`/`wishlistStore`/`recentlyViewedStore`/
`searchStore` at one join point (`getUnifiedOrders`) — meaning **placing
a real order in the demo genuinely moves every chart derived from
orders**, not just the baseline. Every metric that *can* be computed
honestly from real data alone is — the search click-through rate and
no-result-search list come entirely from real logged
`SearchAnalyticsEvent`s, and "Frequently Bought Together" analytics use
real product co-occurrence counted from the combined order history
(distinct from, and a genuine complement to, the Phase 8 recommendation
engine's category-chain logic).

### Widget library (`components/admin/`)

`StatCard`, `MetricCard` (with a real period-over-period revenue trend —
this window's gross revenue vs. the equal-length window immediately
before it, not a placeholder number), `LineChartWidget`, `AreaChartWidget`,
`BarChartWidget`, `PieChartWidget`, `TableWidget`, `ActivityFeed`. Charts
are theme-aware by construction, not by JS re-coloring logic: colors are
passed as literal `"var(--color-fern)"` strings directly into recharts'
`stroke`/`fill` props, so toggling `.dark` on `<html>` re-colors every
chart instantly through the same CSS-variable mechanism the rest of the
app's dark mode already relies on.

### Six admin pages

Overview, Revenue (all 4 granularities, gross/net/discounts/shipping),
Orders (per-day volume, status breakdown, delivery/cancellation/return
rates), Products (best/worst sellers, most-viewed/wishlisted/returned,
frequently-bought-together pairs), Customers, Search — each composed
from the shared widget library, a date-range filter, and a CSV export
button that genuinely downloads the visible data (client-side
`Blob`/`URL.createObjectURL`, no fake "export started" toast with
nothing behind it).

### Accessibility

- **Reduced motion, done properly, not just claimed**: recharts animates
  chart mount/update via its own internal `requestAnimationFrame` logic,
  not CSS — the app's existing global
  `@media (prefers-reduced-motion: reduce)` CSS override (which disables
  CSS transitions/animations) has **no effect on it**. A live
  `usePrefersReducedMotion` hook (same `matchMedia` pattern as theme's
  system-preference tracking) is wired into all four chart widgets,
  passing `isAnimationActive={false}` when the preference is set.
- Every chart carries a `role="img"` wrapper with a real `aria-label`
  description of its content (result counts, ranges, status breakdowns)
  as a text alternative — genuinely readable by a screen reader, not a
  decorative label.
- Keyboard navigation: every interactive admin element (`NavLink`,
  native `<select>` for date range, `<button>` for export/logout) is a
  standard focusable element, no custom-built controls that would need
  extra `tabIndex`/keydown handling. The logout confirmation reuses the
  same `Modal` + `useFocusTrap` hook as everywhere else in the app.
- High-contrast (forced-colors mode): every admin file was grepped for
  hardcoded hex colors and non-token Tailwind color classes — zero found,
  confirming every color reference goes through the same CSS-variable
  token system the rest of the app's dark mode relies on. SVG chart
  fills/strokes are a known, common limitation of data-visualization
  libraries under forced-colors mode (browsers don't automatically remap
  SVG paint the way they do backgrounds/borders on HTML elements) — the
  `role="img" aria-label` text alternative on every chart is the
  mitigation, not a claim that the charts themselves fully repaint under
  forced-colors.

### Verification

`npx tsc -b`, `eslint . --max-warnings 0`, `npm run build`, and
`npm run preview` all checkpointed after every major addition. The full
code-quality checklist (no TODO/FIXME, no `console.log`, no
`@ts-ignore`/`@ts-expect-error`, no real `any`) passed clean. The dead-
export scan caught two real issues, not just self-documenting types:
`MetricCard` was built but never actually used anywhere (fixed by wiring
it into `AdminOverview` with the real revenue-trend calculation
mentioned above, not a forced/artificial use), and `productsMatchingTerm`
in `analytics.ts` was genuinely dead (removed, along with its
now-unused import) rather than retrofitted into an awkward feature just
to justify its existence. A TypeScript literal-type-widening issue
surfaced while fixing the first of these — an ESLint
`no-unnecessary-type-assertion` warning was correct in isolation
(removing the assertion didn't change the ternary's own type) but
removing it broke a downstream consumer, because the object literal's
property was widened to `string` by the surrounding `useMemo` callback's
lack of an explicit return type. Fixed at the actual source (an explicit
`useMemo<T>()` type parameter) rather than re-adding the assertion the
linter had correctly flagged. 23 routes (13 storefront + 3 auth + 7
admin) confirmed HTTP 200 through the production preview build. Every
admin file confirmed to use zero hardcoded colors. Zero new Zustand
stores created — admin analytics is entirely derived via hooks reading
the existing `orderStore`/`wishlistStore`/`recentlyViewedStore`/
`searchStore`, per the phase's explicit "extend existing stores, don't
create parallel implementations" instruction. `recharts`'s core chart
renderer (`CartesianChart`, ~339KB) confirmed isolated into its own lazy
chunk in the build output — the main bundle only contains the dynamic-
`import()` module reference needed for route-based code splitting
(verified by grep: real admin page copy like "Total customers" does not
appear in the main chunk), not actual admin page content. Main bundle
grew by ~5.8KB total across this entire phase — `AdminLayout` is eagerly
bundled, matching the same established pattern as `AccountLayout` and
`CheckoutLayout`, not a new inconsistency.
