# resources/

Background and frame image assets the compositing pipeline draws on.

> **All rights reserved** — see `LICENSE`. These assets are not covered by the
> repo's MIT license and may not be copied, modified, redistributed, or relicensed
> without the owner's permission. Don't move them into examples or other source in a
> way that relicenses them.

## Assets

| File | Role |
|---|---|
| `marble-background.png` | Base background for individual card / art slides |
| `host-frames-card-discussion.png` | Overlay frame applied on top of a slide (`+0+0`) |
| `title_background.png` | Title-slide background for the grid montage |
| `title_background_w_frame.png` | Keynote background — wordmark + host-frame chrome |
| `title_background_w_hosts.png` | Text-slide background — host frames, **no** wordmark; derived from `title_background_w_frame.png` by patching the wordmark region from `title_background.png` (same underlying art) |

## Optional, user-supplied (gitignored)

`hero.{jpg,jpeg,png,gif}` — an optional hero image placed on the first/last title
slides. Not committed.

The exact coordinates/regions these assets are composited to are documented in the
**`obs-layouts-design`** skill (the single source of truth for the layout spec).
