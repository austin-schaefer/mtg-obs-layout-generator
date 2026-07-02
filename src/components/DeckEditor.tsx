/**
 * DeckEditor — the one list that *is* the show (#26). Renders the deck as an
 * ordered column of slide rows (one per `SlideSpec`) and edits it through the pure
 * helpers in `recipe.ts`, so every change flows straight into the live stage the
 * builder previews from the same recipe.
 *
 * One row per slide, addressed by deck position:
 *   - keynote — the branded show title card (no text); a static label.
 *   - title   — a text slide: an inline, edit-in-place text field.
 *   - card    — thumbnail + name + a Both / Card / Art face control, plus an
 *               optional caption (the `+ Text` toggle opens an inline field).
 *   - grid    — a `WxH` field; auto-montages every card slide in the deck.
 *
 * Each row can be reordered (drag with an insertion-line drop indicator, or the
 * ▲▼ fallback), duplicated, removed, and selected (drives the main preview). The
 * footer adds a Keynote, a Text slide, a Grid, or — via an inline Scryfall search
 * — a brand-new Card, always inserted right after the selected slide.
 */

import { Fragment, type ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import {
  cardKey,
  duplicateSlide,
  insertSlide,
  moveSlide,
  placeholderCard,
  removeSlide,
  setCardText,
  setGridArrangement,
  setSlideFace,
  setTitleText,
  FACE_CARD,
  FACE_ART,
  FACE_BOTH,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";
import { searchCards, searchPrintings, type CardOption } from "../lib/resolve.ts";

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

  // Drag-to-reorder, tracked in deck positions. `dropAt` is the *insertion* slot
  // (0..length) the dragged row would land in — rendered as a line between rows.
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  // Inline add-a-card search.
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Printing picker (#31): once a host picks a card *name* from the results, we
  // fetch its printings so they can choose the exact art/frame that lands on the
  // slide. `printingFor` is the chosen name (also drives the sub-view + loading
  // label); `printings` are its fetched options. A card with a single printing
  // skips this step entirely (added straight from the results).
  const [printingFor, setPrintingFor] = useState<CardOption | null>(null);
  const [printings, setPrintings] = useState<CardOption[]>([]);
  const [loadingPrintings, setLoadingPrintings] = useState(false);

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

  const backToResults = () => {
    setPrintingFor(null);
    setPrintings([]);
    setLoadingPrintings(false);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    backToResults();
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
    backToResults();
  };

  // A host clicked a card name in the results: fetch its printings. One printing
  // adds in a single step (no picker); several open the printing sub-view. A
  // fetch failure falls back to adding the card we already have.
  const chooseCard = async (card: CardOption) => {
    setPrintingFor(card);
    setPrintings([]);
    setLoadingPrintings(true);
    try {
      const found = await searchPrintings(card);
      if (found.length <= 1) {
        pickCard(found[0] ?? card);
        return;
      }
      setPrintings(found);
    } catch {
      pickCard(card);
    } finally {
      setLoadingPrintings(false);
    }
  };

  // Distinguish a printing at a glance: set name (or code) + collector number.
  const printingLabel = (c: CardOption) =>
    `${c.setName ?? c.set.toUpperCase()} · #${c.collector}`;

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
                  onChange={onChange}
                  actions={
                    /* Reorder / duplicate / remove — placed in each tile's header
                       row so the tile body below can run the full width. */
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
                  }
                />
              </li>
              {pos === slides.length - 1 && lineAt(slides.length) && <InsertLine />}
            </Fragment>
          );
        })}
      </ul>

      {/* Add controls — everything inserts right after the selected slide.
          Pinned to the bottom of the viewport so adding never needs a scroll
          to the end of a long deck. */}
      <div class="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-rule bg-paper px-4 pb-4 pt-3">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setAdding((a) => {
                if (a) backToResults();
                return !a;
              })
            }
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
            onClick={() => addSlide({ kind: "keynote" })}
            title="The branded show title card (podcast name), no text"
            class="rounded-md border border-rule-strong bg-paper px-2.5 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:border-gold"
          >
            + Keynote
          </button>
          <button
            type="button"
            onClick={() => addSlide({ kind: "grid", arrangement: "" })}
            class="rounded-md border border-rule-strong bg-paper px-2.5 py-1 text-[13px] font-semibold text-ink-soft transition-colors hover:border-gold"
          >
            + Grid
          </button>
        </div>

        {adding && (
          <div class="rounded-md border border-rule bg-paper/70 p-2.5">
            {printingFor ? (
              /* Printing picker (#31): choose which printing lands on the slide. */
              <div>
                <div class="flex items-center justify-between gap-2">
                  <p class="min-w-0 truncate text-[12px] text-ink-soft">
                    {loadingPrintings
                      ? `Loading printings of ${printingFor.name}…`
                      : `Choose a printing of ${printingFor.name}`}
                  </p>
                  <button
                    type="button"
                    onClick={backToResults}
                    class="shrink-0 rounded border border-rule px-2 py-0.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-gold hover:text-maroon"
                  >
                    ← Back
                  </button>
                </div>

                {!loadingPrintings && (
                  <ul class="mt-1.5 flex flex-wrap gap-1.5">
                    {printings.map((p) => (
                      <li key={cardKey(p)}>
                        <button
                          type="button"
                          onClick={() => pickCard(p)}
                          title={`Add ${p.name} — ${printingLabel(p)}`}
                          class="flex w-[76px] flex-col overflow-hidden rounded border border-rule bg-paper text-left transition-colors hover:border-gold focus:border-gold focus:outline-none"
                        >
                          <img
                            src={p.cardImage}
                            alt={`${p.name} — ${printingLabel(p)}`}
                            loading="lazy"
                            class="w-full"
                          />
                          <span class="truncate px-1 py-0.5 text-[10px] leading-tight text-ink-muted">
                            {printingLabel(p)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
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
                    <p class="mt-2 text-[12px] text-ink-muted">
                      Click a card to choose its printing.
                    </p>
                    <ul class="mt-1.5 flex flex-wrap gap-1.5">
                      {results.map((card) => (
                        <li key={cardKey(card)}>
                          <button
                            type="button"
                            onClick={() => chooseCard(card)}
                            title={`Choose a printing of ${card.name}`}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The type-specific body of a deck tile, including the row-action buttons in its
 *  header so keynote/text/grid stay one-line and a card tile's body runs full width. */
function SlideBody({
  slide,
  pos,
  recipe,
  byId,
  onChange,
  actions,
}: {
  slide: LayoutRecipe["slides"][number];
  pos: number;
  recipe: LayoutRecipe;
  byId: Map<string, Card>;
  onChange: (next: LayoutRecipe) => void;
  actions: ComponentChildren;
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
        <span class="flex-1" />
        {actions}
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
        {actions}
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
        <span class="flex-1" />
        {actions}
      </div>
    );
  }

  const card = byId.get(cardKey(slide)) ?? placeholderCard(slide);
  const face = slide.face;
  // Taller thumbnail on the left; a header row (name + actions) with the face
  // control and optional caption stacked below, each filling the full tile width
  // (the actions live in the header, so nothing reserves a column beside them).
  return (
    <div class="flex min-w-0 flex-1 items-start gap-2.5">
      <img
        src={card.cardImage}
        alt=""
        loading="lazy"
        draggable={false}
        class="h-24 w-auto shrink-0 rounded-sm border border-rule"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-start gap-2">
          <span class="min-w-0 flex-1 truncate pt-0.5 text-[14px] leading-tight text-ink">
            {card.name}
          </span>
          {actions}
        </div>

        {/* Face — a joined segmented control that fills the tile width. */}
        <div
          class="flex w-full overflow-hidden rounded border border-rule"
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

        {/* Optional caption — a broadcast lower-third between the host cams. The
            field spans the row to line up with the face control above it; the
            remove ✕ tucks inside on the right. `+ Caption` opens an empty field. */}
        {typeof slide.text === "string" ? (
          <div class="relative">
            <input
              type="text"
              value={slide.text}
              placeholder="Caption text"
              // Focus the field the moment it opens so a host can type straight away.
              ref={(el) => el && slide.text === "" && el.focus()}
              onInput={(e) =>
                onChange(setCardText(recipe, pos, (e.target as HTMLInputElement).value))
              }
              class="w-full rounded border border-rule bg-paper py-0.5 pl-2 pr-7 text-[13px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
              aria-label="Card caption"
            />
            <button
              type="button"
              onClick={() => onChange(setCardText(recipe, pos, undefined))}
              aria-label="Remove caption"
              title="Remove caption"
              class="absolute inset-y-0 right-0 flex items-center px-2 text-[12px] text-ink-muted transition-colors hover:text-maroon"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange(setCardText(recipe, pos, ""))}
            title="Add a caption below the card, between the host cams"
            class="self-start rounded border border-rule px-2 py-0.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-gold hover:text-maroon"
          >
            + Caption
          </button>
        )}
      </div>
    </div>
  );
}
