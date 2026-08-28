# Folia — a premium plant & home décor storefront (portfolio project)

An original, production-grade React storefront built to demonstrate senior-level
frontend architecture — not a clone of any real business. Inspired by the *category*
of premium D2C plant/home-goods shopping experiences; the visual identity, copy,
layout, and component design are original.

Full customer journey: browse → cart → checkout → order → track → return.
Account dashboard with address book, order history, delivery tracking, and a
notification center. Mock authentication and a mock (MSW) backend throughout.

See `CHANGELOG.md` for what shipped in each phase, and `ARCHITECTURE.md` for
how it's built — state management, the service layer, every mock API
endpoint, and the reasoning behind the non-obvious decisions.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router v7 ·
Framer Motion · Zustand · TanStack Query · React Hook Form + Zod · Axios ·
MSW · jsPDF (one deliberate, lazy-loaded exception — see ARCHITECTURE.md) ·
Lucide React · Swiper · ESLint + Prettier

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

**Demo account:** `demo@folia.example` / `folia-demo` — the only account that
survives a page reload (see "Known simplifications" in ARCHITECTURE.md for why).

**Demo admin account:** `admin@folia.example` / `folia-admin` — sign in at
`/admin/login` for the analytics dashboard.

**Try ⌘K / Ctrl+K** anywhere in the app for the command-palette search.

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

See "Folder structure" in `ARCHITECTURE.md` for the full annotated tree.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffolding, Tailwind, design tokens, shared UI primitives, routing, layout | ✅ Done |
| 2 | Homepage sections, full nav (mega menu, search), footer polish | ✅ Done |
| 3 | Product listing (filters/sort/pagination), product detail, MSW mock API | ✅ Done |
| 4 | Cart, wishlist, Zustand stores, persistence | ✅ Done |
| 5 | Static pages, forms (RHF + Zod), mock authentication, blog, FAQ | ✅ Done |
| 6 | Account dashboard, address book, full checkout flow, orders | ✅ Done |
| 7 | Order tracking, returns/cancellation, notification center, dashboard analytics, PDF invoices | ✅ Done |
| 8 | Dark mode, command-palette search (⌘K), deterministic recommendation engine | ✅ Done |
| 9 | Admin analytics dashboard (revenue/orders/products/customers/search), mock role-based auth | ✅ Done |

Every route renders real content — no placeholder pages exist anywhere in
the app, and every list/detail screen (orders, addresses, notifications) has
working loading, empty, and error states, not just a happy path.

## What's real vs. explicitly mock

Everything in this app is functional — forms validate, state persists, async
actions can fail and recover — but nothing talks to a real backend, real
payment processor, or real courier network. Where that matters, the UI says
so plainly (a "mock" label, an inline note) rather than silently pretending.
The short version:

- **Auth** is a real flow (session, protected routes, password reset) over a
  fake JWT and an in-memory user list — not real security.
- **Payments** are mock, with a real ~15% decline rate so the retry flow is
  actually reachable, not theoretical.
- **Couriers** are fictional (SwiftPost, Cascade Express, etc.) — the brief
  named real logistics companies with real trademarks; see ARCHITECTURE.md
  for why those were substituted.
- **Delivery tracking and refund status** are computed from real elapsed
  time (deterministically seeded per order), not random and not live.
- **Invoices are real PDFs** (via jsPDF), generated from mock order data.
- **Dark mode is fully real** — persisted, system-aware, no flash on load.
  The one genuinely mock-adjacent piece: search's "trending searches" and
  the recommendation engine's "Customers Also Viewed" are deterministic,
  documented mocks (no live trending data, no real cross-customer
  behavior) — never random, always the same for the same inputs.
- **The admin analytics dashboard combines a deterministic mock platform
  baseline (~90 days, ~140 mock customers) with your real live session
  data** — this is a client-only app with exactly one real customer per
  browser, so multi-customer metrics can't be 100% real. A real order
  placed in the demo genuinely moves every chart derived from orders;
  the search click-through rate and no-result-search list are 100% real,
  computed from actual logged search events. Full explanation in
  `ARCHITECTURE.md`'s "Analytics & Admin Dashboard" section.

Full write-ups of the theme system, the search ranking algorithm, the
recommendation engine, and the analytics dashboard are dedicated,
clearly-headed sections in `ARCHITECTURE.md` — not scattered across
separate files, so the reasoning behind related decisions stays together.
- **Dark mode is fully real** — persisted, system-aware, no flash on load.
  The one genuinely mock-adjacent piece: search's "trending searches" and
  the recommendation engine's "Customers Also Viewed" are deterministic,
  documented mocks (no live trending data, no real cross-customer
  behavior) — never random, always the same for the same inputs.

Full detail on every one of these — including the handful of documented
simplifications (partial returns, guest/account cart merging) — is in
`ARCHITECTURE.md`.

## Notes on scope vs. the original brief

This project takes inspiration from the *feature richness* of modern premium
plant/home-décor e-commerce sites, not from any specific company's design,
layout, or branding. No assets, copy, or code were copied from a reference
site, and no real company names, logos, or trademarks (couriers, social
platforms) appear anywhere in the app — see ARCHITECTURE.md's "Notable
decisions" for the specific substitutions and reasoning.
