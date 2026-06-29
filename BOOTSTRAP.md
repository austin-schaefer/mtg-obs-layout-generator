# BOOTSTRAP.md

A copy-paste prompt for scaffolding the **obs-layouts static site** with Claude Code.
Paste the block below into a fresh Claude Code session in this repo when you're ready
to start the site build. It front-loads the non-negotiable constraints so the agent
plans within them.

> Read this alongside `docs/website-plan.md` (architecture + the compositing
> decision) and the `obs-layouts-design` skill (the layout spec + web tokens).

---

## The prompt

```
We're turning this repo's legacy Python layout generator into a static website.
Before writing any code, enter plan mode and read: CLAUDE.md, docs/website-plan.md,
and the obs-layouts-design skill. The legacy Python (download_images.py,
booster_builder.py, scry) is the behavior reference — do not edit it.

Tech stack (non-negotiable):
- Astro + Tailwind v4 (CSS-first @theme tokens, no tailwind.config.js)
- Netlify static hosting — STATIC ONLY, no backend, no database, no serverless
  functions
- Self-hosted fonts (no CDNs)
- TypeScript strict; path alias ~/ → src/

Constraints (non-negotiable):
- PUBLIC repo. Never commit secrets or .env; aim for ZERO secrets (Scryfall needs
  no key). Anything in client JS is public. Run the public-repo-safety checklist
  before each commit. resources/ assets are all rights reserved — don't relicense.
- Conventional commits referencing issues; feature branch → PR → main, never commit
  to main directly.
- Mobile-responsive from day one per the obs-layouts-design breakpoints.
- Reproduce the legacy layout spec exactly (regions, transparency holes, grid cap)
  as documented in the obs-layouts-design skill.

Phase 1 scope:
1. Scaffold Astro + Tailwind v4 + TypeScript; wire design tokens from
   obs-layouts-design into src/styles/global.css (@theme).
2. Set up Netlify static deploy (netlify.toml), add a CI build check.
3. Build the page shell + the generator UI (mode picker: SCRY / BOOST / CUSTOM;
   query/set-code/grid inputs).
4. Prototype the compositing decision from docs/website-plan.md (WASM ImageMagick
   vs Canvas) on a SINGLE slide; measure bundle size + speed before committing to
   one. Report back before building the full pipeline.
5. Add src/README.md (the pre-commit hook enforces it for tracked dirs).

Add a .gitignore is already present. Set up the repo: run
`git config core.hooksPath .githooks` so the pre-commit README hook is active.

Important:
- Static + zero-backend is a hard line. If something seems to need a server, stop
  and discuss — there's almost always a client-side or build-time alternative.
- Plan mode first. Present the plan (incl. the framework choice for the interactive
  island and the compositing approach) before implementing.
```

---

## After Phase 1

Move to an issue-driven cadence: file issues describing outcomes (acceptance
criteria are the contract), work them on feature branches, PR into `main`, verify
each criterion by direct observation. For larger sweeps, the `orchestration-workflow`
skill defines the multi-agent loop.

## Production notes (fill in when deploying)

- Netlify site name / URL: _TBD_
- Custom domain / DNS: _TBD_
- Pre-launch: add a `noindex` flag until ready, then remove.
- Env vars: aim for none. If one becomes necessary, set it in the Netlify env UI
  only — never in the repo.
