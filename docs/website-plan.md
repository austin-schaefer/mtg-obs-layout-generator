# Website plan

**TL;DR.** Turn the legacy Python layout generator into a **static website** where a
host or co-host inputs parameters in the browser and gets the OBS layout images
back — no install, no CLI. Static-only on Netlify, no backend, no database. This doc
frames the architecture and the one decision that gates everything: *where the image
compositing runs*.

## Goal

A co-host who isn't comfortable with a terminal should be able to:
1. Open a URL.
2. Pick a mode (Scryfall search / random booster / upload custom images), enter a
   query or set code, choose a grid arrangement.
3. Get the composited individual slides + the final grid, ready to drop into OBS.

## What the site must reproduce

The behavior contract is the legacy pipeline (`download_images.py` /
`booster_builder.py`), and its exact coordinate spec lives in the
**`obs-layouts-design`** skill. Three input modes:

- **SCRY** — a Scryfall search query → card images + art crops.
- **BOOST** — a set code → a randomized, structurally-correct booster (the rarity
  logic in `booster_builder.py`).
- **CUSTOM** — user-uploaded paired vertical/horizontal images.

Then for every item: fit-resize → composite onto the marble background within the
fixed region → overlay the host frame → punch the two transparency rectangles →
montage into a grid capped at 2500×1400 over the title background.

## Architecture (static, no backend)

```
Browser (Astro + Tailwind v4, mostly static; an interactive island for the generator)
   │  fetch card data + images directly from the Scryfall API (CORS-friendly, no key)
   │  composite images client-side
   ▼
Download: individual slides (PNG) + grid.png
```

- **Astro** for the shell/pages; a single interactive island (React/Svelte/vanilla)
  for the generator form + processing + preview/download.
- **Tailwind v4** CSS-first tokens per the `obs-layouts-design` skill.
- **Netlify** static hosting. Secrets (if ever needed) live in the Netlify env UI,
  never the repo or client bundle — but Scryfall needs no key, so aim for zero
  secrets. (See `public-repo-safety`.)
- The `resources/` assets (all rights reserved) ship as static files the client
  composites against.

## The gating decision: where does compositing run?

The pipeline is ImageMagick. Static site + dynamic per-user input rules out
build-time generation. Options:

| Option | Notes |
|---|---|
| **Client-side WASM** (e.g. `@imagemagick/magick-wasm` or `wasm-imagemagick`) | Closest 1:1 port of the ImageMagick commands; keeps everything static + serverless; heavier initial download; all processing on the user's machine. **Leaning here.** |
| **Client-side Canvas** | Lighter weight; must reimplement resize/composite/transparency/montage by hand in Canvas 2D; more code, more drift risk from the spec. |
| **Netlify Functions** | Would allow server-side ImageMagick, but the owner chose *no backend* — out of scope. |

**Lean:** client-side WASM ImageMagick, so the existing command shapes port almost
directly and the site stays 100% static. Validate bundle size + cold-start on a
prototype before committing. Alternative (Canvas) stays open if WASM is too heavy.

## Open decisions (scaffold into issues)

- [ ] Confirm WASM ImageMagick vs Canvas (prototype both on one slide; measure).
- [ ] Scryfall API: rate-limit handling in the browser (legacy uses 0.11s spacing);
      paging for large queries.
- [ ] CUSTOM mode upload UX (the vertical/horizontal pairing rules).
- [ ] Booster rarity logic: port `booster_builder.py` to TS, or call Scryfall the
      same way at runtime?
- [ ] Output UX: per-slide download vs zip; grid preview before download.
- [ ] Interactive-island framework choice.

## Getting started

See `BOOTSTRAP.md` for a copy-paste prompt to scaffold the Astro + Tailwind +
Netlify project with these constraints baked in.
