/**
 * LayoutEditor — the hand-edit panel (#15). Turns a resolved deck into an
 * arrangeable show: drop a card, reorder the deck, set the grid `WxH`, and pick
 * each card's face (full card / art / both). Every control writes the recipe
 * through the pure helpers in `recipe.ts`, so an edit flows straight into the
 * live stage + grid preview the builder renders from the same recipe.
 *
 * All indices here are `recipe.cards` indices (see `displayOrder`), never display
 * slots — reordering permutes `order`, excluding toggles `excluded`, both keyed
 * to the original identities so the permalink stays faithful.
 */

import { Fragment } from "preact";
import { useState } from "preact/hooks";
import {
  displayOrder,
  moveCard,
  toggleExcluded,
  setFace,
  setGrid,
  FACE_CARD,
  FACE_ART,
  FACE_BOTH,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";

const FACES: { code: number; label: string; title: string }[] = [
  { code: FACE_BOTH, label: "Both", title: "Show the full card and its art" },
  { code: FACE_CARD, label: "Card", title: "Show the full card only" },
  { code: FACE_ART, label: "Art", title: "Show the art crop only" },
];

interface Props {
  recipe: LayoutRecipe;
  /** Resolved cards, aligned to `recipe.cards` by index. */
  cards: Card[];
  onChange: (next: LayoutRecipe) => void;
  /** Jump the preview to a card's slide (by `recipe.cards` index). */
  onJump: (index: number) => void;
}

export default function LayoutEditor({ recipe, cards, onChange, onJump }: Props) {
  const order = displayOrder(recipe);
  const excluded = new Set(recipe.excluded ?? []);
  const kept = order.filter((i) => !excluded.has(i)).length;

  // Drag-to-reorder, tracked in display positions. `dropAt` is the *insertion*
  // slot (0..length) the dragged row would land in — rendered as a line between
  // rows, the standard "where it'll go" affordance.
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const commitDrop = () => {
    if (dragFrom !== null && dropAt !== null) {
      // The insertion slot is in pre-removal coordinates; shift when the row
      // moves down past its own old slot.
      const to = dragFrom < dropAt ? dropAt - 1 : dropAt;
      if (to !== dragFrom) onChange(moveCard(recipe, dragFrom, to));
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

  return (
    <div class="flex flex-col gap-5">
      {/* Grid arrangement */}
      <label class="block">
        <span class="text-[13px] font-semibold text-ink-soft">Grid arrangement</span>
        <input
          type="text"
          value={recipe.grid ?? ""}
          placeholder="auto"
          onInput={(e) => onChange(setGrid(recipe, (e.target as HTMLInputElement).value))}
          class="mt-1 w-full rounded-md border border-rule-strong bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
          aria-label="Grid arrangement, columns by rows"
        />
        <span class="mt-1 block text-[12px] text-ink-muted">
          Columns × rows (0 = auto), e.g. 4x4 or 8x0. Blank = auto.
        </span>
      </label>

      {/* Card list */}
      <div>
        <div class="flex items-baseline justify-between">
          <span class="text-[13px] font-semibold text-ink-soft">Cards</span>
          <span class="text-[12px] tabular-nums text-ink-muted">
            {kept} of {order.length} shown
          </span>
        </div>

        <ul class="mt-2 flex flex-col gap-2">
          {order.map((cardIndex, pos) => {
            const card = cards[cardIndex];
            const isExcluded = excluded.has(cardIndex);
            const face = recipe.faces?.[cardIndex] ?? FACE_BOTH;
            return (
              <Fragment key={`${card.set}-${card.collector}-${cardIndex}`}>
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
                  class={[
                    "flex items-center gap-2.5 rounded-md border border-rule bg-paper px-2 py-1.5 transition-opacity",
                    isExcluded ? "opacity-55" : "",
                    dragFrom === pos ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <span
                    class="cursor-grab select-none text-[15px] leading-none text-ink-muted"
                    aria-hidden="true"
                    title="Drag to reorder"
                  >
                    ⠿
                  </span>

                  <img
                    src={card.cardImage}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    class="h-11 w-auto shrink-0 rounded-sm border border-rule"
                  />

                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onJump(cardIndex)}
                        title={`Jump to ${card.name}`}
                        class={[
                          "min-w-0 flex-1 truncate text-left text-[14px] text-ink transition-colors hover:text-maroon",
                          isExcluded ? "line-through" : "",
                        ].join(" ")}
                      >
                        {card.name}
                      </button>

                      {/* Reorder stepper — the accessible path drag can't cover. */}
                      <span class="flex shrink-0 flex-col overflow-hidden rounded border border-rule leading-none">
                        <button
                          type="button"
                          onClick={() => onChange(moveCard(recipe, pos, pos - 1))}
                          disabled={pos === 0}
                          aria-label="Move up"
                          class="px-1 py-px text-[9px] text-ink-muted hover:bg-marble hover:text-maroon disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(moveCard(recipe, pos, pos + 1))}
                          disabled={pos === order.length - 1}
                          aria-label="Move down"
                          class="border-t border-rule px-1 py-px text-[9px] text-ink-muted hover:bg-marble hover:text-maroon disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>

                      <button
                        type="button"
                        onClick={() => onChange(toggleExcluded(recipe, cardIndex))}
                        aria-pressed={isExcluded}
                        title={isExcluded ? "Include in the show" : "Exclude from the show"}
                        class="shrink-0 rounded border border-rule px-1.5 text-[13px] font-semibold leading-6 text-ink-soft transition-colors hover:border-maroon hover:text-maroon"
                      >
                        {isExcluded ? "＋" : "✕"}
                      </button>
                    </div>

                    {/* Face — a joined segmented control, one unit under the name. */}
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
                            onClick={() => onChange(setFace(recipe, cardIndex, f.code))}
                            disabled={isExcluded}
                            aria-pressed={on}
                            title={f.title}
                            class={[
                              "flex-1 px-2 py-0.5 text-[12px] font-semibold transition-colors disabled:opacity-40",
                              fi > 0 ? "border-l border-rule" : "",
                              on
                                ? "bg-maroon text-paper"
                                : "bg-paper text-ink-soft hover:bg-marble",
                            ].join(" ")}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
                {pos === order.length - 1 && lineAt(order.length) && <InsertLine />}
              </Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
