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
| 3 | Product listing (filters/sort/pagination), product detail, MSW mock API | Not started |
| 4 | Cart, wishlist, Zustand stores, persistence | Not started |
| 5 | Remaining pages, forms (RHF + Zod), mock auth | Not started |
| 6 | Animation pass, performance, accessibility audit, SEO | Not started |

Routes not yet built render a labeled placeholder stating which phase covers them,
rather than a broken page — check `src/pages/` and `src/routes/index.tsx`.

## Known issues (tracked, not fixed yet)

- **Main bundle exceeds Vite's 500KB warning threshold** (~544KB / 172KB gzip).
  `Navbar` lives in the non-lazy root `Layout`, and it pulls in `MegaMenu` and
  `SearchDrawer`, which depend on `framer-motion` — so that dependency ends up
  in the eager bundle instead of a route-split chunk. Real fix (manual chunk
  splitting and/or lazy-loading the drawer content itself, not just routes)
  is Phase 6 scope, not a one-line patch.

## Notes on scope vs. the original brief

This project takes inspiration from the *feature richness* of modern premium
plant/home-décor e-commerce sites, not from any specific company's design,
layout, or branding — see the design plan discussion for the reasoning. No
assets, copy, or code were copied from a reference site.
