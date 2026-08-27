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
│   ├── common/     # Logo, PlaceholderPage, PageLoader — cross-cutting bits
│   ├── layout/      # Navbar, Footer, MobileNav, Layout shell
│   ├── ui/          # Design-system primitives: Button, Tag, Card, Input, Container
│   ├── product/     # (Phase 3)
│   ├── cart/        # (Phase 4)
│   ├── wishlist/    # (Phase 4)
│   └── forms/       # (Phase 5)
├── pages/           # Route-level components, each lazy-loaded
├── routes/          # Router config (code-split route tree)
├── hooks/           # (added as needed per phase)
├── services/        # API layer — Axios instance + MSW handlers (Phase 3)
├── store/           # Zustand stores — cart, wishlist, etc. (Phase 4)
├── utils/           # cn() and other small helpers
├── constants/        # (added as needed)
├── data/             # Mock data fixtures (Phase 3)
├── types/            # Shared TypeScript types
└── styles/          # (token rationale notes, if split out from index.css)
```

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffolding, Tailwind, design tokens, shared UI primitives, routing, layout | ✅ Done |
| 2 | Homepage sections, full nav (mega menu, search drawer), footer polish | ✅ Done |
| 3 | Product listing (filters/sort/pagination), product detail, MSW mock API | ✅ Done |
| 4 | Cart, wishlist, Zustand stores, persistence | Not started |
| 5 | Remaining pages, forms (RHF + Zod), mock auth | Not started |
| 6 | Animation pass, performance, accessibility audit, SEO | Not started |

Routes not yet built render a labeled placeholder stating which phase covers them,
rather than a broken page — check `src/pages/` and `src/routes/index.tsx`.

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

## Known issues (tracked, not fixed yet)

- The Phase 2 handoff flagged the main bundle exceeding Vite's 500KB warning
  threshold (framer-motion leaking into the eager `Layout` bundle). Phase 3's
  route splitting on Shop/Category/ProductDetail spread enough weight into
  lazy chunks that the warning is gone as of this build (461KB) — not because
  the underlying cause was fixed, so re-check after Phase 4/5 add more routes.
- Add-to-cart and the wishlist heart on the product detail page are fully
  interactive (variant validation, quantity limits, disabled states) but
  don't persist anywhere yet — that's Phase 4's Zustand store.
- `Category.tsx` filters by `categorySlug` directly for real categories
  (plants/vessels/tools), but curated collections (e.g. "gifting") that span
  multiple categories currently just show framing copy over the full catalog
  rather than a true cross-category filter — a real backend would resolve
  that server-side; revisit if collections need to be genuinely curated
  rather than category-aliased.

## Notes on scope vs. the original brief

This project takes inspiration from the *feature richness* of modern premium
plant/home-décor e-commerce sites, not from any specific company's design,
layout, or branding — see the design plan discussion for the reasoning. No
assets, copy, or code were copied from a reference site.
