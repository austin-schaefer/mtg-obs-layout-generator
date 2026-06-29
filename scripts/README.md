# scripts/

Wrapper scripts for the repo and the Claude Code agent harness. Prefer adding a
small wrapper here over running compound one-liners — it keeps the permission
allowlist (`.claude/settings.json`) clean and the behavior reviewable.

This directory is **pre-commit tracked**: changing a script here requires staging
this README in the same commit (see `.githooks/pre-commit`).

## Contents

| Script | Purpose |
|---|---|
| `prune-worktrees.sh` | SessionStart hook. Read-only: detects `.claude/worktrees/*` whose branch is already merged to `main` and asks the agent to offer pruning. Never prunes on its own. |
| `link-worktree-settings.sh` | SessionStart / `EnterWorktree` hook. Symlinks `.claude/settings.local.json` from the main repo into a worktree so runtime "Allow always" approvals are shared across sessions. Idempotent; won't clobber a real file. |

Both are wired up in `.claude/settings.json` under `hooks`.

> No `.env`-linking script exists here on purpose: this is a **public, static**
> project with no committed secrets to link (see the `public-repo-safety` skill).

## Future (with the static site)

The site will add dev-server wrappers here (e.g. `dev-start.sh`, `dev-probe.sh`)
so per-worktree dev servers get assigned ports and the orchestration workflow can
run parallel lanes without port collisions.
