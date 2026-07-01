/**
 * GridOverview — the montage equivalent: all visible cards tiled over the title
 * background, inside the 2500×1400 montage box centered on the 2560×1440 stage
 * (mirrors `download_images.py`'s `montage … -tile WxH` capped and composited
 * `-gravity center`). Reached from the presenter with `G`.
 *
 * Arrangement is `WxH`, `0` = auto: `8x0` → 8 columns, `0x4` → 4 rows, `4x4`
 * fixed, bare/empty → ~√N columns. Tiles scale to fit the box (object-fit
 * contain preserves each card's aspect).
 */

import type { Card } from "../../lib/recipe.ts";
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  GRID_MAX,
} from "../../lib/stage.ts";

import titleBg from "../../../resources/title_background.png";

const fullStage: Record<string, string> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: `${STAGE_WIDTH}px`,
  height: `${STAGE_HEIGHT}px`,
};

/** Resolve `WxH` (0 = auto) plus a card count into concrete column/row counts. */
export function gridDims(spec: string | undefined, n: number) {
  let w = 0;
  let h = 0;
  const m = spec?.toLowerCase().match(/^(\d+)x(\d+)$/);
  if (m) {
    w = Number(m[1]);
    h = Number(m[2]);
  }
  let cols: number;
  if (w > 0) cols = w;
  else if (h > 0) cols = Math.ceil(n / h);
  else cols = Math.ceil(Math.sqrt(Math.max(n, 1)));
  cols = Math.max(1, Math.min(cols, Math.max(n, 1)));
  const rows = Math.max(1, Math.ceil(n / cols));
  return { cols, rows };
}

interface Props {
  cards: Card[];
  /** `WxH` grid arrangement; `0` = auto. */
  arrangement?: string;
}

export default function GridOverview({ cards, arrangement }: Props) {
  const { cols, rows } = gridDims(arrangement, cards.length);

  return (
    <>
      <img src={titleBg.src} alt="" style={fullStage} />
      <div
        style={{
          position: "absolute",
          left: `${(STAGE_WIDTH - GRID_MAX.w) / 2}px`,
          top: `${(STAGE_HEIGHT - GRID_MAX.h) / 2}px`,
          width: `${GRID_MAX.w}px`,
          height: `${GRID_MAX.h}px`,
          display: "grid",
          // Fixed rows *and* columns of equal fraction: every tile gets a bounded
          // cell (box height ÷ rows), so the whole montage fits — no overflow/clip
          // no matter the card count (the bug when rows were left implicit/auto).
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: "24px",
          justifyItems: "center",
          alignItems: "center",
        }}
      >
        {cards.map((card, i) => (
          <img
            key={`${card.set}-${card.collector}-${i}`}
            src={card.cardImage}
            alt={card.name}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.45))",
            }}
          />
        ))}
      </div>
    </>
  );
}
