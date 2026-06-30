# Permalink scheme (v1)

How a layout becomes a shareable URL — and why this shape. This is the de-risk
output of issue #13; the full permalink feature (#16) implements exactly this.

## The constraint

The site has **no backend and no database**. A layout must reproduce entirely from
its URL, losslessly, for up to **100 cards**. The dominant cost is 100 card
identities, so the scheme is built around compressing those.

## What's encoded

The `LayoutRecipe` (`src/lib/recipe.ts`) — not image URLs, only resolved card
*identities*:

| Field | Meaning |
|---|---|
| `v` | schema version (currently `1`) |
| `mode` | `scry` / `boost` / `custom` |
| `cards` | resolved identities `{ set, collector }`, original order |
| `title` | title-slide text |
| `order` | index permutation (omitted when identity) |
| `excluded` | dropped indices |
| `grid` | `WxH` arrangement, `0` = auto |
| `faces` | per-card face codes (`0` card-only, `1` art-only, `2` both); omitted ⇒ both for every card |

Image URLs are reconstructed at render time (Scryfall / booster / mock), which is
what keeps the URL deterministic and small.

## Encoding pipeline (`src/lib/permalink.ts`)

1. **Project to a compact positional array.** Set codes are dictionary-encoded —
   a search or booster is usually one or a few sets — so each card becomes
   `[setIdx, collector]` against a small `sets[]` table. Absent optional fields
   are `0`, cheaper than `null`/`[]`.
2. **`JSON.stringify`** the compact array.
3. **`lz-string.compressToEncodedURIComponent`** — collapses the repeated set
   codes and JSON punctuation and emits a URL-safe string directly.

Decode reverses each step. JSON and lz-string are both lossless, so a recipe
round-trips exactly (verified by the spike's canonical-form comparison).

## Measured lengths (100-card cap)

From `scripts/permalink-spike.ts` (`node --experimental-strip-types`):

| Scenario | naive base64url | lz-string encoded | full `/present?r=` URL |
|---|--:|--:|--:|
| Best case — one set, no edits | 4206 | 381 | 423 |
| Worst case — 16 sets, alnum collectors, full edits | 5123 | 1128 | 1170 |

A naive base64 of the JSON (~4–5k chars) **exceeds** a conservative ~2000-char URL
budget; lz-string brings the worst case to **1170 chars**, comfortably shareable
and pasteable everywhere. That's why the `lz-string` dependency is warranted.

## Notes for the full implementation (#16)

- **Versioning:** the leading `v` lets the decoder reject/migrate future schemas.
  Decode throws on a newer-than-supported version.
- **100-card cap is real.** Some Scryfall searches return more than 100 results;
  the builder must cap (and signal the cap) before encoding — the URL budget above
  assumes ≤100.
- **Collectors are strings**, not numbers — promos/variants use `123a`, `★`, etc.
- Run the spike after any change to `recipe.ts`/`permalink.ts` to confirm the
  budget and round-trip still hold.
