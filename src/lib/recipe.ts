/**
 * The layout deck — the single shared data model.
 *
 * A recipe is a **deck**: an ordered list of typed slides. That deck *is* the
 * document — Generate seeds it once, and every edit afterward reorders, edits,
 * adds, removes, or duplicates entries in this one list. It is the exact shape the
 * permalink encodes (`permalink.ts`) and the renderer consumes (`buildSlides`), so
 * the builder, the URL, and the stage all speak one language.
 *
 * Slide types:
 *   - **keynote** — the branded show title card (the Clock Spinning wordmark +
 *     host-frame chrome); no text of its own.
 *   - **title** — a text card: arbitrary text on the same broadcast surface.
 *   - **card**  — a resolved card identity (`set`/`collector`) + a face, plus an
 *     optional caption rendered as a lower-third between the host cams.
 *   - **grid**  — an auto-montage of *all* card slides in the deck (kept in sync).
 *
 * Image URLs are NOT part of the recipe — only resolved card *identities* are.
 * URLs are reconstructed at render time (live, from Scryfall — or the mock catalog
 * for the demo reel), which is what keeps the permalink deterministic and small.
 */

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

export const FACE_CARD = 0;
export const FACE_ART = 1;
export const FACE_BOTH = 2;

/**
 * One entry in the deck. `card` faces: `0` full card only, `1` art only, `2` both
 * (the default — the full card and its art sit side by side and don't overlap, so
 * one slide shows both at once). `grid` arrangement is `WxH`, `0` = auto.
 */
export type SlideSpec =
  | { kind: "keynote" }
  | { kind: "title"; text: string }
  | { kind: "card"; set: string; collector: string; face: number; text?: string }
  | { kind: "grid"; arrangement: string };

export interface LayoutRecipe {
  /** Schema version, so the decoder can reject/migrate older URLs. */
  v: number;
  /** The deck — the ordered list of slides that *is* the show. */
  slides: SlideSpec[];
}

export const SCHEMA_VERSION = 2;

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
 * A rendered slide — what the stage draws. Derived from a `SlideSpec` by resolving
 * card identities to real artwork (`buildSlides`). A `card` slide can show the full
 * card, its art, or both; a `grid` slide carries the montaged cards.
 */
export type Slide =
  | { kind: "keynote" }
  | { kind: "title"; title: string }
  | { kind: "card"; card: Card; showCard: boolean; showArt: boolean; text?: string }
  | { kind: "grid"; cards: Card[]; arrangement: string };

// ── Card identity plumbing ──────────────────────────────────────────────────

/** Canonical identity key for a card ref (case-insensitive set). */
export function cardKey(ref: CardRef): string {
  return `${ref.set.toLowerCase()}/${ref.collector}`;
}

/** The identities of every card slide, in deck order (duplicates preserved). */
export function cardRefs(recipe: LayoutRecipe): CardRef[] {
  const refs: CardRef[] = [];
  for (const s of recipe.slides) {
    if (s.kind === "card") refs.push({ set: s.set, collector: s.collector });
  }
  return refs;
}

/** Index resolved cards by identity, for `buildSlides` to look up. */
export function cardMapFrom(cards: Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [cardKey(c), c]));
}

/**
 * Derive the ordered rendered slides the presenter steps through.
 *
 * `byId` resolves card identities to real artwork; a missing identity renders as a
 * placeholder so the deck still steps in order. A **grid slide montages every card
 * slide currently in the deck** (in deck order), so it stays in sync automatically
 * as cards are added / removed / reordered — no separate grid state to maintain.
 */
export function buildSlides(
  recipe: LayoutRecipe,
  byId: Map<string, Card>,
): Slide[] {
  const lookup = (ref: CardRef): Card =>
    byId.get(cardKey(ref)) ?? placeholderCard(ref);
  const gridCards = cardRefs(recipe).map(lookup);

  return recipe.slides.map((s): Slide => {
    if (s.kind === "keynote") return { kind: "keynote" };
    if (s.kind === "title") return { kind: "title", title: s.text };
    if (s.kind === "grid") {
      return { kind: "grid", cards: gridCards, arrangement: s.arrangement };
    }
    const card = lookup(s);
    return {
      kind: "card",
      card,
      showCard: s.face !== FACE_ART,
      showArt: s.face !== FACE_CARD,
      ...(s.text ? { text: s.text } : {}),
    };
  });
}

// ── Deck edits ──────────────────────────────────────────────────────────────
// Pure recipe→recipe edits addressed by deck *position* (0-based). Each returns a
// new recipe; an out-of-range position is a no-op. Positions are stable slide
// indices — since one SlideSpec renders one slide, a deck position is a slide index.

const withSlides = (recipe: LayoutRecipe, slides: SlideSpec[]): LayoutRecipe => ({
  ...recipe,
  slides,
});

/** Insert `spec` at `pos` (clamped to the deck bounds). */
export function insertSlide(
  recipe: LayoutRecipe,
  pos: number,
  spec: SlideSpec,
): LayoutRecipe {
  const at = Math.max(0, Math.min(pos, recipe.slides.length));
  const slides = [...recipe.slides];
  slides.splice(at, 0, spec);
  return withSlides(recipe, slides);
}

/** Move the slide at `from` to `to` (both display positions). */
export function moveSlide(
  recipe: LayoutRecipe,
  from: number,
  to: number,
): LayoutRecipe {
  const n = recipe.slides.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return recipe;
  const slides = [...recipe.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  return withSlides(recipe, slides);
}

/** Remove the slide at `pos`. */
export function removeSlide(recipe: LayoutRecipe, pos: number): LayoutRecipe {
  if (pos < 0 || pos >= recipe.slides.length) return recipe;
  const slides = [...recipe.slides];
  slides.splice(pos, 1);
  return withSlides(recipe, slides);
}

/** Duplicate the slide at `pos`, inserting the copy right after it. */
export function duplicateSlide(recipe: LayoutRecipe, pos: number): LayoutRecipe {
  if (pos < 0 || pos >= recipe.slides.length) return recipe;
  const slides = [...recipe.slides];
  slides.splice(pos + 1, 0, { ...slides[pos] });
  return withSlides(recipe, slides);
}

/** Replace the slide at `pos` with `next` (guards kind at the call site). */
function replaceSlide(
  recipe: LayoutRecipe,
  pos: number,
  next: SlideSpec,
): LayoutRecipe {
  if (pos < 0 || pos >= recipe.slides.length) return recipe;
  const slides = [...recipe.slides];
  slides[pos] = next;
  return withSlides(recipe, slides);
}

/** Set a title slide's text. */
export function setTitleText(
  recipe: LayoutRecipe,
  pos: number,
  text: string,
): LayoutRecipe {
  const s = recipe.slides[pos];
  if (s?.kind !== "title") return recipe;
  return replaceSlide(recipe, pos, { ...s, text });
}

/** Set a card slide's face (card / art / both). */
export function setSlideFace(
  recipe: LayoutRecipe,
  pos: number,
  face: number,
): LayoutRecipe {
  const s = recipe.slides[pos];
  if (s?.kind !== "card") return recipe;
  return replaceSlide(recipe, pos, { ...s, face });
}

/**
 * Set a card slide's caption text — `undefined` removes the caption entirely
 * (distinct from an empty string, which the editor uses to show an empty field).
 */
export function setCardText(
  recipe: LayoutRecipe,
  pos: number,
  text: string | undefined,
): LayoutRecipe {
  const s = recipe.slides[pos];
  if (s?.kind !== "card") return recipe;
  const next: SlideSpec = { ...s };
  if (text === undefined) delete next.text;
  else next.text = text;
  return replaceSlide(recipe, pos, next);
}

/** Set a grid slide's `WxH` arrangement (blank ⇒ auto). */
export function setGridArrangement(
  recipe: LayoutRecipe,
  pos: number,
  arrangement: string,
): LayoutRecipe {
  const s = recipe.slides[pos];
  if (s?.kind !== "grid") return recipe;
  return replaceSlide(recipe, pos, { ...s, arrangement: arrangement.trim() });
}
