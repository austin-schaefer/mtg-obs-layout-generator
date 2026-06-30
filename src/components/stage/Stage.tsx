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
  type Box,
} from "../../lib/stage.ts";

import marble from "../../../resources/marble-background.png";
import frame from "../../../resources/host-frames-card-discussion.png";
import titleBg from "../../../resources/title_background.png";

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

function TitleSlide({ title }: { title: string }) {
  return (
    <>
      <img src={titleBg.src} alt="" style={fullStage} />
      <div
        style={{
          ...fullStage,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 200px",
          boxSizing: "border-box",
        }}
      >
        {/* Parchment plate keeps the title legible over any background and reads
            as an intentional broadcast title card (marble + maroon + gold). */}
        <div
          style={{
            maxWidth: "1960px",
            padding: "96px 140px",
            background: "linear-gradient(180deg, #efece3, #dcd7c7)",
            border: "6px solid #b8893a",
            borderRadius: "28px",
            boxShadow: "0 40px 110px rgba(0,0,0,0.55)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "180px",
              height: "5px",
              margin: "0 auto 48px",
              background: "#b8893a",
              borderRadius: "3px",
            }}
          />
          <h1
            style={{
              margin: "0",
              fontFamily: 'var(--font-serif, "Source Serif 4", Georgia, serif)',
              fontWeight: "700",
              fontSize: "150px",
              lineHeight: "1.08",
              color: "#7a1f1a",
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    </>
  );
}

export default function Stage({ slide }: { slide: Slide }) {
  if (slide.kind === "title") {
    return <TitleSlide title={slide.title} />;
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
