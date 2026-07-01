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

  // Drag-to-reorder state, tracked in display positions (indices into `order`).
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const drop = (to: number) => {
    if (dragFrom !== null && dragFrom !== to) onChange(moveCard(recipe, dragFrom, to));
    setDragFrom(null);
    setDragOver(null);
  };

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
        <p class="mt-1 text-[12px] text-ink-muted">
          Drag to reorder · pick a face · exclude to drop a card.
        </p>

        <ul class="mt-2 flex flex-col gap-1.5">
          {order.map((cardIndex, pos) => {
            const card = cards[cardIndex];
            const isExcluded = excluded.has(cardIndex);
            const face = recipe.faces?.[cardIndex] ?? FACE_BOTH;
            return (
              <li
                key={`${card.set}-${card.collector}-${cardIndex}`}
                draggable
                onDragStart={() => setDragFrom(pos)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== pos) setDragOver(pos);
                }}
                onDrop={() => drop(pos)}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                class={[
                  "rounded-md border bg-paper p-2 transition-colors",
                  dragOver === pos && dragFrom !== null
                    ? "border-gold"
                    : "border-rule",
                  isExcluded ? "opacity-55" : "",
                  dragFrom === pos ? "opacity-40" : "",
                ].join(" ")}
              >
                <div class="flex items-center gap-2">
                  <span
                    class="cursor-grab select-none text-[15px] leading-none text-ink-muted"
                    aria-hidden="true"
                    title="Drag to reorder"
                  >
                    ⠿
                  </span>
                  <button
                    type="button"
                    onClick={() => onJump(cardIndex)}
                    title={`Jump to ${card.name}`}
                    class="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <img
                      src={card.cardImage}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      class="h-9 w-auto shrink-0 rounded-sm border border-rule"
                    />
                    <span
                      class={[
                        "truncate text-[14px] text-ink",
                        isExcluded ? "line-through" : "",
                      ].join(" ")}
                    >
                      {card.name}
                    </span>
                  </button>

                  {/* Reorder (accessible fallback for drag) */}
                  <span class="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => onChange(moveCard(recipe, pos, pos - 1))}
                      disabled={pos === 0}
                      aria-label="Move up"
                      class="px-1 text-[11px] leading-tight text-ink-muted hover:text-maroon disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(moveCard(recipe, pos, pos + 1))}
                      disabled={pos === order.length - 1}
                      aria-label="Move down"
                      class="px-1 text-[11px] leading-tight text-ink-muted hover:text-maroon disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </span>

                  <button
                    type="button"
                    onClick={() => onChange(toggleExcluded(recipe, cardIndex))}
                    aria-pressed={isExcluded}
                    title={isExcluded ? "Include in the show" : "Exclude from the show"}
                    class="shrink-0 rounded border border-rule px-1.5 py-0.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-maroon hover:text-maroon"
                  >
                    {isExcluded ? "＋" : "✕"}
                  </button>
                </div>

                {/* Per-card face */}
                <div class="mt-1.5 flex gap-1 pl-6" role="group" aria-label="Card face">
                  {FACES.map((f) => {
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
                          "rounded border px-2 py-0.5 text-[12px] font-semibold transition-colors disabled:opacity-40",
                          on
                            ? "border-maroon bg-maroon text-paper"
                            : "border-rule text-ink-soft hover:border-gold",
                        ].join(" ")}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
