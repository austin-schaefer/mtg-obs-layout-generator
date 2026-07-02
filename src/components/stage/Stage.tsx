/**
 * Stage — renders one slide as absolutely-positioned layers filling the fixed
 * 2560×1440 broadcast canvas. Always used inside a <StageFrame>, which supplies
 * the fit-to-viewport scale. Coordinates come from `lib/stage.ts` (the web mirror
 * of the pipeline's `ImageConfig`).
 *
 * All five background PNGs are mounted permanently, in a fixed DOM order, for the
 * lifetime of the presenter — a slide change only toggles each `<Backdrop>`'s
 * `visibility`, never mounts/unmounts an `<img>`. These backgrounds are ~5 MB
 * 2560×1440 PNGs; remounting one forces the browser to re-decode it from scratch
 * on every kind change (keynote → text → card → grid), which is a visible
 * flash/reload even when the bytes are already HTTP-cached. Keeping every
 * backdrop mounted and toggling visibility instead means the decode happens once,
 * up front, and slide changes are instant.
 *
 * Because every backdrop is an absolutely-positioned sibling, DOM order *is*
 * paint order — no z-index needed. The host frame (which must paint above the
 * card/art content) is deliberately ordered after that content, not with the
 * other backdrops.
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
import titleBg from "../../../resources/title_background.png";

/** Every backdrop the stage can show — preloaded/decoded up front (see
 *  `usePreloadImages` in `lib/stage.ts`) so the always-mounted `<Backdrop>`s
 *  below never show a placeholder while their decode completes. */
export const STAGE_BACKGROUNDS: string[] = [
  marble.src,
  frame.src,
  titleFrameBg.src,
  titleHostsBg.src,
  titleBg.src,
];

const fullStage: Record<string, string> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: `${STAGE_WIDTH}px`,
  height: `${STAGE_HEIGHT}px`,
};

/**
 * A full-stage background image that stays mounted permanently — only its
 * `visibility` toggles as the current slide's kind changes. See the file header:
 * this is what keeps a slide change from re-decoding a ~5 MB PNG. `visibility`
 * (not `display: none`) so the image never leaves layout/decode state.
 */
function Backdrop({ src, visible }: { src: string; visible: boolean }) {
  return (
    <img
      src={src}
      alt=""
      style={{ ...fullStage, visibility: visible ? "visible" : "hidden" }}
    />
  );
}

/**
 * Only ever wrap at spaces. The browser also breaks after a hyphen and around en/em
 * dashes, which orphans `re-` (from `re-gathered.com`) or a lone dash onto its own
 * line. Swap plain hyphens for a non-breaking hyphen (U+2011 — identical glyph, not
 * a break point) and fence each en/em dash with word joiners (U+2060, zero-width) so
 * it can't break either. The auto-fit then shrinks the whole token to fit and wraps
 * only at real spaces. Applied to every piece of on-stage text (titles + captions).
 */
const keepBreaksAtSpaces = (s: string) =>
  s.replace(/-/g, "‑").replace(/([–—])/g, "⁠$1⁠");

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
 * Card caption — the open gutter *between the two host-cam boxes*, below the art.
 * Derived from `HOST_BOXES` so it tracks the frame: it spans the gap between the
 * cams (inset a little off each cam edge) and runs from just below the art crop
 * down to the cams' baseline. This is the one rectangle on a card slide that stays
 * clear in every face mode (card / art / both), so a caption never lands on the
 * card, the art, or a webcam.
 */
const CAPTION_INSET = 24;
const CAP_LEFT = HOST_BOXES[0].x + HOST_BOXES[0].w;
const CAP_RIGHT = HOST_BOXES[1].x;
const CARD_CAPTION_REGION: Box = {
  x: CAP_LEFT + CAPTION_INSET,
  y: 1010,
  w: CAP_RIGHT - CAP_LEFT - 2 * CAPTION_INSET,
  h: HOST_BOXES[0].y + HOST_BOXES[0].h - 1010,
};

/**
 * A card caption echoes the show's on-stage text treatment (the same orchid the
 * title slide uses), so both read as one voice. Set in the brand body face
 * (Montserrat) with a dark halo so light orchid pops against the busy purple/green
 * marble the caption sits on. Auto-fit so short captions stand large and long ones
 * shrink to wrap without spilling onto a cam. Empty text renders nothing.
 */
function CardCaption({ text }: { text: string }) {
  const caption = keepBreaksAtSpaces(text.trim());
  const { ref, size } = useFitFontSize(caption, CARD_CAPTION_REGION, 132, 40);
  if (!caption) return null;
  return (
    <div
      style={{
        ...boxStyle(CARD_CAPTION_REGION),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        ref={ref}
        style={{
          margin: "0",
          maxWidth: "100%",
          textAlign: "center",
          fontFamily: 'var(--font-brand, "Montserrat", system-ui, sans-serif)',
          fontWeight: "700",
          fontSize: `${size}px`,
          lineHeight: "1.1",
          color: "var(--color-cs-orchid, #d19ed5)",
          textShadow:
            "0 2px 14px rgba(0,0,0,0.85), 0 0 30px rgba(0,0,0,0.7)",
        }}
      >
        {caption}
      </p>
    </div>
  );
}

/**
 * Text slide's on-stage title text — the open region above the host boxes, set in
 * the brand body face (Montserrat) in the show's orchid accent, glowing to stay
 * legible over the busy indigo. Auto-fit so short lines stand large and long ones
 * shrink to wrap — never overrunning the host boxes below. Empty text renders
 * nothing (leaving the clean host-frame backdrop visible on its own).
 */
function TitleText({ title }: { title: string }) {
  const text = keepBreaksAtSpaces(title.trim());
  const { ref, size } = useFitFontSize(text, TEXT_REGION, 200, 48);
  if (!text) return null;
  return (
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
          fontFamily: 'var(--font-brand, "Montserrat", system-ui, sans-serif)',
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
  );
}

type CardSlide = Extract<Slide, { kind: "card" }>;

/**
 * Card slide's dynamic content — full card, art, and the host-box white backing.
 * Everything the pipeline draws *between* the marble base and the frame overlay
 * (both of which are now permanent backdrops; see the file header). Narrowed to
 * the card-slide shape so `slide.card` etc. are safe to access here.
 */
function CardContent({ slide }: { slide: CardSlide }) {
  const { card, showCard, showArt } = slide;
  return (
    <>
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
    </>
  );
}

export default function Stage({ slide }: { slide: Slide }) {
  const kind = slide.kind;
  return (
    <>
      {/* All five backdrops stay mounted for the presenter's lifetime; only
          `visible` changes. DOM order is paint order (no z-index). */}
      <Backdrop src={titleFrameBg.src} visible={kind === "keynote"} />
      <Backdrop src={titleHostsBg.src} visible={kind === "title"} />
      <Backdrop src={titleBg.src} visible={kind === "grid"} />
      <Backdrop src={marble.src} visible={kind === "card"} />

      {kind === "title" && <TitleText title={slide.title} />}
      {kind === "grid" && (
        <GridOverview cards={slide.cards} arrangement={slide.arrangement} />
      )}
      {kind === "card" && <CardContent slide={slide} />}

      {/* Host frame paints above card/art content — must come after it in DOM
          order — but is still a permanent backdrop, only its visibility toggles. */}
      <Backdrop src={frame.src} visible={kind === "card"} />

      {/* Caption sits on top of the frame — a broadcast lower-third between cams. */}
      {kind === "card" && slide.text && <CardCaption text={slide.text} />}
    </>
  );
}
