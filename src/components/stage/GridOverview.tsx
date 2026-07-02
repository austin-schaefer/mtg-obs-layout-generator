/**
 * GridOverview — the montage equivalent: all visible cards tiled inside the
 * 2500×1400 montage box centered on the 2560×1440 stage (mirrors
 * `download_images.py`'s `montage … -tile WxH` capped and composited
 * `-gravity center`). Reached from the presenter with `G`.
 *
 * The title background this montage sits over is one of `Stage.tsx`'s
 * always-mounted backdrops (`<Backdrop src={titleBg.src} visible={kind ===
 * "grid"} />`), not rendered here — see that file's header for why (remounting
 * a ~5 MB PNG on every slide change is a visible flash).
 *
 * Arrangement is `WxH`, `0` = auto: `8x0` → 8 columns, `0x4` → 4 rows, `4x4`
 * fixed, bare/empty → a card-count-aware default (`autoColumns`). Tiles scale to
 * fit the box (object-fit contain preserves each card's aspect).
 */

import type { Card } from "../../lib/recipe.ts";
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  GRID_MAX,
} from "../../lib/stage.ts";

/**
 * Portrait aspect (width ÷ height) of an MTG card — the tiles the montage lays
 * out. Only the ratio matters here, for choosing a balanced default arrangement.
 */
const CARD_ASPECT = 0.72;

/**
 * Columns for the **auto** arrangement (blank / `0x0`) at a given card count —
 * the "sensible default" a fresh grid slide seeds (issue #34). Cards are portrait
 * but the montage box is landscape (2500×1400), so the column count that makes
 * tiles best fill the box is √(N · boxW / (boxH · aspect)) ≈ 1.575·√N — more
 * columns than a plain √N. We round to that, then step off any count that would
 * strand a lone card on the last row (13 → 6 cols reads 6/6/1; 5 cols reads
 * 5/5/3, which is nicer). 1–4 cards read best as a single row.
 *
 * The worked count→shape table lives in the `obs-layouts-design` skill.
 */
export function autoColumns(n: number): number {
  if (n <= 4) return Math.max(1, n);
  const ideal = Math.sqrt((n * GRID_MAX.w) / (GRID_MAX.h * CARD_ASPECT));
  let cols = Math.max(1, Math.min(Math.round(ideal), n));
  const strandsOrphan = (c: number) => {
    const rows = Math.ceil(n / c);
    return rows > 1 && n - (rows - 1) * c === 1;
  };
  if (strandsOrphan(cols)) {
    // Search outward from the ideal for the nearest non-orphaning column count.
    for (let d = 1; d <= n; d++) {
      const near = [cols - d, cols + d]
        .filter((c) => c >= 1 && c <= n && !strandsOrphan(c))
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
      if (near.length) {
        cols = near[0];
        break;
      }
    }
  }
  return cols;
}

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
  else cols = autoColumns(Math.max(n, 1));
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
  );
}
