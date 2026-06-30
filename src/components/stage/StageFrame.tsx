/**
 * StageFrame — fits a fixed 2560×1440 broadcast canvas into whatever space it's
 * given (the viewport in the presenter, a panel in the builder preview) and
 * scales it with a CSS transform. Children render in true 2560-space px; the
 * frame handles the letterboxed fit and centering.
 */

import type { ComponentChildren } from "preact";
import { STAGE_WIDTH, STAGE_HEIGHT, useStageScale } from "../../lib/stage.ts";

interface Props {
  children: ComponentChildren;
  /** Background behind the letterbox bars (defaults to black, broadcast-safe). */
  letterbox?: string;
}

export default function StageFrame({ children, letterbox = "#000" }: Props) {
  const { ref, scale } = useStageScale();

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: letterbox,
      }}
    >
      {scale > 0 && (
        <div
          style={{
            position: "relative",
            width: `${STAGE_WIDTH * scale}px`,
            height: `${STAGE_HEIGHT * scale}px`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "0",
              left: "0",
              width: `${STAGE_WIDTH}px`,
              height: `${STAGE_HEIGHT}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
