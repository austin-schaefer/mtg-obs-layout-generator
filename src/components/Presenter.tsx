/**
 * Presenter — the show surface you screen-share. Full-bleed black stage, keyboard
 * stepping, a fullscreen toggle, and a subtle position counter. Wraps the
 * 2560×1440 stage via <StageFrame> and steps the deck one slide at a time — title,
 * card, and grid slides all live in the same deck, so there's no separate grid mode.
 *
 * Keys:  ← / → (also ↑ ↓, Space, PageUp/Down) step · F fullscreen · L copy link ·
 *        Esc steps back out (exit fullscreen → `onExit`).
 *
 * `onExit` is set when the presenter runs as an in-app overlay (the builder's
 * "Present" button): Esc with nothing left to close, or the exit button, hands
 * control back to the host without a page navigation, so no work is lost. The
 * standalone /present page leaves it unset — there Esc just exits fullscreen.
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  buildSlides,
  cardKey,
  cardRefs,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";
import { encodeRecipe } from "../lib/permalink.ts";
import { usePreloadImages } from "../lib/stage.ts";
import StageFrame from "./stage/StageFrame.tsx";
import Stage from "./stage/Stage.tsx";

interface Props {
  recipe: LayoutRecipe;
  /** Resolved cards indexed by identity (`cardMapFrom`). */
  byId: Map<string, Card>;
  /** Slide the show opens on (clamped). The builder's "Present" hands off the
   *  slide the host had selected; the standalone /present page opens at 0. */
  startIndex?: number;
  /** When set, Esc (with nothing left to close) and the exit button call this
   *  instead of navigating — used by the builder's in-app "Present" overlay. */
  onExit?: () => void;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

export default function Presenter({ recipe, byId, startIndex = 0, onExit }: Props) {
  const slides = buildSlides(recipe, byId);

  // Preload the whole deck (both faces) so no slide loads mid-presentation.
  usePreloadImages(
    cardRefs(recipe).flatMap((ref) => {
      const c = byId.get(cardKey(ref));
      return c ? [c.cardImage, c.artImage] : [];
    }),
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, slides.length - 1)),
  );
  const [hintDismissed, setHintDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  // Fullscreen is the broadcast/screen-share surface — hide every overlay so
  // only the clean stage shows. Chrome returns the moment you leave fullscreen.
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const last = slides.length - 1;
  const step = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last],
  );

  const copyPermalink = useCallback(() => {
    // Always the canonical presenter route — correct whether this runs as the
    // /present page or the builder's in-app overlay (pathname would be "/").
    const url = `${window.location.origin}/present?r=${encodeRecipe(recipe)}`;
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
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "l" || e.key === "L") {
        copyPermalink();
      } else if (e.key === "Escape") {
        // Step back out, one layer at a time: fullscreen → leave.
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onExit?.();
        }
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
  }, [step, toggleFullscreen, copyPermalink, onExit]);

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
        <Stage slide={slides[index]} />
      </StageFrame>

      {/* Overlay chrome — hidden in fullscreen so only the clean stage shows. */}
      {!isFullscreen && (
        <>
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
        {index + 1} / {slides.length}
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
          ← → step · F fullscreen · L copy link
          {onExit ? " · Esc exit" : ""}
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

      {/* Exit — only in the in-app overlay; returns to the builder, work intact. */}
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          title="Back to the builder (Esc)"
          style={{
            position: "absolute",
            top: "10px",
            left: "14px",
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
          ⤺ Exit
        </button>
      )}
        </>
      )}
    </div>
  );
}
