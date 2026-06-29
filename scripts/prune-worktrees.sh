#!/usr/bin/env bash
# Detect Claude Code worktrees under .claude/worktrees/ whose branches have
# already been merged to main, and surface them to the agent at session start.
#
# Wired into .claude/settings.json as a SessionStart hook. Behaviour:
#   - Silent (no stdout) when nothing is stale → agent sees nothing, user
#     is not bothered.
#   - When stale worktrees exist, emits a directive on stdout listing them
#     and telling the agent to offer pruning to the user. The hook injects
#     that stdout as additional context for the session.
#
# "Stale" means: branch is an ancestor of origin/main (direct merge) OR a
# merged PR exists for the branch on GitHub (squash-merge case). Worktrees
# with uncommitted or staged changes are never flagged, even if their
# branch is merged.
#
# Read-only. Never prunes on its own.

set -euo pipefail

git_common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_repo=$(dirname "$git_common_dir")
worktrees_dir="$main_repo/.claude/worktrees"

[ -d "$worktrees_dir" ] || exit 0

# Refresh origin/main so merge-base checks against current state. Best-effort;
# offline runs fall back to whatever origin/main was last seen as.
git -C "$main_repo" fetch origin main --quiet 2>/dev/null || true

current_wt=$(pwd -P)
stale=()

while IFS= read -r wt; do
  # Only real worktrees (have .git file or dir).
  [ -e "$wt/.git" ] || continue

  branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue
  [ "$branch" = "HEAD" ] && continue

  # Never flag a worktree with local changes.
  git -C "$wt" diff --quiet --ignore-submodules 2>/dev/null || continue
  git -C "$wt" diff --cached --quiet --ignore-submodules 2>/dev/null || continue

  merged=0
  if git -C "$main_repo" merge-base --is-ancestor "$branch" origin/main 2>/dev/null; then
    merged=1
  elif command -v gh >/dev/null 2>&1; then
    pr_hits=$(gh -R "$(git -C "$main_repo" config --get remote.origin.url)" pr list \
      --head "$branch" --state merged --limit 1 --json number 2>/dev/null || echo "")
    if [ -n "$pr_hits" ] && [ "$pr_hits" != "[]" ]; then
      merged=1
    fi
  fi

  [ "$merged" -eq 1 ] && stale+=("$wt|$branch")
done < <(find "$worktrees_dir" -mindepth 1 -maxdepth 1 -type d)

[ ${#stale[@]} -eq 0 ] && exit 0

# Emit the agent directive. SessionStart hook stdout becomes added context.
printf '[worktree-prune] %d stale worktree(s) detected — branch already merged to main:\n\n' "${#stale[@]}"
for entry in "${stale[@]}"; do
  wt="${entry%|*}"
  br="${entry#*|}"
  marker=""
  [ "$wt" = "$current_wt" ] && marker="  (← current session)"
  printf '  - %s\n    branch: %s%s\n' "$wt" "$br" "$marker"
done

cat <<EOF

IMMEDIATELY call TaskCreate to add a session task for this cleanup, BEFORE responding to the user's first request. Sessions typically start with the user assigning real work, and without a tracked task this gets noticed once and then dropped. The task is the reminder to come back to it.

Suggested task:
  subject:     "Prune stale worktrees (with user permission)"
  description: list the worktree paths + branches above; note that pruning requires user confirmation and must run from the main repo ($main_repo)

When you work the task, confirm with the user first, then from the main repo:

  git worktree remove <path>
  git branch -d <branch>

Skip the worktree marked as the current session — removing it mid-session would pull the rug. The user can prune it from a session started elsewhere.

Do not prune anything unprompted, and do not interrupt the user's first request to handle this — just create the task, then proceed with whatever they asked for.
EOF
