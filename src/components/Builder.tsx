/**
 * Builder — the creation surface (#12). The front door to the live builder:
 * pick a mode, give it an input, generate a deck, then preview it on the
 * broadcast stage and hand off to the presenter.
 *
 * Card resolution goes through `resolveDeck` — a live Scryfall search (#14) or a
 * booster roll (#17) — and the edit-controls panel is the layout editor (#15):
 * reorder, exclude, grid, and per-card face, all previewing live.
 * What's live today: mode selection, per-mode inputs, generate, the results
 * strip, the stage + grid preview with slide stepping, the layout editor, and
 * the permalink handoff.
 *
 * UI chrome uses the design-system Tailwind tokens; the stage preview reuses the
 * exact broadcast components (<StageFrame>/<Stage>) the presenter renders, so
 * what you see here is what streams.
 */

import { useCallback, useMemo, useState } from "preact/hooks";
import {
  recipeToSlides,
  visibleIndices,
  SCHEMA_VERSION,
  type LayoutRecipe,
  type Mode,
} from "../lib/recipe.ts";
import { resolveCards } from "../lib/mock-cards.ts";
import { resolveDeck, ResolveError } from "../lib/resolve.ts";
import type { Card } from "../lib/recipe.ts";
import { encodeRecipe } from "../lib/permalink.ts";
import StageFrame from "./stage/StageFrame.tsx";
import Stage from "./stage/Stage.tsx";
import GridOverview from "./stage/GridOverview.tsx";
import LayoutEditor from "./LayoutEditor.tsx";
import Presenter from "./Presenter.tsx";

const DEFAULT_GRID = "4x0";

/**
 * Default Scryfall query the search field starts with: the oldest paper printing
 * of each card, in release order, excluding digital-only, un-set, and Universes
 * Beyond cards. Hosts append their own criteria after it.
 */
const DEFAULT_SCRY_QUERY =
  "prefer:oldest order:released dir:asc -is:digital -is:funny -is:universesbeyond ";

interface ModeDef {
  id: Mode;
  label: string;
  /** Placeholder for the input box; absent ⇒ no input (custom). */
  placeholder?: string;
  hint: string;
  comingSoon?: boolean;
}

const MODES: ModeDef[] = [
  {
    id: "scry",
    label: "Scryfall search",
    placeholder: "e.g. set:neo type:legendary",
    hint: "Resolve a Scryfall search query into a deck of cards.",
  },
  {
    id: "boost",
    label: "Booster pack",
    placeholder: "e.g. NEO",
    hint: "Roll a random booster pack from a set code.",
  },
  {
    id: "custom",
    label: "Custom images",
    hint: "Bring your own paired card + art images.",
    comingSoon: true,
  },
];

export default function Builder() {
  const [mode, setMode] = useState<Mode>("scry");
  // Keep a separate input per mode so switching modes doesn't clobber a query.
  const [inputs, setInputs] = useState<Record<Mode, string>>({
    scry: DEFAULT_SCRY_QUERY,
    boost: "",
    custom: "",
  });
  const [recipe, setRecipe] = useState<LayoutRecipe | null>(null);
  // The cards just resolved for `recipe`, keyed back into render via their
  // identities. The live modes (Scryfall/booster) carry real image URLs here, so
  // the preview renders the actual artwork rather than re-resolving from a catalog.
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewGrid, setViewGrid] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeMode = MODES.find((m) => m.id === mode)!;

  const cards = useMemo(
    () => (recipe ? resolveCards(recipe, catalog) : []),
    [recipe, catalog],
  );
  const slides = useMemo(
    () => (recipe ? recipeToSlides(recipe, cards) : []),
    [recipe, cards],
  );
  // Visible cards for the grid + strip, each paired with its real `cards` index
  // so jumping and slide-lookup key off identity, not display position.
  const thumbs = useMemo(
    () =>
      recipe
        ? visibleIndices(recipe, cards.length).map((i) => ({
            card: cards[i],
            index: i,
          }))
        : [],
    [recipe, cards],
  );
  const gridCards = useMemo(() => thumbs.map((t) => t.card), [thumbs]);

  const generate = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const { cards: resolved, title, grid } = await resolveDeck(mode, inputs[mode]);
      setCatalog(resolved);
      setRecipe({
        v: SCHEMA_VERSION,
        mode,
        title,
        cards: resolved.map(({ set, collector }) => ({ set, collector })),
        grid: grid ?? DEFAULT_GRID,
      });
      setSlideIndex(0);
    } catch (err) {
      setError(
        err instanceof ResolveError
          ? err.message
          : "Something went wrong resolving that. Try again.",
      );
      setRecipe(null);
    } finally {
      setPending(false);
    }
  }, [mode, inputs]);

  const setTitle = useCallback((title: string) => {
    setRecipe((r) => (r ? { ...r, title } : r));
  }, []);

  const copyLink = useCallback(() => {
    if (!recipe) return;
    const url = `${window.location.origin}/present?r=${encodeRecipe(recipe)}`;
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      done();
    }
  }, [recipe]);

  const last = slides.length - 1;
  const step = (delta: number) =>
    setSlideIndex((i) => Math.min(last, Math.max(0, i + delta)));
  // Jump the preview to a card's slide (by real `cards` index), leaving grid view.
  const jumpToCard = (cardIndex: number) => {
    const at = slides.findIndex(
      (s) => s.kind === "card" && s.index === cardIndex,
    );
    if (at >= 0) {
      setViewGrid(false);
      setSlideIndex(at);
    }
  };

  return (
    <div class="font-sans">
      {/* ── Composer bar: mode picker + per-mode input + generate ───────── */}
      <section
        class="rounded-lg border border-rule bg-gradient-to-b from-panel-from to-panel-to p-5 tablet:p-6"
        aria-label="Build a layout"
      >
        <div
          class="inline-flex flex-wrap gap-1 rounded-md border border-rule-strong bg-paper/60 p-1"
          role="tablist"
          aria-label="Card source"
        >
          {MODES.map((m) => {
            const selected = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={m.comingSoon}
                onClick={() => {
                  setMode(m.id);
                  setError(null);
                }}
                class={[
                  "rounded px-3 py-1.5 text-[15px] font-semibold transition-colors",
                  selected
                    ? "bg-maroon text-paper shadow-sm"
                    : "text-ink-soft hover:text-maroon",
                  m.comingSoon ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                {m.label}
                {m.comingSoon && (
                  <span class="ml-1.5 align-middle text-[11px] font-normal uppercase tracking-wide text-ink-muted">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p class="mt-3 text-[14px] text-ink-soft">{activeMode.hint}</p>

        <div class="mt-3 flex flex-col gap-3 tablet:flex-row tablet:items-stretch">
          {activeMode.placeholder ? (
            <input
              type="text"
              value={inputs[mode]}
              placeholder={activeMode.placeholder}
              onInput={(e) =>
                setInputs((v) => ({
                  ...v,
                  [mode]: (e.target as HTMLInputElement).value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending) generate();
              }}
              class="w-full flex-1 rounded-md border border-rule-strong bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
              aria-label={`${activeMode.label} input`}
            />
          ) : (
            <p class="flex-1 rounded-md border border-dashed border-rule-strong bg-paper/50 px-3 py-2 text-[14px] text-ink-muted">
              Upload your own paired card + art images — coming soon.
            </p>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={pending || activeMode.comingSoon}
            class="rounded-md border border-rule-strong bg-paper px-5 py-2 text-[15px] font-semibold text-maroon shadow-sm transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50 tablet:whitespace-nowrap"
          >
            {pending ? "Generating…" : "Generate"}
          </button>
        </div>

        {error && (
          <p class="mt-3 text-[14px] font-semibold text-maroon" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* ── Results: preview + cards + edit shell ───────────────────────── */}
      {recipe && (
        <div class="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-[1fr_320px]">
          {/* Preview + handoff */}
          <section aria-label="Layout preview">
            <label class="block">
              <span class="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                Title
              </span>
              <input
                type="text"
                value={recipe.title}
                onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                class="mt-1 w-full rounded-md border border-rule-strong bg-paper px-3 py-2 font-serif text-[16px] text-ink focus:border-gold focus:outline-none"
                aria-label="Layout title"
              />
            </label>

            <div class="relative mt-3 aspect-video w-full overflow-hidden rounded-lg border border-rule-strong bg-black shadow-sm">
              <StageFrame>
                {viewGrid ? (
                  <GridOverview cards={gridCards} arrangement={recipe.grid} />
                ) : (
                  <Stage slide={slides[Math.min(slideIndex, last)]} />
                )}
              </StageFrame>
            </div>

            {/* Stepper */}
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={viewGrid || slideIndex <= 0}
                  class="rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[15px] font-semibold text-ink-soft transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous slide"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={viewGrid || slideIndex >= last}
                  class="rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[15px] font-semibold text-ink-soft transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next slide"
                >
                  →
                </button>
                <span class="ml-1 text-[14px] tabular-nums text-ink-muted">
                  {viewGrid
                    ? `Grid · ${gridCards.length}`
                    : `${Math.min(slideIndex, last) + 1} / ${slides.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => setViewGrid((g) => !g)}
                  aria-pressed={viewGrid}
                  class={[
                    "ml-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-[14px] font-semibold transition-colors",
                    viewGrid
                      ? "border-maroon bg-maroon text-paper"
                      : "border-rule-strong bg-paper text-ink-soft hover:border-gold",
                  ].join(" ")}
                >
                  ▦ Grid
                </button>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  class="whitespace-nowrap rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[14px] font-semibold text-ink-soft transition-colors hover:border-gold"
                >
                  {copied ? "Link copied ✓" : "🔗 Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => setPresenting(true)}
                  class="whitespace-nowrap rounded-md border border-rule-strong bg-maroon px-4 py-1.5 text-[14px] font-semibold text-paper shadow-sm transition-colors hover:border-gold"
                >
                  ▶ Present
                </button>
              </div>
            </div>

            {/* Resolved cards strip */}
            <div class="mt-5">
              <h2 class="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                {thumbs.length} card{thumbs.length === 1 ? "" : "s"}
              </h2>
              <ul class="mt-2 flex flex-wrap gap-2">
                {thumbs.map(({ card, index }) => (
                  <li key={`${card.set}-${card.collector}-${index}`}>
                    <button
                      type="button"
                      onClick={() => jumpToCard(index)}
                      title={card.name}
                      class="block overflow-hidden rounded-md border border-rule bg-paper transition-colors hover:border-gold focus:border-gold focus:outline-none"
                    >
                      <img
                        src={card.cardImage}
                        alt={card.name}
                        loading="lazy"
                        class="h-28 w-auto"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Layout editor (#15) — reorder / exclude / grid / card-vs-art. */}
          <aside
            class="self-start rounded-lg border border-rule bg-paper/70 p-4"
            aria-label="Edit controls"
          >
            <h2 class="font-serif text-[16px] font-semibold text-ink">Edit</h2>
            <div class="mt-4">
              <LayoutEditor
                recipe={recipe}
                cards={cards}
                onChange={setRecipe}
                onJump={jumpToCard}
              />
            </div>
          </aside>
        </div>
      )}

      {/* In-app presenter: a fullscreen overlay over the builder rather than a
          navigation, so presenting never loses the deck you're editing. Esc (or
          the overlay's Exit button) returns here with everything intact. */}
      {presenting && recipe && (
        <div class="fixed inset-0 z-50">
          <Presenter
            recipe={recipe}
            cards={cards}
            onExit={() => setPresenting(false)}
          />
        </div>
      )}
    </div>
  );
}
