---
name: obs-layouts-design
description: "The obs-layouts design system — single source of truth for visuals. Use whenever you touch image-compositing math, the broadcast layout coordinate system, or (for the upcoming site) colors, typography, breakpoints, CSS tokens, or component markup. Triggers: 'layout', 'coordinates', 'composite', 'background', 'frame', 'design tokens', 'colors', 'typography', 'breakpoints', 'CSS', 'styling', 'theme', 'grid'."
---

# obs-layouts design system

Two layers live here, both authoritative:

1. **Broadcast layout system** — the exact coordinate spec the legacy Python
   pipeline composites to. This is the *behavior contract* the static site must
   reproduce. Don't scatter these magic numbers — they live here.
2. **Web design tokens** — a seeded Tailwind v4 `@theme` palette + type scale +
   breakpoints for the site being built, derived from the broadcast aesthetic.

For greenfield UI craft (novel components, high-polish pages), also use the
built-in `frontend-design` skill. This skill governs *what the obs-layouts brand is*;
`frontend-design` governs *how to execute distinctive UI well*.

---

## 1. Broadcast layout system (the spec to reproduce)

The pipeline builds two kinds of slide and a grid. All values are pixels, sourced
from `ImageConfig` in `download_images.py` (the canonical definition — if it ever
changes there, update this table).

### Canvas & assets (`resources/`, all rights reserved)

| Asset | Role |
|---|---|
| `marble-background.png` | Base background for individual card/art slides |
| `host-frames-card-discussion.png` | Overlay frame applied on top (`+0+0`) |
| `title_background.png` / `title_background_w_frame.png` | Title-slide backgrounds for the grid montage |

### Slide regions & sizing

| Element | Max size (fit-within) | Centering region (x, y, w, h) |
|---|---|---|
| **Horizontal** (card *art* / landscape) | 1142 × 920 | (1000, 70, 1494, 940) |
| **Vertical** (full *card* / portrait, hero) | 850 × 1250 | (75, 95, 850, 1210) |

- "Fit-within" = resize down preserving aspect ratio only if larger than max (see
  `calculate_resize_geometry`); never upscale.
- Images are centered **within their region** (the region's offset + the centering
  delta), not at the canvas origin. Full MTG cards are already correct size and are
  placed without resizing; custom/art images get resized first.

### Transparency holes (punched after frame overlay)

Two rectangles cut to transparency so an underlying OBS source shows through:

- Rect 1: `1010,858 1489,1337`
- Rect 2: `2008,858 2487,1337`

### Grid montage

- `montage -density 200 -tile <WxH> -geometry +10+40 -background none`
- Final grid capped at **2500 × 1400** (fit-within), then composited centered
  (`-gravity center`) onto the title background.
- Grid arrangement format `WxH`, `0` = auto (e.g. `8x0`, `9x0`, `4x4`).

### Hero image (optional)

`resources/hero.{jpg,jpeg,png,gif}` → resized to the vertical max (850×1250),
centered on title slides (first/last).

### Rate limiting

Scryfall calls space by `API_DELAY = 0.11s`. The site must respect Scryfall's
guidelines too (no key required — keep it that way).

---

## 2. Web design tokens (seeded for the static site)

Approach: declare tokens as CSS custom properties in a
Tailwind v4 `@theme` block in `src/styles/global.css`; each becomes a utility
automatically (`--color-marble` → `bg-marble`). **No `tailwind.config.js`** —
CSS-first. Self-host fonts (no CDNs). These are a starting point — refine against
real mocks during the build, but keep the palette cohesive with the broadcast look.

```css
@theme {
  /* Surfaces — marble / parchment broadcast feel */
  --color-marble:    #e8e3d6;  /* page background */
  --color-parchment: #d8d3c4;  /* secondary surface */
  --color-paper:     #ffffff;  /* content cards */
  --color-panel-from:#efece3;
  --color-panel-to:  #dcd7c7;

  /* Ink */
  --color-ink:       #1a1a1a;
  --color-ink-soft:  #3a3a3a;
  --color-ink-muted: #6b6b6b;

  /* Rules / borders */
  --color-rule:        #c8c3b5;
  --color-rule-strong: #a8a496;

  /* Accents — MTG broadcast */
  --color-maroon: #7a1f1a;  /* deep red, headings / wordmark */
  --color-gold:   #b8893a;  /* bronze-gold, frames / stars */
  --color-link:   #0a3cb0;
  --color-link-visited: #5a2a8a;

  /* Fonts — self-hosted; serif display + sans body */
  --font-serif: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-sans:  "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

### Breakpoints (canonical — do not invent new ones without a decision)

| Mode | Range | Rule |
|---|---|---|
| Mobile | ≤ 768px | Single-column stacks; controls wrap full-width, thumb-tappable |
| Tablet | 769–1024px | Side-by-side preserved; controls relax |
| Desktop | ≥ 1025px | Full info density; expanded spacing |

### Type scale (start here; extend deliberately)

| Size | Use |
|---|---|
| 13px | Inline labels, captions, metadata |
| 14px | Body text, inputs |
| 15px | Nav, row names |
| 16px | Section bars, panel titles, card names |
| 26px | Display / large stats |
| 40–62px | Wordmark (non-desktop / desktop hero) |

Keep a single font family per control row (use weight/size for hierarchy, don't mix
serif + sans on one toolbar).

---

## 3. Layout-review workflow (once the site exists)

After **any** CSS / breakpoint / composite-markup change, review with Playwright MCP
before declaring done:

1. `npm run dev`, then navigate + resize + screenshot via Playwright MCP.
2. Test widths: **320 / 800 / 1280** (mobile/tablet/desktop), plus the **1024↔1025**
   page-chrome boundary, plus any component-local sub-threshold.
3. Check every page that renders the changed component.
4. Pass/fail = screenshot matches the intended responsive behavior.

Constraints: viewport-only screenshots, cap height ~900px (`browser_resize <w> 900`);
**do not** use `fullPage: true`; output to `.playwright-mcp/` (gitignored, filenames
must start with `.playwright-mcp/`); never commit screenshots — they regenerate per
session. Post them inline in the PR/conversation for one-click review.
