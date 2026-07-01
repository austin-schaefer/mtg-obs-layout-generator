# CLAUDE.md

Guidance for Claude Code working in this repository. These instructions override
default behavior — follow them exactly.

## Project

obs-layouts generates OBS streaming layouts for Magic: The Gathering — composited
card grids and slide backgrounds for the [Clock Spinning Podcast](https://www.youtube.com/@clockspinning).
A host chooses some cards — a Scryfall search, a set code to roll a random booster,
or their own images — and gets back broadcast-ready slides and a montage grid.

It's a static website: Astro + Tailwind v4, deployed on Netlify, with no backend and
no database. The image pipeline runs in the browser or at build time.

The compositing pipeline is also written as Python scripts (`download_images.py`,
`booster_builder.py`) that define its exact behavior — fit-resize, region placement,
frame overlay, transparency holes, grid montage. The coordinate spec is captured in
the **`obs-layouts-design`** skill.

## Tech stack

- **Site:** Astro + Tailwind v4 (CSS-first `@theme` tokens), static on Netlify. No backend, no database.
- **Pipeline:** ImageMagick compositing + the `scry` Scryfall client. The Python scripts use `convert` / `magick` / `montage` / `identify`.

## Structure

```
.claude/                Agentic harness: settings, skills, agents
.githooks/              pre-commit (sub-README enforcement)
scripts/                Repo + agent wrapper scripts (see scripts/README.md)
resources/              Background / frame image assets (see resources/README.md)
download_images.py      Pipeline: fetch → composite → grid (SCRY / BOOST / CUSTOM modes)
booster_builder.py      Random booster-pack composer
cleanup.py              Removes generated artifacts
scry                    Scryfall API client (vendored third-party)
legacy_bash_scripts/    Earlier bash implementation (see its README)
```

The pipeline composites onto fixed regions (horizontal art ≤1142×920, vertical
≤850×1250, transparency holes, grid capped at 2500×1400). The exact coordinate spec
lives in the **`obs-layouts-design`** skill — read it before working on image math.

## Design direction

Nostalgic MTG broadcast aesthetic: marble/parchment surfaces, deep maroon + gold
accents, ornate frames. The **`obs-layouts-design`** skill is the single source of
truth for the layout coordinate system and the web design tokens — use it whenever
you touch layout math, colors, typography, or CSS. For greenfield UI craft, the
built-in `frontend-design` skill applies.

## Task management — GitHub Issues + PRs

- Issues describe **outcomes**, not implementations. Acceptance criteria are the contract; the description is context. If they conflict, criteria win.
- **Feature branch → PR → `main`.** Never commit directly to `main`. One focused change per PR.
- **Never open a PR without a local review with the owner first.** Commit and push freely, then walk the owner through the diff locally and get an explicit go-ahead before running `gh pr create`. No surprise PRs.
- Verify each acceptance criterion by **direct observation**, not by trusting the description.
- Helpful: `gh issue list`, `gh pr view --web`.

## Public repo

This repository is public. Everything committed is world-readable.

- **No secrets, ever.** No API keys, tokens, `.env` files, or personal data. `.env*` is gitignored; any site key goes in the Netlify env UI, never the repo or a client bundle.
- **Public-safe everything.** Branch names, commit messages, issue/PR titles and bodies, and committed files must be fine for anyone to read.
- **Assets are not MIT.** `resources/` is all rights reserved (see `LICENSE`); don't relicense, redistribute, or copy it into examples.
- Run the **`public-repo-safety`** skill before each commit/PR.

## Conventions

- **Small increments, commit often** — keep changes focused and reversible.
- **Always serve a local preview** (`npx astro dev`) when presenting work to the owner, so they can see it running rather than just read a diff.
- **Conventional commits** referencing issues where applicable: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`. End messages with the standard `Co-Authored-By` trailer.
- **Do-not-touch zones:** `resources/` (licensed assets) and `scry` (vendored third-party — bundles [scrycall](https://github.com/0xdanelia/scrycall), MIT).
- The Python scripts and `legacy_bash_scripts/` define the pipeline's behavior — build the site rather than extending them.
- **Bash shape:** prefer wrapper scripts under `scripts/` over compound one-liners; keeps the permission allowlist clean.
- **Keep docs current.** Update `README.md` and the relevant sub-README when behavior changes. This file is the persistent brain — keep it accurate.
- **Knowledge lives in committed files, not agent memory.** Anything about the project or harness goes in committed files (`CLAUDE.md`, `.claude/skills/`) so it's versioned and shared.

## Directory READMEs (pre-commit enforced)

`.githooks/pre-commit` blocks a commit that changes code in a tracked directory
without staging that directory's README in the same changeset. Enable once per clone:

```bash
git config core.hooksPath .githooks
```

Touch code in a tracked dir → update its README in the same commit. Bypass only when
you truly mean it: `git commit --no-verify`.

## Sub-agents

Delegate hands-on coding to the **`code-craftsman`** agent so the main thread keeps
context for architecture. For audit sweeps / parallel fix campaigns, the
**`orchestration-workflow`** skill defines the multi-agent loop (fan out, await
notifications, reviewer-per-PR, cumulative preview, stage-gate). Brief sub-agents with
exact file paths, the issue + acceptance criteria, and a concise report format.

## Pipeline scripts

| Command | Purpose |
|---|---|
| `./download_images.py` | Pipeline. Modes: **SCRY** (Scryfall query), **BOOST** (random booster), **CUSTOM** (your own paired images) |
| `./booster_builder.py` | Standalone booster composition |
| `./cleanup.py` | Remove generated artifacts |
| `python3 scry "<query>" --print="%{image_uris.png}"` | Query card data directly |

Generated (gitignored) artifacts: `images_vertical/`, `images_horizontal/`,
`images_export*/`, `images_export_final/`, `grid.png`, `booster_*_urls.txt`.
Requires Python 3, ImageMagick, and wget.
