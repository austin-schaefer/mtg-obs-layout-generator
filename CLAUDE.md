# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. These
instructions override default behavior — follow them exactly.

## Project

OBS streaming-layout generator for Magic: The Gathering — composites card grids
and custom backgrounds for the [Clock Spinning Podcast](https://www.youtube.com/@clockspinning).

**The future of this repo is a static website** so a host or co-host can generate
layouts from the browser (see `docs/website-plan.md` and `BOOTSTRAP.md`). The
existing Python CLI is **legacy** — kept only as a reference for the rough
implementation shape the site will reimplement. Do not treat it as the primary
artifact or extend it with new features; new work targets the site.

## Tech stack

- **The site (primary, being built):** Astro + Tailwind v4 (CSS-first `@theme` tokens) + Netlify. **Static only — no backend, no database.** Anything dynamic happens at build time or client-side.
- **Legacy CLI (reference only):** Python 3 · ImageMagick (`convert`, `magick`, `montage`, `identify`) · `wget` · vendored `scry` Scryfall client.

## Structure

```
docs/                   Decision records & design notes — incl. website-plan.md (see docs/README.md)
BOOTSTRAP.md            Copy-paste prompt to scaffold the static site
.claude/                Agentic harness: settings, skills, agents
.githooks/              pre-commit (sub-README enforcement)
scripts/                Repo + agent wrapper scripts (see scripts/README.md)
resources/              Background/frame assets — all rights reserved (see resources/README.md)

# --- legacy reference (do not extend) ---
download_images.py      Pipeline reference: fetch → composite → grid (SCRY / BOOST / CUSTOM modes)
booster_builder.py      Random booster-pack composer
cleanup.py              Removes generated artifacts
scry                    Vendored Scryfall API client (third-party — do not edit)
legacy_bash_scripts/    Original bash versions (see its README)
```

The legacy pipeline composites onto fixed regions (horizontal art ≤1142×920,
vertical ≤850×1250, fixed centering regions, transparency holes, grid cap
2500×1400). Those numbers are the spec the site must reproduce, so they're
preserved in one place: the **`obs-layouts-design`** skill — read it before
reimplementing the image math.

## Design direction

Nostalgic MTG broadcast aesthetic: marble/parchment surfaces, deep maroon + gold
accents, ornate frames. The **`obs-layouts-design`** skill is the single source of
truth for both the broadcast-layout coordinate system and the (seeded) web design
tokens. Use it whenever you touch layout math, colors, typography, or — later —
any site CSS. For greenfield UI craft, the built-in `frontend-design` skill applies.

## Task management — GitHub Issues + PRs

- Issues describe **outcomes**, not implementations. Acceptance criteria are the contract; the description is context. If they conflict, criteria win.
- **Feature branch → PR → `main`.** Never commit directly to `main`. One focused change per PR.
- Verify each acceptance criterion by **direct observation** (run the CLI, check the output image), not by trusting the description.
- Helpful: `gh issue list`, `gh pr create`, `gh pr view --web`.

## Threat model — this is a PUBLIC repo

**The repository is public and stays public.** Public-repo hardening *is* the
posture (the opposite of a private project's calculus). Therefore:

- **Never commit secrets.** No API keys, tokens, `.env` files, or personal data — ever. `.env*` is gitignored; site secrets go in the Netlify env UI, never the repo or a client bundle.
- **Everything is world-readable.** Branch names, commit messages, issue/PR titles and bodies, and any generated/committed files must be safe for public consumption. No private URLs, no internal notes, no personal info.
- **Asset licensing is a hard boundary.** Files in `resources/` are **all rights reserved** (not MIT like the code). Do not relicense, redistribute, or copy them into examples.
- Before every commit/PR, run the **`public-repo-safety`** skill checklist.

## Conventions

- **Small increments, commit often** — this codebase is precious to its owner; keep changes focused and reversible.
- **Conventional commits** referencing issues where applicable: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`. End commit messages with the standard `Co-Authored-By` trailer.
- **Do-not-touch zones:** `resources/` (licensed assets), the legacy Python (`download_images.py`, `booster_builder.py`, `cleanup.py`) and `scry` (vendored third-party — bundles [scrycall](https://github.com/0xdanelia/scrycall), MIT), and `legacy_bash_scripts/` — all frozen reference. Don't refactor or feature-add them; mine them for the site.
- **Bash shape:** prefer wrapper scripts under `scripts/` over compound one-liners; keeps the permission allowlist clean.
- **Keep docs current.** Update `README.md` (user-facing) and the relevant sub-README when behavior changes. This file is the persistent brain — keep it accurate, don't let it drift.

## Directory READMEs (pre-commit enforced)

`.githooks/pre-commit` blocks a commit that changes code in a tracked directory
without staging that directory's README in the same changeset. Enable once per
clone:

```bash
git config core.hooksPath .githooks
```

Touch code in a tracked dir → update its README in the same commit. Bypass only
when you truly mean it: `git commit --no-verify`.

## Sub-agents

Delegate hands-on coding to the **`code-craftsman`** agent so the main thread keeps
context for architecture. For audit sweeps / parallel fix campaigns, the
**`orchestration-workflow`** skill defines the multi-agent loop (fan out, await
notifications, reviewer-per-PR, cumulative preview, stage-gate). Brief sub-agents
with exact file paths, the issue + acceptance criteria, and a concise report format.

## Legacy commands (reference)

The Python CLI still runs — use it to study the pipeline behavior the site must
reproduce, not as something to extend.

| Command | Purpose |
|---|---|
| `./download_images.py` | Pipeline. Modes: **SCRY** (Scryfall query), **BOOST** (random booster), **CUSTOM** (your own paired images) |
| `./booster_builder.py` | Standalone booster composition |
| `./cleanup.py` | Remove generated artifacts |
| `python3 scry "<query>" --print="%{image_uris.png}"` | Query card data directly |

Generated (gitignored) artifacts: `images_vertical/`, `images_horizontal/`,
`images_export*/`, `images_export_final/`, `grid.png`, `booster_*_urls.txt`.
Legacy CLI requirements: Python 3 · `brew install imagemagick` · `brew install wget`.
