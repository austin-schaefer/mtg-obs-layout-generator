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
  BaseLayout.astro    Document shell: <head>, fonts, global.css, body slot.
                      Emits <meta name="robots" content="noindex, nofollow"> so
                      the tool stays out of search (mirrored by an X-Robots-Tag
                      header in netlify.toml; robots.txt intentionally omitted).
components/
  SiteHeader.astro    Wordmark + tagline
  SiteFooter.astro    Attribution + source link
  Builder.tsx         Creation surface (#12/#26): source picker, per-mode inputs,
                      Generate (seeds the deck), big stage preview of the selected
                      slide + stepper, the deck editor, a real <form> query field
                      (per-mode name so the browser remembers past queries), and an
                      in-app "Present" overlay (mounts <Presenter> fullscreen — no
                      navigation, so editing work is never lost; Esc returns).
                      The Scryfall field defaults to a filter prefix (oldest paper
                      printing, release order, minus digital/un/Universes Beyond).
                      A generated deck is bookended by the branded keynote card:
                      keynote → title → cards → grid → keynote.
  DeckEditor.tsx      The one list that is the show (#26): a row per slide
                      (keynote / text / card / grid). Drag-reorder (insertion-line
                      drop indicator + ▲▼ fallback), duplicate, remove, select
                      (drives the preview); edit text in place, pick a card's face
                      (card / art / both), set a grid's WxH; add a Keynote, a Text
                      slide, a Grid, or a searched Card after the selected slide —
                      writes recipe live. Adding a card is two-step when it has
                      several printings: search a name, then pick the exact printing
                      (art thumbnail + set + collector #) that lands on the slide
                      (#31); a single-printing card adds in one step.
  Presenter.tsx       Show surface: keyboard nav (← → step · F fullscreen ·
                      L copy permalink), counter. Steps the whole deck (grid slides
                      included — no separate grid mode). Esc steps back out
                      (fullscreen → onExit); onExit set only for the builder overlay.
                      In fullscreen all overlay chrome is hidden — just the stage.
  PresenterApp.tsx    Client entry — mock demo reel by default; a ?r= permalink
                      decodes the deck and re-hydrates its card identities into
                      real artwork via Scryfall (loading / error states)
  stage/
    StageFrame.tsx    Fits the 2560×1440 canvas to the viewport (CSS scale)
    Stage.tsx         Renders one slide (keynote / text / card+art / grid) as
                      canvas layers. Keynote = the framed Clock Spinning brand
                      background (wordmark + host chrome), no text; text = arbitrary
                      text on the host-frame background (no wordmark), auto-fit and
                      centered above the host boxes in Montserrat / orchid (#25)
    GridOverview.tsx  Montage — the deck's cards tiled in a WxH grid (a grid slide)
lib/
  recipe.ts           Shared deck data model: CardRef / Card / SlideSpec / LayoutRecipe;
                      cardRefs() / cardMapFrom() / buildSlides() resolve + render the
                      deck; insertSlide / moveSlide / removeSlide / duplicateSlide /
                      setTitleText / setSlideFace / setGridArrangement are the
                      editor's pure recipe→recipe edits (addressed by deck position)
  stage.ts            2560×1440 coordinate system + regions + useStageScale() +
                      useFitFontSize() (auto-fits the keynote title into its band) +
                      usePreloadImages() (warms the deck's images so slides don't
                      load mid-presentation)
  permalink.ts        encodeRecipe / decodeRecipe — recipe ⇄ URL-safe string
                      (lz-string compressed; see docs/permalink-scheme.md)
  mock-cards.ts       Mock catalog + demo recipe backing the default /present demo reel
  resolve.ts          resolveDeck(mode, input) — the builder's card-resolution seam;
                      dispatches scry → Scryfall search (#14), boost → booster roll
                      (#17). Owns the generate-time Mode; re-exports searchCards +
                      searchPrintings for the deck editor's add-a-card search
  scryfall.ts         Browser-side Scryfall client (no key): rate-limited search,
                      searchCards (add-a-card picker) + searchPrintings (a chosen
                      card's printings, #31), booster-rarity queries, and
                      /cards/collection identity resolve
  booster.ts          Faithful TS port of booster_builder.py — set/odds tables +
                      rollBooster() drawing real cards, frozen to concrete identities
pages/
  index.astro         Landing intro + the builder (creation surface)
  present.astro       Full-viewport presenter (the screen-share surface)
styles/
  global.css          @import "tailwindcss" + @fontsource fonts (incl. the Clock
                      Spinning brand faces Zen Tokyo Zoo + Montserrat) + @theme tokens
```

`public/` (repo root) holds static passthrough assets like `favicon.svg`.

## Data model

`lib/recipe.ts` is the single shared shape the builder, the permalink, and the
stage renderer all speak. A `LayoutRecipe` is a **deck**: an ordered list of typed
slides (keynote / text / card / grid). Generate seeds it once; after that the deck *is* the
document, and every edit reorders / edits / adds / removes / duplicates entries in
that one list. Card slides carry resolved *identities* (`set` + `collector`), never
image URLs — those are reconstructed at render time (`buildSlides` + `cardMapFrom`).
The permalink scheme that encodes it is documented in `docs/permalink-scheme.md`.

A **card** slide shows the full card (vertical region) and its art (horizontal
region) side by side; its `face` can narrow it to card-only or art-only. Full cards
render at native size (never upscaled); card art is scaled to fill its region — both
faithful to the pipeline's resize rules. The two host-cam boxes are painted plain
white under the frame (the live surface has no transparency holes; webcams overlay
in OBS). A **grid** slide auto-montages every card slide currently in the deck (in
deck order) and stays in sync as cards are added / removed / reordered.

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
