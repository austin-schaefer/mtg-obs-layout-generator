# resources/

Background and frame assets used by the legacy compositing pipeline and (later)
the static site.

> **License: ALL RIGHTS RESERVED.** Unlike the repository's MIT-licensed code,
> these assets may not be copied, modified, redistributed, or relicensed without
> the owner's permission. Do not move them into examples or the site's source in a
> way that relicenses them. This is a hard boundary on a public repo — see the
> `public-repo-safety` skill.

## Assets

| File | Role |
|---|---|
| `marble-background.png` | Base background for individual card / art slides |
| `host-frames-card-discussion.png` | Overlay frame applied on top of a slide (`+0+0`) |
| `title_background.png` | Title-slide background for the grid montage |
| `title_background_w_frame.png` | Title-slide background variant with frame |

## Optional, user-supplied (gitignored)

`hero.{jpg,jpeg,png,gif}` — an optional hero image placed on the first/last title
slides. Not committed.

The exact coordinates/regions these assets are composited to are documented in the
**`obs-layouts-design`** skill (the single source of truth for the layout spec).
