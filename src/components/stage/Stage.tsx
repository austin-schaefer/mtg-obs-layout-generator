/**
 * Stage — renders one slide as absolutely-positioned layers filling the fixed
 * 2560×1440 broadcast canvas. Always used inside a <StageFrame>, which supplies
 * the fit-to-viewport scale. Coordinates come from `lib/stage.ts` (the web mirror
 * of the pipeline's `ImageConfig`).
 *
 * Layer order matches the pipeline: marble base → card/art image → host frame on
 * top (the frame's transparency lets the card show through). No transparency
 * holes — this is the live surface, not a PNG for OBS to key.
 *
 * Backgrounds are imported straight from `resources/` (all rights reserved; see
 * LICENSE). Astro resolves them to hashed build assets — no copy, no relicense.
 */

import type { Slide } from "../../lib/recipe.ts";
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  HORIZONTAL_REGION,
  HORIZONTAL_MAX,
  VERTICAL_REGION,
  VERTICAL_MAX,
  HOST_BOXES,
  boxStyle,
  useFitFontSize,
  type Box,
} from "../../lib/stage.ts";
import GridOverview from "./GridOverview.tsx";

import marble from "../../../resources/marble-background.png";
import frame from "../../../resources/host-frames-card-discussion.png";
import titleFrameBg from "../../../resources/title_background_w_frame.png";
import titleHostsBg from "../../../resources/title_background_w_hosts.png";

const fullStage: Record<string, string> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: `${STAGE_WIDTH}px`,
  height: `${STAGE_HEIGHT}px`,
};

/**
 * An image centered in its region. Two fit modes mirror the pipeline
 * (`calculate_resize_geometry`):
 *  - `"native"` — full cards, already the right size: shown at native px,
 *    only shrunk if larger than the max, never upscaled (`auto` + `max`).
 *  - `"fill"` — card art: scaled to fill the max box, up *or* down, preserving
 *    aspect (the pipeline's `too_small` branch upscales small art to the max).
 */
function RegionImage(props: {
  src: string;
  alt: string;
  region: Box;
  max: { w: number; h: number };
  fit: "native" | "fill";
}) {
  const imgStyle: Record<string, string> =
    props.fit === "fill"
      ? {
          width: `${props.max.w}px`,
          height: `${props.max.h}px`,
          objectFit: "contain",
          display: "block",
        }
      : {
          maxWidth: `${props.max.w}px`,
          maxHeight: `${props.max.h}px`,
          width: "auto",
          height: "auto",
          display: "block",
        };
  return (
    <div
      style={{
        ...boxStyle(props.region),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img src={props.src} alt={props.alt} style={imgStyle} />
    </div>
  );
}

/**
 * The open region on the host-frame title background — the clear area above the
 * two host-cam boxes where the wordmark would be. The text slide centers its text
 * here, so the region is centered on the **midpoint of the two host frames**, not
 * the canvas: the hosts sit right-of-center (the hourglass ornament occupies the
 * left), so canvas-centered text reads visibly left-heavy over them.
 *
 * Construction (derived from `HOST_BOXES`, so it tracks the frame): center the
 * region on the two host frames' midpoint, and let it overhang each frame by half
 * the right frame's gutter to the canvas edge. So the text can run a little wider
 * than the frames (nicer for long lines) while the other half of that gutter stays
 * as canvas breathing room — long lines never kiss the edge, and the block stays
 * balanced across the hosts (the hourglass ornament sits clear to the left).
 * Measured against `title_background_w_hosts.png` (2560×1440; host boxes ~y858).
 */
const HOST_SPAN_LEFT = HOST_BOXES[0].x;
const HOST_SPAN_RIGHT = HOST_BOXES[1].x + HOST_BOXES[1].w;
const TEXT_OVERHANG = Math.round((STAGE_WIDTH - HOST_SPAN_RIGHT) / 2);
const TEXT_REGION: Box = {
  x: HOST_SPAN_LEFT - TEXT_OVERHANG,
  y: 150,
  w: HOST_SPAN_RIGHT - HOST_SPAN_LEFT + 2 * TEXT_OVERHANG,
  h: 660,
};

/**
 * Keynote — the branded show title card: the fully-framed Clock Spinning
 * background (wordmark + host-frame chrome), nothing overlaid. This is the
 * "name of the podcast" slide (issue #25).
 */
function KeynoteSlide() {
  return <img src={titleFrameBg.src} alt="" style={fullStage} />;
}

/**
 * Text slide — arbitrary text on the broadcast surface, wearing the host-frame
 * chrome but *not* the wordmark (`title_background_w_hosts.png`, derived from the
 * keynote art), so it reads as part of the show without competing with the
 * wordmark. The text is centered in the open region above the host boxes, set in
 * the brand body face (Montserrat) in the show's orchid accent, glowing to stay
 * legible over the busy indigo. Auto-fit so short lines stand large and long ones
 * shrink to wrap — never overrunning the host boxes below. Empty text leaves the
 * clean host-frame background.
 */
function TitleSlide({ title }: { title: string }) {
  const text = title.trim();
  const { ref, size } = useFitFontSize(text, TEXT_REGION, 200, 48);
  return (
    <>
      <img src={titleHostsBg.src} alt="" style={fullStage} />
      {text && (
        <div
          style={{
            ...boxStyle(TEXT_REGION),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            ref={ref}
            style={{
              margin: "0",
              maxWidth: "100%",
              textAlign: "center",
              fontFamily:
                'var(--font-brand, "Montserrat", system-ui, sans-serif)',
              fontWeight: "600",
              fontSize: `${size}px`,
              lineHeight: "1.08",
              color: "var(--color-cs-orchid, #d19ed5)",
              textShadow:
                "0 0 28px rgba(209,158,213,0.55), 0 6px 26px rgba(0,0,0,0.75)",
            }}
          >
            {text}
          </h1>
        </div>
      )}
    </>
  );
}

export default function Stage({ slide }: { slide: Slide }) {
  if (slide.kind === "keynote") {
    return <KeynoteSlide />;
  }

  if (slide.kind === "title") {
    return <TitleSlide title={slide.title} />;
  }

  if (slide.kind === "grid") {
    return <GridOverview cards={slide.cards} arrangement={slide.arrangement} />;
  }

  const { card, showCard, showArt } = slide;
  return (
    <>
      <img src={marble.src} alt="" style={fullStage} />
      {showCard && (
        <RegionImage
          src={card.cardImage}
          alt={card.name}
          region={VERTICAL_REGION}
          max={VERTICAL_MAX}
          fit="native"
        />
      )}
      {showArt && (
        <RegionImage
          src={card.artImage}
          alt={`${card.name} art`}
          region={HORIZONTAL_REGION}
          max={HORIZONTAL_MAX}
          fit="fill"
        />
      )}
      {/* Plain white backing under each host-cam box (the OBS webcam overlays
          here on stream); painted over marble/art bleed, beneath the frame. */}
      {HOST_BOXES.map((box, i) => (
        <div key={i} style={{ ...boxStyle(box), background: "#ffffff" }} />
      ))}
      <img src={frame.src} alt="" style={fullStage} />
    </>
  );
}
