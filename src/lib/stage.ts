/**
 * The broadcast stage coordinate system — the web mirror of `ImageConfig` in
 * `download_images.py` and the `obs-layouts-design` skill (the single source of
 * truth; keep these in sync if the spec changes).
 *
 * Everything renders onto a fixed 2560×1440 pixel canvas authored in true
 * broadcast-space px, then scaled to fit the viewport with a CSS transform
 * (`useStageScale`). This keeps the web faithful to the pipeline and makes
 * "fit-within, never upscale" trivial: an image placed in a region with
 * `width/height: auto` + `max-width/height` of its region max scales large art
 * down and leaves small art at native size — exactly what the pipeline does.
 *
 * No transparency holes, no PNG export: the live surface model (epic #19).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

/** The OBS composite canvas — every `resources/*.png` background is this size. */
export const STAGE_WIDTH = 2560;
export const STAGE_HEIGHT = 1440;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Horizontal: card *art* / landscape. Region centers the image; max = fit-within. */
export const HORIZONTAL_REGION: Box = { x: 1000, y: 70, w: 1494, h: 940 };
export const HORIZONTAL_MAX = { w: 1142, h: 920 };

/** Vertical: full *card* / portrait. Full cards sit below max and render native. */
export const VERTICAL_REGION: Box = { x: 75, y: 95, w: 850, h: 1210 };
export const VERTICAL_MAX = { w: 850, h: 1250 };

/** Grid montage cap, composited centered on the title background. */
export const GRID_MAX = { w: 2500, h: 1400 };

/**
 * Host-cam boxes in the discussion frame. In the old PNG pipeline these were
 * punched to transparency (`TRANSPARENCY_RECT_1/2`) so an OBS source showed
 * through; on the live surface there's nothing behind, so we paint them plain
 * white as a clean backing under the frame. Coords are the transparency rects:
 * rect1 `1010,858 1489,1337`, rect2 `2008,858 2487,1337`.
 */
export const HOST_BOXES: Box[] = [
  { x: 1010, y: 858, w: 479, h: 479 },
  { x: 2008, y: 858, w: 479, h: 479 },
];

/** Absolute-position a box in 2560×1440 space. */
export function boxStyle(box: Box): Record<string, string> {
  return {
    position: "absolute",
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.w}px`,
    height: `${box.h}px`,
  };
}

/**
 * Measure a container and return the scale that fits a 2560×1440 canvas inside
 * it (letterboxed). Re-measures on container resize and fullscreen transitions.
 * `scale` is 0 until the first measurement so callers can avoid a pre-layout flash.
 */
export function useStageScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setScale(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", measure);
    };
  }, []);

  return { ref, scale };
}

/**
 * Pick the largest font-size (in true canvas px) at which `text` fits inside a
 * `w×h` box, wrapping allowed. Used by the title keynote so any episode title —
 * short or long — settles into the open band between the wordmark and the host
 * boxes without overflowing into either. Binary-searches the measured element,
 * so it's exact for the font actually loaded (re-runs when the text or box
 * changes, and once more when the web font finishes loading).
 */
export function useFitFontSize(
  text: string,
  box: { w: number; h: number },
  max: number,
  min: number,
) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let lo = min;
      let hi = max;
      let best = min;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= box.w && el.scrollHeight <= box.h) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      el.style.fontSize = `${best}px`;
      setSize(best);
    };
    fit();
    // Web fonts (Zen Tokyo Zoo) load async; remeasure once they're ready so the
    // fit reflects the real glyph metrics, not the fallback's.
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } })
      .fonts;
    fonts?.ready?.then(fit);
  }, [text, box.w, box.h, max, min]);

  return { ref, size };
}

/**
 * Warm the browser image cache for every URL up front, so slides don't visibly
 * load mid-presentation (only the on-screen slide's <img> is ever in the DOM, so
 * without this each card/art fetches the first time you land on it). Client-only
 * (effect); data-URI placeholders are no-ops. Keyed on the joined URL list so it
 * re-runs only when the actual deck changes, not on every render.
 *
 * Beyond fetching the bytes, also calls `img.decode()` on each one: HTTP cache
 * warmth alone doesn't avoid the decode cost, and decoding a multi-megabyte PNG
 * synchronously on first paint is what causes a residual swap lag even for
 * already-cached images. `decode()` does that work off the critical rendering
 * path, ahead of time. Not all browsers implement it, hence the optional call;
 * failures (e.g. a data-URI placeholder) are swallowed.
 */
export function usePreloadImages(urls: string[]) {
  const key = urls.join("|");
  useEffect(() => {
    const imgs = urls.map((src) => {
      const img = new Image();
      img.src = src;
      img.decode?.().catch(() => {});
      return img;
    });
    return () => {
      // Drop refs so an abandoned deck's fetches can be GC'd.
      imgs.forEach((img) => {
        img.src = "";
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
