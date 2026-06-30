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
  Builder.tsx         Creation surface (#12): mode picker, per-mode inputs,
                      generate, results strip, stage preview, presenter handoff,
                      edit-controls shell (behavior fills in with the editor, #15)
  Presenter.tsx       Show surface: keyboard nav (← → · G grid · F fullscreen ·
                      L copy permalink), counter
  PresenterApp.tsx    Client entry — picks recipe (mock or ?r= permalink), resolves cards
  stage/
    StageFrame.tsx    Fits the 2560×1440 canvas to the viewport (CSS scale)
    Stage.tsx         Renders one slide (title / full-card / art) as canvas layers
    GridOverview.tsx  Montage view — all visible cards tiled in a WxH grid
lib/
  recipe.ts           Shared layout data model: Mode / CardRef / Card / LayoutRecipe;
                      recipeToSlides() / visibleCards() derive what's shown
  stage.ts            2560×1440 coordinate system + regions + useStageScale() hook
  permalink.ts        encodeRecipe / decodeRecipe — recipe ⇄ URL-safe string
                      (lz-string compressed; see docs/permalink-scheme.md)
  mock-cards.ts       Phase-1 mock catalog + demo recipe (real Scryfall modes land later)
  resolve.ts          resolveDeck(mode, input) — the builder's card-resolution seam;
                      mock-backed now, replaced by Scryfall (#14) / booster (#17)
pages/
  index.astro         Landing intro + the builder (creation surface)
  present.astro       Full-viewport presenter (the screen-share surface)
styles/
  global.css          @import "tailwindcss" + @fontsource fonts + @theme tokens
```

`public/` (repo root) holds static passthrough assets like `favicon.svg`.

## Data model

`lib/recipe.ts` is the single shared shape the builder, the permalink, and the
stage renderer all speak. A `LayoutRecipe` carries resolved card *identities*
(`set` + `collector`) plus edits (order, exclusions, grid, card-vs-art, title) —
never image URLs, which are reconstructed at render time. The permalink scheme
that encodes it is documented in `docs/permalink-scheme.md`.

Each card is **one** discussion slide showing the full card (vertical region) and
its art (horizontal region) side by side; `recipe.faces` can narrow a card to
card-only or art-only (the editor, #15, writes it). Full cards render at native
size (never upscaled); card art is scaled to fill its region — both faithful to
the pipeline's resize rules. The two host-cam boxes are painted plain white under
the frame (the live surface has no transparency holes; webcams overlay in OBS).

## The stage

Everything broadcast renders onto a fixed **2560×1440** canvas (the OBS composite
size — every `resources/*.png` background is this size) authored in true
broadcast-space pixels, then scaled to fit the viewport by `<StageFrame>`. The
region coordinates in `lib/stage.ts` mirror `ImageConfig` in `download_images.py`
and the `obs-layouts-design` skill (the single source of truth) — keep them in
sync. No transparency holes, no PNG export: this is the live surface (epic #19).
The licensed backgrounds in `resources/` are imported in place (Astro hashes them
into the build) — never copied or relicensed.

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
