/**
 * The layout recipe — the single shared data model for Phase 1.
 *
 * A recipe fully describes a layout: which cards (by compact identity), in what
 * order, which are excluded, the grid arrangement, which slides show art instead
 * of the full card, and the title text. It is the exact shape the permalink
 * encodes (`permalink.ts`) and the renderer consumes (`recipeToSlides`), so the
 * builder, the URL, and the stage all speak one language.
 *
 * Image URLs are NOT part of the recipe — only resolved card *identities* are.
 * URLs are reconstructed at render time (live, from Scryfall — or the mock catalog
 * for the demo reel), which is what keeps the permalink deterministic and small.
 */

export type Mode = "scry" | "boost" | "custom";

/** A card's compact, permalinkable identity, e.g. `{ set: "neo", collector: "123" }`. */
export interface CardRef {
  /** Lowercase Scryfall set code, e.g. `neo`. */
  set: string;
  /** Collector number as a string — may be non-numeric (`123a`, `★`). */
  collector: string;
}

/** A resolved card: identity plus the image URLs needed to render it. */
export interface Card extends CardRef {
  name: string;
  /** Full-card PNG (portrait) — placed in the vertical region. */
  cardImage: string;
  /** Art crop (landscape) — placed in the horizontal region. */
  artImage: string;
}

export interface LayoutRecipe {
  /** Schema version, so the decoder can migrate older URLs. */
  v: number;
  mode: Mode;
  /** Resolved card identities, in original resolved order. */
  cards: CardRef[];
  /** Title-slide text (show name, set name, episode, …). */
  title: string;
  /** Permutation of `cards` indices; omit when it's the identity order. */
  order?: number[];
  /** Indices of `cards` to drop from the show. */
  excluded?: number[];
  /** Grid arrangement `WxH`; `0` = auto (e.g. `8x0`, `4x4`). */
  grid?: string;
  /**
   * Per-card face selection, aligned to `cards`: `0` = full card only, `1` = art
   * only, `2` = both (a card slide *and* an art slide). Omitted ⇒ both faces for
   * every card. The editor (#15) writes this; the presenter steps through every
   * slide it produces.
   */
  faces?: number[];
}

export const FACE_CARD = 0;
export const FACE_ART = 1;
export const FACE_BOTH = 2;

/**
 * A self-contained "card unavailable" image, used when an identity can't be
 * resolved to real artwork (a not-found permalink card, a network failure). It's
 * an inline SVG so it never needs the network — the same fallback the mock and
 * the live (Scryfall) resolvers both reach for.
 */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="745" height="1040">
       <rect width="100%" height="100%" rx="36" fill="#2a2622"/>
       <rect x="20" y="20" width="705" height="1000" rx="24" fill="none"
             stroke="#b8893a" stroke-width="6"/>
       <text x="50%" y="50%" fill="#d8d3c4" font-family="serif" font-size="44"
             text-anchor="middle">card unavailable</text>
     </svg>`,
  );

/** Build a placeholder card for an identity that couldn't be resolved. */
export function placeholderCard(ref: CardRef): Card {
  return {
    ...ref,
    name: `${ref.set} ${ref.collector}`,
    cardImage: PLACEHOLDER_IMAGE,
    artImage: PLACEHOLDER_IMAGE,
  };
}

/**
 * A card slide of the discussion layout. The full card (vertical region) and the
 * art (horizontal region) sit side by side and don't overlap, so one slide shows
 * both at once by default; `showCard` / `showArt` let the editor narrow to one.
 */
export type Slide =
  | { kind: "title"; title: string }
  | {
      kind: "card";
      card: Card;
      showCard: boolean;
      showArt: boolean;
      index: number;
    };

export const SCHEMA_VERSION = 1;

/**
 * Derive the ordered slide list a presenter steps through.
 *
 * `cards` must align with `recipe.cards` by index (same resolved identities).
 * Applies `order`, drops `excluded`, and emits one slide per visible card that
 * renders the full card *and* its art together (the default). `recipe.faces`
 * can narrow a card to card-only or art-only. Prepends the title slide. The grid
 * overview is built separately from the same visible cards.
 */
export function recipeToSlides(recipe: LayoutRecipe, cards: Card[]): Slide[] {
  const order = recipe.order ?? cards.map((_, i) => i);
  const excluded = new Set(recipe.excluded ?? []);
  const faces = recipe.faces ?? [];

  const slides: Slide[] = [{ kind: "title", title: recipe.title }];
  for (const i of order) {
    if (i < 0 || i >= cards.length || excluded.has(i)) continue;
    const face = faces[i] ?? FACE_BOTH;
    slides.push({
      kind: "card",
      card: cards[i],
      showCard: face === FACE_CARD || face === FACE_BOTH,
      showArt: face === FACE_ART || face === FACE_BOTH,
      index: i,
    });
  }
  return slides;
}

/** The visible cards (post order/exclude), used for the grid overview. */
export function visibleCards(recipe: LayoutRecipe, cards: Card[]): Card[] {
  const order = recipe.order ?? cards.map((_, i) => i);
  const excluded = new Set(recipe.excluded ?? []);
  return order
    .filter((i) => i >= 0 && i < cards.length && !excluded.has(i))
    .map((i) => cards[i]);
}
