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

import { useEffect, useRef, useState } from "preact/hooks";

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
