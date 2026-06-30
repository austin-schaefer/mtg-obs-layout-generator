/**
 * Permalink encode/decode — a layout recipe ⇄ a URL-safe string.
 *
 * The site has no backend and no database: a layout is reproduced entirely from
 * the URL. So the encoding has to be both lossless and compact enough to survive
 * up to 100 cards inside a real URL. See `docs/permalink-scheme.md` for the
 * measured length budget and the rationale; `scripts/permalink-spike.ts` is the
 * harness that validates both.
 *
 * Scheme (v1):
 *   1. Project the recipe onto a compact positional array, dictionary-encoding
 *      the repeated set codes (a search or booster is usually one or a few sets).
 *   2. `JSON.stringify` it.
 *   3. Compress with lz-string's `compressToEncodedURIComponent` (URL-safe out).
 *
 * lz-string collapses the repeated set codes and JSON punctuation, so the common
 * single-set case lands in the low hundreds of characters. Decode reverses each
 * step; JSON + lz-string are both lossless, so it round-trips exactly.
 */

import lzString from "lz-string";
import { SCHEMA_VERSION, type LayoutRecipe, type Mode } from "./recipe.ts";

// lz-string ships as CommonJS; default-import interop works in both Vite and
// Node's ESM loader (named imports from the CJS build do not).
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } =
  lzString;

const MODE_CODES: Record<Mode, number> = { scry: 0, boost: 1, custom: 2 };
const MODE_BY_CODE: Mode[] = ["scry", "boost", "custom"];

/**
 * Compact positional form: `[v, modeCode, title, sets, cards, order, excluded,
 * grid, faces]`, where `cards` is `[setIdx, collector][]` against the `sets`
 * dictionary, and absent optional fields are `0` (cheaper than `null`/`[]`).
 */
type Compact = [
  number, // v
  number, // mode code
  string, // title
  string[], // set dictionary
  [number, string][], // cards: [setIdx, collector]
  number[] | 0, // order
  number[] | 0, // excluded
  string | 0, // grid
  number[] | 0, // faces (per-card face codes)
];

function toCompact(recipe: LayoutRecipe): Compact {
  const sets: string[] = [];
  const setIndex = (code: string): number => {
    let i = sets.indexOf(code);
    if (i < 0) {
      i = sets.length;
      sets.push(code);
    }
    return i;
  };
  const cards = recipe.cards.map(
    (c): [number, string] => [setIndex(c.set), c.collector],
  );
  return [
    recipe.v,
    MODE_CODES[recipe.mode],
    recipe.title,
    sets,
    cards,
    recipe.order ?? 0,
    recipe.excluded ?? 0,
    recipe.grid ?? 0,
    recipe.faces ?? 0,
  ];
}

function fromCompact(c: Compact): LayoutRecipe {
  const [v, modeCode, title, sets, cards, order, excluded, grid, faces] = c;
  const recipe: LayoutRecipe = {
    v,
    mode: MODE_BY_CODE[modeCode] ?? "scry",
    title,
    cards: cards.map(([setIdx, collector]) => ({
      set: sets[setIdx],
      collector,
    })),
  };
  if (order !== 0) recipe.order = order;
  if (excluded !== 0) recipe.excluded = excluded;
  if (grid !== 0) recipe.grid = grid;
  if (faces !== 0) recipe.faces = faces;
  return recipe;
}

/** Encode a recipe to a URL-safe permalink string. */
export function encodeRecipe(recipe: LayoutRecipe): string {
  return compressToEncodedURIComponent(JSON.stringify(toCompact(recipe)));
}

/**
 * Decode a permalink string back to a recipe.
 * Throws if the string is malformed or from an unsupported schema version.
 */
export function decodeRecipe(encoded: string): LayoutRecipe {
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error("permalink: could not decompress");
  let compact: Compact;
  try {
    compact = JSON.parse(json) as Compact;
  } catch {
    throw new Error("permalink: invalid payload");
  }
  if (!Array.isArray(compact) || typeof compact[0] !== "number") {
    throw new Error("permalink: unrecognized shape");
  }
  if (compact[0] > SCHEMA_VERSION) {
    throw new Error(`permalink: schema v${compact[0]} is newer than supported`);
  }
  return fromCompact(compact);
}
