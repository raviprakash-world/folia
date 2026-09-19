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
