# src/

The Astro site — the live broadcast surface that replaces the Python file-export
pipeline (see the epic, issue #19). Static build, deployed on Netlify.

## Stack

- **Astro 7** — static output to `dist/` (no adapter; Netlify publishes `dist/`).
- **Tailwind v4**, CSS-first via the `@tailwindcss/vite` plugin. No
  `tailwind.config.js`. Brand tokens land in an `@theme` block in
  `styles/global.css` (#8).
- **Preact** — the interactive island framework. Add islands as `.tsx` and
  hydrate with a `client:*` directive.

## Layout

```
layouts/
  BaseLayout.astro    Document shell: <head>, global.css, body slot
components/
  StageBadge.tsx      Placeholder Preact island (proves hydration; removed in Phase 1)
pages/
  index.astro         App-shell landing page
styles/
  global.css          @import "tailwindcss" (brand @theme tokens added in #8)
```

`public/` (repo root) holds static passthrough assets like `favicon.svg`.

## Commands

`npm run dev` (local), `npm run build` (→ `dist/`), `npm run preview`.
