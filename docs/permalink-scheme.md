# Permalink scheme (v2)

How a layout becomes a shareable URL — and why this shape. The de-risk of issue #13
established the compression approach; the slide-deck model (#26) is what's encoded.

## The constraint

The site has **no backend and no database**. A layout must reproduce entirely from
its URL, losslessly, for up to **100 cards**. The dominant cost is 100 card
identities, so the scheme is built around compressing those.

## What's encoded

The `LayoutRecipe` (`src/lib/recipe.ts`) — a **deck** of typed slides, carrying
resolved card *identities* but never image URLs:

| Field | Meaning |
|---|---|
| `v` | schema version (currently `2`) |
| `slides` | ordered list of typed slides (keynote / title / card / grid) |

Each slide encodes by type:

| Slide | Compact form | Notes |
|---|---|---|
| **title** | `[0, text]` | a text slide: arbitrary text; any number, anywhere |
| **card** | `[1, setIdx, collector]` or `[1, setIdx, collector, face]` | `setIdx` into the `sets[]` dictionary; `face` `0` card / `1` art / `2` both — omitted when both (the default) |
| **grid** | `[2, arrangement]` | `WxH`, `0` = auto; montages every card slide in the deck |
| **keynote** | `[3]` | the branded Clock Spinning title card (wordmark); no payload |

Image URLs are reconstructed at render time (Scryfall / booster / mock), which is
what keeps the URL deterministic and small.

## Encoding pipeline (`src/lib/permalink.ts`)

1. **Project to a compact positional array** `[v, sets, slides]`. Set codes are
   dictionary-encoded — a search or booster is usually one or a few sets — so each
   card slide references a small `sets[]` table by index. Each slide is a tuple led
   by a type tag; the card face is omitted when it's the default (both).
2. **`JSON.stringify`** the compact array.
3. **`lz-string.compressToEncodedURIComponent`** — collapses the repeated set
   codes and JSON punctuation and emits a URL-safe string directly.

Decode reverses each step. JSON and lz-string are both lossless, so a recipe
round-trips exactly (verified by the spike's canonical-form comparison). The
decoder accepts only the current `v` — there are no in-the-wild v1 links to migrate
(the tool is pre-launch), so an unknown version is rejected rather than mis-parsed.

## Measured lengths (100-card cap)

From `scripts/permalink-spike.ts` (`node --experimental-strip-types`):

| Scenario | naive base64url | lz-string encoded | full `/present?r=` URL |
|---|--:|--:|--:|
| Best case — one set, no edits | 7326 | 423 | 465 |
| Worst case — 16 sets, alnum collectors, mixed faces + divider titles/grids | 7783 | 920 | 962 |

A naive base64 of the JSON (~7–8k chars) **exceeds** a conservative ~2000-char URL
budget; lz-string brings the worst case to **962 chars**, comfortably shareable and
pasteable everywhere. That's why the `lz-string` dependency is warranted.

## Notes for the full implementation (#16)

- **Versioning:** the leading `v` gates decoding. Decode throws on any version it
  doesn't own (no v1 migration — pre-launch, no shared links exist yet).
- **100-card cap is real.** Some Scryfall searches return more than 100 results;
  the builder must cap (and signal the cap) before encoding — the URL budget above
  assumes ≤100.
- **Collectors are strings**, not numbers — promos/variants use `123a`, `★`, etc.
- Run the spike after any change to `recipe.ts`/`permalink.ts` to confirm the
  budget and round-trip still hold.
