/**
 * DeckEditor — the one list that *is* the show (#26). Renders the deck as an
 * ordered column of slide rows (one per `SlideSpec`) and edits it through the pure
 * helpers in `recipe.ts`, so every change flows straight into the live stage the
 * builder previews from the same recipe.
 *
 * One row per slide, addressed by deck position:
 *   - keynote — the branded show title card (no text); a static label.
 *   - title   — a text slide: an inline, edit-in-place text field.
 *   - card    — thumbnail + name + a Both / Card / Art face control.
 *   - grid    — a `WxH` field; auto-montages every card slide in the deck.
 *
 * Each row can be reordered (drag with an insertion-line drop indicator, or the
 * ▲▼ fallback), duplicated, removed, and selected (drives the main preview). The
 * footer adds a Keynote, a Text slide, a Grid, or — via an inline Scryfall search
 * — a brand-new Card, always inserted right after the selected slide.
 */

import { Fragment } from "preact";
import { useState } from "preact/hooks";
import {
  cardKey,
  duplicateSlide,
  insertSlide,
  moveSlide,
  placeholderCard,
  removeSlide,
  setGridArrangement,
  setSlideFace,
  setTitleText,
  FACE_CARD,
  FACE_ART,
  FACE_BOTH,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";
import { searchCards } from "../lib/resolve.ts";

const FACES: { code: number; label: string; title: string }[] = [
  { code: FACE_BOTH, label: "Both", title: "Show the full card and its art" },
  { code: FACE_CARD, label: "Card", title: "Show the full card only" },
  { code: FACE_ART, label: "Art", title: "Show the art crop only" },
];

interface Props {
  recipe: LayoutRecipe;
  /** Resolved cards indexed by identity (`cardMapFrom`), for thumbnails + names. */
  byId: Map<string, Card>;
  /** The deck position currently previewed in the main column. */
  selected: number;
  onChange: (next: LayoutRecipe) => void;
  onSelect: (pos: number) => void;
  /** Insert a net-new searched card after the selected slide (builder owns the
   *  catalog it's added to). */
  onAddCard: (card: Card) => void;
}

export default function DeckEditor({
  recipe,
  byId,
  selected,
  onChange,
  onSelect,
  onAddCard,
}: Props) {
  const slides = recipe.slides;
  const cardCount = slides.filter((s) => s.kind === "card").length;

  // Drag-to-reorder, tracked in deck positions. `dropAt` is the *insertion* slot
  // (0..length) the dragged row would land in — rendered as a line between rows.
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  // Inline add-a-card search.
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const commitDrop = () => {
    if (dragFrom !== null && dropAt !== null) {
      // The insertion slot is in pre-removal coordinates; shift when the row moves
      // down past its own old slot.
      const to = dragFrom < dropAt ? dropAt - 1 : dropAt;
      if (to !== dragFrom) {
        onChange(moveSlide(recipe, dragFrom, to));
        onSelect(to);
      }
    }
    setDragFrom(null);
    setDropAt(null);
  };

  // A line is meaningful only when it represents a real move (not the two slots
  // flanking the dragged row, which are no-ops).
  const lineAt = (slot: number) =>
    dragFrom !== null &&
    dropAt === slot &&
    dropAt !== dragFrom &&
    dropAt !== dragFrom + 1;

  const InsertLine = () => (
    <li aria-hidden="true" class="-my-1 h-[3px] rounded-full bg-gold" />
  );

  // Where a new slide lands: right after the selected one (clamped).
  const insertAt = Math.min(selected + 1, slides.length);
  const addSlide = (spec: Parameters<typeof insertSlide>[2]) => {
    onChange(insertSlide(recipe, insertAt, spec));
    onSelect(insertAt);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchCards(q);
      setResults(found);
      if (found.length === 0) setSearchError(`No cards matched “${q}”.`);
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const pickCard = (card: Card) => {
    onAddCard(card);
    setAdding(false);
    setQuery("");
    setResults([]);
    setSearchError(null);
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-baseline justify-between">
        <span class="text-[13px] font-semibold text-ink-soft">Deck</span>
        <span class="text-[12px] tabular-nums text-ink-muted">
          {slides.length} slide{slides.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul class="flex flex-col gap-2">
        {slides.map((slide, pos) => {
          const isSelected = pos === selected;
          return (
            <Fragment key={pos}>
              {lineAt(pos) && <InsertLine />}
              <li
                draggable
                onDragStart={() => setDragFrom(pos)}
                onDragOver={(e) => {
                  e.preventDefault();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const after = e.clientY > r.top + r.height / 2;
                  const slot = after ? pos + 1 : pos;
                  if (dropAt !== slot) setDropAt(slot);
                }}
                onDrop={commitDrop}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDropAt(null);
                }}
                onClick={() => onSelect(pos)}
                class={[
                  "flex items-start gap-2.5 rounded-md border bg-paper px-2 py-1.5 transition-colors",
                  isSelected ? "border-maroon ring-1 ring-maroon" : "border-rule",
                  dragFrom === pos ? "opacity-40" : "",
                ].join(" ")}
              >
                <span
                  class="mt-0.5 cursor-grab select-none text-[15px] leading-none text-ink-muted"
                  aria-hidden="true"
                  title="Drag to reorder"
                >
                  ⠿
                </span>

                <SlideBody
                  slide={slide}
                  pos={pos}
                  recipe={recipe}
                  byId={byId}
                  cardCount={cardCount}
                  onChange={onChange}
                />

                {/* Row actions — reorder / duplicate / remove. */}
                <span class="flex shrink-0 items-center gap-1">
                  <span class="flex flex-col overflow-hidden rounded border border-rule leading-none">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(moveSlide(recipe, pos, pos - 1));
                        onSelect(pos - 1);
                      }}
                      disabled={pos === 0}
                      aria-label="Move up"
                      class="px-1 py-px text-[9px] text-ink-muted hover:bg-marble hover:text-maroon disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(moveSlide(recipe, pos, pos + 1));
                        onSelect(pos + 1);
                      }}
                      disabled={pos === slides.length - 1}
                      aria-label="Move down"
                      class="border-t border-rule px-1 py-px text-[9px] text-ink-muted hover:bg-marble hover:text-maroon disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(duplicateSlide(recipe, pos));
                      onSelect(pos + 1);
                    }}
                    aria-label="Duplicate slide"
                    title="Duplicate"
                    class="rounded border border-rule px-1.5 text-[12px] leading-6 text-ink-soft transition-colors hover:border-maroon hover:text-maroon"
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(removeSlide(recipe, pos));
                      onSelect(Math.max(0, pos - 1));
                    }}
                    aria-label="Remove slide"
                    title="Remove"
                    class="rounded border border-rule px-1.5 text-[13px] font-semibold leading-6 text-ink-soft transition-colors hover:border-maroon hover:text-maroon"
                  >
                    ✕
                  </button>
                </span>
              </li>
              {pos === slides.length - 1 && lineAt(slides.length) && <InsertLine />}
            </Fragment>
          );
        })}
      </ul>

      {/* Add controls — everything inserts right after the selected slide. */}
      <div class="flex flex-col gap-2 border-t border-rule pt-3">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addSlide({ kind: "keynote" })}
            title="The branded show title card (podcast name), no text"
            class="rounded-md border border-rule-strong bg-paper px-2.5 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:border-gold"
          >
            + Keynote
          </button>
          <button
            type="button"
            onClick={() => addSlide({ kind: "title", text: "New text" })}
            title="Arbitrary text on the broadcast surface"
            class="rounded-md border border-rule-strong bg-paper px-2.5 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:border-gold"
          >
            + Text
          </button>
          <button
            type="button"
            onClick={() => addSlide({ kind: "grid", arrangement: "4x0" })}
            class="rounded-md border border-rule-strong bg-paper px-2.5 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:border-gold"
          >
            + Grid
          </button>
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            aria-expanded={adding}
            class={[
              "rounded-md border px-2.5 py-1 text-[13px] font-semibold transition-colors",
              adding
                ? "border-maroon bg-maroon text-paper"
                : "border-rule-strong bg-paper text-ink-soft hover:border-gold",
            ].join(" ")}
          >
            + Card
          </button>
        </div>

        {adding && (
          <div class="rounded-md border border-rule bg-paper/70 p-2.5">
            <form
              class="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!searching) runSearch();
              }}
            >
              <input
                type="text"
                value={query}
                placeholder="Search Scryfall, e.g. lightning bolt"
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                class="min-w-0 flex-1 rounded-md border border-rule-strong bg-paper px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
                aria-label="Search cards to add"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                class="rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[13px] font-semibold text-maroon transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? "…" : "Search"}
              </button>
            </form>

            {searchError && (
              <p class="mt-2 text-[12px] text-maroon" role="alert">
                {searchError}
              </p>
            )}

            {results.length > 0 && (
              <>
                <p class="mt-2 text-[12px] text-ink-muted">Click a card to add it.</p>
                <ul class="mt-1.5 flex flex-wrap gap-1.5">
                  {results.map((card) => (
                    <li key={cardKey(card)}>
                      <button
                        type="button"
                        onClick={() => pickCard(card)}
                        title={`Add ${card.name}`}
                        class="block overflow-hidden rounded border border-rule bg-paper transition-colors hover:border-gold focus:border-gold focus:outline-none"
                      >
                        <img
                          src={card.cardImage}
                          alt={card.name}
                          loading="lazy"
                          class="h-24 w-auto"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The type-specific middle of a deck row. */
function SlideBody({
  slide,
  pos,
  recipe,
  byId,
  cardCount,
  onChange,
}: {
  slide: LayoutRecipe["slides"][number];
  pos: number;
  recipe: LayoutRecipe;
  byId: Map<string, Card>;
  cardCount: number;
  onChange: (next: LayoutRecipe) => void;
}) {
  const Badge = ({ children }: { children: string }) => (
    <span class="shrink-0 rounded bg-marble px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      {children}
    </span>
  );

  if (slide.kind === "keynote") {
    return (
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Badge>Keynote</Badge>
        <span class="truncate text-[13px] text-ink-muted">
          Clock Spinning title card
        </span>
      </div>
    );
  }

  if (slide.kind === "title") {
    return (
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Badge>Text</Badge>
        <input
          type="text"
          value={slide.text}
          placeholder="Slide text"
          onInput={(e) =>
            onChange(setTitleText(recipe, pos, (e.target as HTMLInputElement).value))
          }
          class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-serif text-[14px] text-ink hover:border-rule focus:border-gold focus:bg-paper focus:outline-none"
          aria-label="Slide text"
        />
      </div>
    );
  }

  if (slide.kind === "grid") {
    return (
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Badge>Grid</Badge>
        <input
          type="text"
          value={slide.arrangement}
          placeholder="auto"
          onInput={(e) =>
            onChange(
              setGridArrangement(recipe, pos, (e.target as HTMLInputElement).value),
            )
          }
          class="w-20 rounded border border-rule-strong bg-paper px-2 py-0.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
          aria-label="Grid arrangement, columns by rows"
        />
        <span class="truncate text-[12px] text-ink-muted">
          montages {cardCount} card{cardCount === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  const card = byId.get(cardKey(slide)) ?? placeholderCard(slide);
  const face = slide.face;
  return (
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex items-center gap-2">
        <img
          src={card.cardImage}
          alt=""
          loading="lazy"
          draggable={false}
          class="h-11 w-auto shrink-0 rounded-sm border border-rule"
        />
        <span class="min-w-0 flex-1 truncate text-[14px] text-ink">{card.name}</span>
      </div>

      {/* Face — a joined segmented control. */}
      <div
        class="flex overflow-hidden rounded border border-rule"
        role="group"
        aria-label="Card face"
      >
        {FACES.map((f, fi) => {
          const on = face === f.code;
          return (
            <button
              key={f.code}
              type="button"
              onClick={() => onChange(setSlideFace(recipe, pos, f.code))}
              aria-pressed={on}
              title={f.title}
              class={[
                "flex-1 px-2 py-0.5 text-[12px] font-semibold transition-colors",
                fi > 0 ? "border-l border-rule" : "",
                on ? "bg-maroon text-paper" : "bg-paper text-ink-soft hover:bg-marble",
              ].join(" ")}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
