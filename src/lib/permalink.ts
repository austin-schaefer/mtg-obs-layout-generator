/**
 * Permalink encode/decode — a layout deck ⇄ a URL-safe string.
 *
 * The site has no backend and no database: a layout is reproduced entirely from
 * the URL. So the encoding has to be both lossless and compact enough to survive
 * up to 100 cards inside a real URL. See `docs/permalink-scheme.md` for the
 * measured length budget and the rationale; `scripts/permalink-spike.ts` is the
 * harness that validates both.
 *
 * Scheme (v2):
 *   1. Project the deck onto a compact positional array, dictionary-encoding the
 *      repeated set codes (a search or booster is usually one or a few sets) and
 *      tagging each slide by type.
 *   2. `JSON.stringify` it.
 *   3. Compress with lz-string's `compressToEncodedURIComponent` (URL-safe out).
 *
 * lz-string collapses the repeated set codes and JSON punctuation, so the common
 * single-set case lands in the low hundreds of characters. Decode reverses each
 * step; JSON + lz-string are both lossless, so it round-trips exactly.
 */

import lzString from "lz-string";
import {
  FACE_BOTH,
  SCHEMA_VERSION,
  type LayoutRecipe,
  type SlideSpec,
} from "./recipe.ts";

// lz-string ships as CommonJS; default-import interop works in both Vite and
// Node's ESM loader (named imports from the CJS build do not).
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } =
  lzString;

// Slide type tags in the compact form.
const T_TITLE = 0;
const T_CARD = 1;
const T_GRID = 2;

/**
 * Compact slide forms, tagged by type:
 *   - title: `[0, text]`
 *   - card:  `[1, setIdx, collector]` (face BOTH — the default, omitted) or
 *            `[1, setIdx, collector, face]` when the face isn't BOTH
 *   - grid:  `[2, arrangement]`
 */
type CompactSlide =
  | [typeof T_TITLE, string]
  | [typeof T_CARD, number, string]
  | [typeof T_CARD, number, string, number]
  | [typeof T_GRID, string];

/** Compact positional form: `[v, sets, slides]`, `sets` the set-code dictionary. */
type Compact = [number, string[], CompactSlide[]];

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

  const slides = recipe.slides.map((s): CompactSlide => {
    if (s.kind === "title") return [T_TITLE, s.text];
    if (s.kind === "grid") return [T_GRID, s.arrangement];
    const idx = setIndex(s.set);
    return s.face === FACE_BOTH
      ? [T_CARD, idx, s.collector]
      : [T_CARD, idx, s.collector, s.face];
  });

  return [recipe.v, sets, slides];
}

function fromCompact(c: Compact): LayoutRecipe {
  const [v, sets, slides] = c;
  return {
    v,
    slides: slides.map((s): SlideSpec => {
      switch (s[0]) {
        case T_TITLE:
          return { kind: "title", text: s[1] };
        case T_GRID:
          return { kind: "grid", arrangement: s[1] };
        default: {
          const [, setIdx, collector, face] = s;
          return {
            kind: "card",
            set: sets[setIdx],
            collector,
            face: face ?? FACE_BOTH,
          };
        }
      }
    }),
  };
}

/** Encode a recipe to a URL-safe permalink string. */
export function encodeRecipe(recipe: LayoutRecipe): string {
  return compressToEncodedURIComponent(JSON.stringify(toCompact(recipe)));
}

/**
 * Decode a permalink string back to a recipe.
 * Throws if the string is malformed or not the supported schema version.
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
  // No in-the-wild v1 links to migrate (pre-launch); only the current schema is
  // supported. Reject anything else rather than mis-parse an old shape.
  if (compact[0] !== SCHEMA_VERSION) {
    throw new Error(`permalink: unsupported schema v${compact[0]}`);
  }
  return fromCompact(compact);
}
