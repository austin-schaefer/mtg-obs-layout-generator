---
name: public-repo-safety
description: "Keep this PUBLIC repo safe for public consumption. Use before every commit, push, branch, PR, or issue, and whenever adding config, env handling, dependencies, or anything that could carry a secret. Triggers: 'commit', 'push', 'open a PR', 'create an issue', 'is this safe to publish', 'add env / secret / API key', 'before merge', 'public repo'."
---

# Public-repo safety

This repository is public. Everything you commit or publish — code, branch names,
commit messages, issue/PR titles and bodies, generated files — is world-readable.
Before any commit, push, branch, PR, or issue, make sure it's safe for anyone to see.

## Pre-commit / pre-push checklist

Run before staging a commit or opening a PR:

1. **Review the diff, not just the summary.** `git diff --cached` (and `git diff` for
   unstaged). Read what's actually changing.
2. **Scan for secrets.** No API keys, tokens, passwords, OAuth client secrets,
   private endpoints, signing keys, or session cookies. Quick sweep over staged
   changes:
   ```bash
   git diff --cached | grep -niE '(api[_-]?key|secret|token|password|passwd|bearer|authorization|client[_-]?secret|private[_-]?key|BEGIN [A-Z ]*PRIVATE KEY)'
   ```
   Any hit → stop and confirm it's a false positive (e.g. the literal word in prose)
   before continuing.
3. **No personal / private data.** No real emails, home paths that leak identity
   beyond what's already public, private URLs, unpublished plans you don't want
   public, or third parties' info (e.g. the co-host's details) without consent.
4. **No env files.** `.env`, `.env.local`, `*.key`, `*.pem`, `secrets.*` are
   gitignored — confirm none slipped in via `-f` or a renamed path.
5. **Asset license boundary.** `resources/` art is **all rights reserved** (the code
   is MIT). Don't copy those assets into examples, docs, or the site's committed
   source in a way that relicenses or redistributes them.
6. **Generated junk stays out.** Layout artifacts (`images_*`, `grid.png`,
   `booster_*_urls.txt`), `node_modules/`, `dist/`, `.DS_Store`, screenshots — all
   gitignored; confirm the diff is only intentional source.

## Public-safe naming & writing

- **Branch names, commit messages, issue/PR titles & bodies** are public. Keep them
  professional and free of secrets, internal-only context, or anything you wouldn't
  want a stranger to read. No pasting raw logs/tokens into issue comments.
- Reference issues by number; don't paste private correspondence.

## Building the site safely (Astro + Netlify, static)

- The site is **static with no backend** — there should be no server secret to leak.
- If a build step ever needs a key (e.g. a higher-rate API), it goes in the
  **Netlify environment-variables UI**, read at build time only — **never** committed
  and **never** shipped in a client bundle. Anything reaching `client:*` / browser JS
  is public. Scryfall's API needs no key; keep it that way if possible.
- Keep `.env.example` (documented placeholders) in the repo if helpful; keep real
  `.env*` out.

## If a secret was already committed

Rotating the secret is the real fix — assume anything pushed is compromised. Rotate
it first, then scrub history (`git filter-repo` / BFG) and force-push only with the
owner's explicit say-so. Tell the owner immediately; don't quietly paper over it.

## One-line gate

> Would I be comfortable with a stranger reading this exact change, message, or
> name on the public internet, forever? If not, fix it before it lands.
