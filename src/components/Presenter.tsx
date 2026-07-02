/**
 * Presenter — the show surface you screen-share. Full-bleed black stage with no
 * overlay chrome at all — the stage is always broadcast-clean. Wraps the
 * 2560×1440 stage via <StageFrame> and steps the deck one slide at a time — title,
 * card, and grid slides all live in the same deck, so there's no separate grid mode.
 * While mounted it locks document scroll (the builder page underneath would
 * otherwise keep its scrollbar — visible in Safari) and, when the deck has a text
 * slide, retitles the tab after the first one.
 *
 * Keys:  ← / → (also ↑ ↓, Space, PageUp/Down) step · F fullscreen · L copy link ·
 *        Esc steps back out (exit fullscreen → `onExit`).
 * Touch/click: tap the right 70% of the stage to advance, the left 30% to go back —
 *        so the show is driveable on a phone with no keyboard.
 *
 * `onExit` is set when the presenter runs as an in-app overlay (the builder's
 * "Present" button): Esc with nothing left to close hands control back to the
 * host without a page navigation, so no work is lost. The standalone /present
 * page leaves it unset — there Esc just exits fullscreen.
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
import Stage, { STAGE_BACKGROUNDS } from "./stage/Stage.tsx";

interface Props {
  recipe: LayoutRecipe;
  /** Resolved cards indexed by identity (`cardMapFrom`). */
  byId: Map<string, Card>;
  /** Slide the show opens on (clamped). The builder's "Present" hands off the
   *  slide the host had selected; the standalone /present page opens at 0. */
  startIndex?: number;
  /** When set, Esc (with nothing left to close) calls this instead of
   *  navigating — used by the builder's in-app "Present" overlay. */
  onExit?: () => void;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

export default function Presenter({ recipe, byId, startIndex = 0, onExit }: Props) {
  const slides = buildSlides(recipe, byId);

  // Preload the whole deck (both faces) plus every stage backdrop, so nothing
  // loads — or, for the always-mounted backdrops, re-decodes — mid-presentation.
  usePreloadImages([
    ...STAGE_BACKGROUNDS,
    ...cardRefs(recipe).flatMap((ref) => {
      const c = byId.get(cardKey(ref));
      return c ? [c.cardImage, c.artImage] : [];
    }),
  ]);

  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, slides.length - 1)),
  );
  // The stage never scrolls, but the page underneath can (the builder, when the
  // presenter runs as its overlay) — Safari keeps showing that scrollbar over the
  // show. Lock document scroll for the presenter's lifetime.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Name the tab after the show: the first text slide with content titles the
  // deck. Restored on unmount so the builder gets its own title back on exit.
  const deckTitle = (() => {
    for (const s of slides) {
      if (s.kind === "title" && s.title.trim()) return s.title.trim();
    }
    return "";
  })();
  useEffect(() => {
    if (!deckTitle) return;
    const prev = document.title;
    document.title = deckTitle;
    return () => {
      document.title = prev;
    };
  }, [deckTitle]);

  const last = slides.length - 1;
  const step = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last],
  );

  const copyPermalink = useCallback(() => {
    // Always the canonical presenter route — correct whether this runs as the
    // /present page or the builder's in-app overlay (pathname would be "/").
    const url = `${window.location.origin}/present?r=${encodeRecipe(recipe)}`;
    navigator.clipboard?.writeText?.(url).catch(() => {});
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggleFullscreen, copyPermalink, onExit]);

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", inset: "0", background: "#000" }}
    >
      <StageFrame>
        <Stage slide={slides[index]} />
      </StageFrame>

      {/* Tap navigation — right 70% steps forward, left 30% steps back. Full-bleed
          so the letterbox counts too. Drives the show on a phone with no keyboard,
          and doubles as click-to-advance on desktop. */}
      <div
        onClick={(e) => {
          const { left, width } = e.currentTarget.getBoundingClientRect();
          step(e.clientX - left < width * 0.3 ? -1 : 1);
        }}
        style={{ position: "absolute", inset: "0" }}
      />
    </div>
  );
}
