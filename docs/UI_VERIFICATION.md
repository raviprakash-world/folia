# UI verification checklist

Passing typecheck, lint and unit tests does **not** show that a UI change works.
Twice this project shipped UI that "worked" but was unusable: dark-mode text that
disappeared on dark-green blocks, and a location feature whose only entry point
was a tiny icon whose label was hidden below 1280px. Both were found by the
owner, not by us. Before calling any UI change done:

## 1. Find the feature the way a first-time visitor would
- Land on the home page at a **typical laptop width (1100–1440px)** and on a
  **phone (390px)**. Can you find the new feature without being told where it is?
- A primary action needs a **visible text label at every width**. Never put the
  only entry point behind `hidden md:…` / `xl:…`, an icon alone, a hover, or a
  menu. Icons are shortcuts, not the way in.
- Click it as a user would (no shortcuts, no console) and finish the whole flow.

## 2. Check every width, in both themes
Widths: **390, 768, 1100, 1440**. Themes: **light and dark** (the theme toggle
is in the header; dark mode inverts `stone`/`stone-light`, so text that uses
them on fixed fills breaks).
- Run `scripts/ui-audit.js` on each changed page at each width/theme. It must
  report **no contrast failures** and **no horizontal overflow**.
- Look at a screenshot too — the script cannot judge text over photos.
- Adding anything to the header? Re-check 768px: the header is tight there.

## 3. Colour rules (see `src/index.css`)
- Text on a **fixed dark fill** (`bg-pine`, the hero, footer) uses `text-cream*`,
  never `text-stone*` (those invert in dark mode).
- Text on an **amber** fill (`bg-ochre`) uses `text-pine`, never `text-heading`.
- Don't use translucent text (`text-…/50`) for content people need to read.

## 4. Test the real path, not just the mock
Turn on the real API flags (`.env.local`) and run the flow against the real
backend and database at least once; a mock can hide a mismatch.

## 5. Open every overlay and look at it
Dialogs, dropdowns, menus and popovers must be **opened and looked at** — measure
that the box is fully inside the viewport (top ≥ 0, bottom ≤ innerHeight) *and* take a
screenshot at the pane's native size (custom emulated sizes can hide `fixed`
overlays from the screenshot tool). Check Escape, the close button and a
backdrop click, in both themes and at 390px.

Why: a dialog opened from the sticky header rendered with its top off-screen. The
header uses `backdrop-blur`, and any ancestor with `backdrop-filter`, `filter` or
`transform` becomes the containing block for `position: fixed` children. `Modal`
now renders through a portal into `document.body`; new overlays must too.


## 6. Phone checks: `scripts/viewport-audit.mjs`
A real Chrome (over the DevTools protocol) loads each route at each width and
reports, per page:

- **OVERFLOW** — the page scrolls sideways; **CLIPPED** — something sticks out
  past the screen but is hidden (this is how a cut-off product column and Sort
  dropdown hid from a plain overflow check);
- interactive elements smaller than 40px (tap targets), text under 12px,
  images without dimensions, images decoded far larger than shown.

```bash
node scripts/viewport-audit.mjs                       # every public route, 320 → 1440
node scripts/viewport-audit.mjs --widths 360,390,412 --routes / /shop --shots out/ --full
BASE_URL=http://localhost:5175 node scripts/viewport-audit.mjs \
  --login demo@folia.example:folia-demo --cart hand-trowel --routes /account /checkout/shipping
```

The signed-in screens need a dev server running in mock-auth mode
(`VITE_REAL_AUTH_API=false VITE_REAL_SELLERS_API=false npx vite --port 5175`).
It never types card details; stop at the payment screen.

## 7. Rules that came out of the mobile phase
- **Tap targets are 44px.** Icon buttons are `size-11`; text links in lists get
  `min-h-11`. `Button` has real minimum heights (`sm` 40, `md` 44, `lg` 48).
- **Never nest `<Link>` inside `<Button>`** (only the text is then tappable).
  Use `ButtonLink`.
- **Fields are 16px on phones** or iOS Safari zooms the page on focus (a global
  rule in `index.css` enforces it). Inputs are `w-full min-w-0` so one wide
  field can't stretch a one-column grid past the screen.
- **Nothing is hover-only.** The wishlist heart used to appear only on hover, so
  on a phone it was invisible.
- **Sticky bars need clearance.** The product page and cart have their own bottom
  bars, so the bottom navigation is hidden there and those pages reserve space
  under their content. Toasts sit above both.
- **Use the same money format where money is settled.** Browsing shows `₹899`;
  cart and checkout keep two decimals (`₹899.00`) so line items and totals match.
- **State only what a policy page or a working feature backs** (see the "Why
  Folia" block). No counts, awards, or testimonials that were not measured.
- **Never resize a pinned element in response to scrolling.** Hiding the header's
  search row used to shrink the sticky header, which moved the page, which the
  browser reported as scrolling the other way, which showed the row again: a
  flicker loop (41 flips in four slow scrolls). The row now hangs below the header
  without taking layout space, and direction is measured by distance travelled
  (24px), so small jitter does nothing. Test scroll-driven UI by scrolling
  slowly and jittering, and count the state changes.

