/**
 * Presenter — the show surface you screen-share. Full-bleed black stage, keyboard
 * stepping, a grid overview, a fullscreen toggle, and a subtle position counter.
 * Wraps the 2560×1440 stage via <StageFrame> and swaps between the current slide
 * and the grid overview.
 *
 * Keys:  ← / → (also ↑ ↓, Space, PageUp/Down) step · G grid · F fullscreen ·
 *        Esc closes the grid.
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  recipeToSlides,
  visibleCards,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";
import { encodeRecipe } from "../lib/permalink.ts";
import StageFrame from "./stage/StageFrame.tsx";
import Stage from "./stage/Stage.tsx";
import GridOverview from "./stage/GridOverview.tsx";

interface Props {
  recipe: LayoutRecipe;
  cards: Card[];
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

export default function Presenter({ recipe, cards }: Props) {
  const slides = recipeToSlides(recipe, cards);
  const gridCards = visibleCards(recipe, cards);

  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [gridOpen, setGridOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const last = slides.length - 1;
  const step = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last],
  );

  const copyPermalink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?r=${encodeRecipe(recipe)}`;
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => {});
    } else {
      done();
    }
  }, [recipe]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") {
        setGridOpen((g) => !g);
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "l" || e.key === "L") {
        copyPermalink();
      } else if (e.key === "Escape") {
        setGridOpen(false);
        return; // let the browser also exit fullscreen
      } else if (NEXT_KEYS.has(e.key)) {
        step(1);
      } else if (PREV_KEYS.has(e.key)) {
        step(-1);
      } else {
        return;
      }
      e.preventDefault();
      setHintDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggleFullscreen, copyPermalink]);

  const overlay: Record<string, string> = {
    position: "absolute",
    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    color: "rgba(255,255,255,0.82)",
    userSelect: "none",
    pointerEvents: "none",
  };

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", inset: "0", background: "#000" }}
    >
      <StageFrame>
        {gridOpen ? (
          <GridOverview cards={gridCards} arrangement={recipe.grid} />
        ) : (
          <Stage slide={slides[index]} />
        )}
      </StageFrame>

      {/* Position counter — bottom-right, subtle, broadcast-safe. */}
      <div
        style={{
          ...overlay,
          right: "16px",
          bottom: "12px",
          fontSize: "14px",
          letterSpacing: "0.04em",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        }}
      >
        {gridOpen
          ? `Grid · ${gridCards.length} card${gridCards.length === 1 ? "" : "s"}`
          : `${index + 1} / ${slides.length}`}
      </div>

      {/* One-time controls hint — fades after the first keypress. */}
      {!hintDismissed && (
        <div
          style={{
            ...overlay,
            left: "16px",
            bottom: "12px",
            fontSize: "13px",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}
        >
          ← → step · G grid · F fullscreen · L copy link
        </div>
      )}

      {/* Permalink affordance — a copyable share link. The full share UI lives in
          the builder (#12/#16); this makes the encoded recipe tangible now. */}
      <button
        type="button"
        onClick={copyPermalink}
        title="Copy a permalink that reproduces this exact layout"
        style={{
          position: "absolute",
          top: "10px",
          right: "14px",
          padding: "5px 10px",
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          fontSize: "13px",
          color: "rgba(255,255,255,0.82)",
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        {copied ? "Link copied ✓" : "🔗 Copy link"}
      </button>
    </div>
  );
}
