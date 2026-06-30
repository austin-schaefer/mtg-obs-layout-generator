# src/

The Astro site — the live broadcast surface that replaces the Python file-export
pipeline (see the epic, issue #19). Static build, deployed on Netlify.

## Stack

- **Astro 7** — static output to `dist/` (no adapter; Netlify publishes `dist/`).
- **Tailwind v4**, CSS-first via the `@tailwindcss/vite` plugin. No
  `tailwind.config.js`. Design tokens live in an `@theme` block in
  `styles/global.css`, kept in sync with the **`obs-layouts-design`** skill.
- **Preact** — the interactive island framework. Add islands as `.tsx` and
  hydrate with a `client:*` directive.

## Layout

```
layouts/
  BaseLayout.astro    Document shell: <head>, fonts, global.css, body slot
components/
  SiteHeader.astro    Wordmark + tagline + gold accent rule
  SiteFooter.astro    Attribution + source link
  StageBadge.tsx      Placeholder Preact island (proves hydration; removed in Phase 1)
pages/
  index.astro         App-shell landing page
styles/
  global.css          @import "tailwindcss" + @fontsource fonts + @theme tokens
```

`public/` (repo root) holds static passthrough assets like `favicon.svg`.

## Conventions

- **Tokens, not magic values.** Use the `@theme` utilities (`bg-marble`,
  `text-maroon`, `font-serif`, …). New colors/sizes go in the design skill first.
- **Self-hosted fonts only** — no CDNs. Fonts come from `@fontsource` packages.
- **Responsive breakpoints** are canonical and *enforced*. `global.css` clears
  Tailwind's default breakpoints (`--breakpoint-*: initial`) and defines only the
  brand's modes, so the design skill's system is the only one available:
  - base (unprefixed) = **mobile** ≤768
  - `tablet:` = **769–1024**
  - `desktop:` = **≥1025** (the 1024↔1025 boundary is exact)

  Don't reach for `sm:`/`md:`/`lg:` — they don't exist here by design. Verify CSS
  changes per the skill's review workflow before declaring done.

## Commands

`npm run dev` (local), `npm run build` (→ `dist/`), `npm run preview`.
