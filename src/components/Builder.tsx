/**
 * Builder — the creation surface (#12/#26). The front door to the live builder:
 * pick a source, give it an input, Generate a deck, then edit that deck freely and
 * hand it off to the presenter.
 *
 * Generate runs the resolver once (`resolveDeck` — a live Scryfall search #14 or a
 * booster roll #17) and seeds a **deck**: a title slide, one card slide per resolved
 * card, and a grid montage. After that the deck *is* the document — the right column
 * (<DeckEditor>) reorders / edits / adds / removes / duplicates slides, and the main
 * column is the big preview of the selected slide plus a stepper. One list, one show.
 *
 * UI chrome uses the design-system Tailwind tokens; the preview reuses the exact
 * broadcast component (<Stage> inside <StageFrame>) the presenter renders, so what
 * you see here is what streams.
 */

import { useCallback, useMemo, useState } from "preact/hooks";
import {
  buildSlides,
  cardKey,
  cardMapFrom,
  cardRefs,
  insertSlide,
  FACE_BOTH,
  SCHEMA_VERSION,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";
import { resolveDeck, ResolveError, type Mode } from "../lib/resolve.ts";
import { encodeRecipe } from "../lib/permalink.ts";
import { usePreloadImages } from "../lib/stage.ts";
import StageFrame from "./stage/StageFrame.tsx";
import Stage from "./stage/Stage.tsx";
import DeckEditor from "./DeckEditor.tsx";
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
  // Every resolved card whose identity the deck might reference — the Generate
  // results plus any cards added later via search. Keyed into render by identity,
  // so the preview shows real artwork rather than re-resolving from a catalog.
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeMode = MODES.find((m) => m.id === mode)!;

  const byId = useMemo(() => cardMapFrom(catalog), [catalog]);
  const slides = useMemo(
    () => (recipe ? buildSlides(recipe, byId) : []),
    [recipe, byId],
  );

  // Warm the cache for every card the deck references as soon as it's generated,
  // so the preview steps instantly and Present starts with images already loaded.
  usePreloadImages(
    useMemo(
      () =>
        recipe
          ? cardRefs(recipe).flatMap((ref) => {
              const c = byId.get(cardKey(ref));
              return c ? [c.cardImage, c.artImage] : [];
            })
          : [],
      [recipe, byId],
    ),
  );

  const generate = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const { cards: resolved, title, grid } = await resolveDeck(mode, inputs[mode]);
      setCatalog(resolved);
      setRecipe({
        v: SCHEMA_VERSION,
        slides: [
          // A fresh deck is bookended by the branded keynote card: keynote open,
          // a title slide, the cards, a grid montage, then a keynote close.
          { kind: "keynote" },
          { kind: "title", text: title },
          ...resolved.map((c) => ({
            kind: "card" as const,
            set: c.set,
            collector: c.collector,
            face: FACE_BOTH,
          })),
          { kind: "grid", arrangement: grid ?? DEFAULT_GRID },
          { kind: "keynote" },
        ],
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

  // Insert a searched card as a new card slide right after the selected one, and
  // make sure the catalog can resolve it.
  const addCard = useCallback(
    (card: Card) => {
      setCatalog((cat) =>
        cat.some((c) => cardKey(c) === cardKey(card)) ? cat : [...cat, card],
      );
      setRecipe((r) => {
        if (!r) return r;
        const at = Math.min(slideIndex + 1, r.slides.length);
        return insertSlide(r, at, {
          kind: "card",
          set: card.set,
          collector: card.collector,
          face: FACE_BOTH,
        });
      });
      setSlideIndex((i) => i + 1);
    },
    [slideIndex],
  );

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
  const current = Math.min(slideIndex, Math.max(0, last));
  const step = (delta: number) =>
    setSlideIndex((i) => Math.min(last, Math.max(0, i + delta)));

  return (
    <div class="font-sans">
      {/* ── Composer bar: source picker + per-mode input + generate ───────── */}
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

        {/* A real <form> so the browser remembers past queries: a named field
            submitted on Enter/Generate is what populates its autofill history.
            The name is per-mode so scry queries and set codes keep separate lists. */}
        <form
          class="mt-3 flex flex-col gap-3 tablet:flex-row tablet:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending && !activeMode.comingSoon) generate();
          }}
        >
          {activeMode.placeholder ? (
            <input
              type="text"
              name={`obs-query-${mode}`}
              autocomplete="on"
              value={inputs[mode]}
              placeholder={activeMode.placeholder}
              onInput={(e) =>
                setInputs((v) => ({
                  ...v,
                  [mode]: (e.target as HTMLInputElement).value,
                }))
              }
              class="w-full flex-1 rounded-md border border-rule-strong bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
              aria-label={`${activeMode.label} input`}
            />
          ) : (
            <p class="flex-1 rounded-md border border-dashed border-rule-strong bg-paper/50 px-3 py-2 text-[14px] text-ink-muted">
              Upload your own paired card + art images — coming soon.
            </p>
          )}

          <button
            type="submit"
            disabled={pending || activeMode.comingSoon}
            class="rounded-md border border-rule-strong bg-paper px-5 py-2 text-[15px] font-semibold text-maroon shadow-sm transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50 tablet:whitespace-nowrap"
          >
            {pending ? "Generating…" : "Generate"}
          </button>
        </form>

        {error && (
          <p class="mt-3 text-[14px] font-semibold text-maroon" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* ── Results: preview + stepper + deck editor ────────────────────── */}
      {recipe && slides.length > 0 && (
        <div class="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-[1fr_340px]">
          {/* Preview + handoff */}
          <section aria-label="Layout preview">
            <div class="relative aspect-video w-full overflow-hidden rounded-lg border border-rule-strong bg-black shadow-sm">
              <StageFrame>
                <Stage slide={slides[current]} />
              </StageFrame>
            </div>

            {/* Stepper */}
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={current <= 0}
                  class="rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[15px] font-semibold text-ink-soft transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous slide"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={current >= last}
                  class="rounded-md border border-rule-strong bg-paper px-3 py-1.5 text-[15px] font-semibold text-ink-soft transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next slide"
                >
                  →
                </button>
                <span class="ml-1 text-[14px] tabular-nums text-ink-muted">
                  {current + 1} / {slides.length}
                </span>
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
          </section>

          {/* The deck — one list that drives order, editing, and the preview. */}
          <aside
            class="self-start rounded-lg border border-rule bg-paper/70 p-4"
            aria-label="Deck"
          >
            <DeckEditor
              recipe={recipe}
              byId={byId}
              selected={current}
              onChange={setRecipe}
              onSelect={setSlideIndex}
              onAddCard={addCard}
            />
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
            byId={byId}
            onExit={() => setPresenting(false)}
          />
        </div>
      )}
    </div>
  );
}
