#!/usr/bin/env bash
# Symlink .claude/settings.local.json from the main worktree into the current
# worktree so runtime "Allow always" approvals are shared across all sessions.
#
# Background: `.claude/settings.json` is tracked in git and so flows into every
# worktree automatically — that's the explicit allowlist. The companion
# `.claude/settings.local.json` is gitignored and is where Claude Code writes
# anything the user clicks "Allow always" on at runtime. Each worktree is its
# own Claude Code project (separate ~/.claude/projects/<encoded-path>/
# transcript dir), so without this hook each worktree maintains its own
# settings.local.json and the user re-approves the same patterns over and over.
#
# Strategy: symlink the worktree's settings.local.json at the main repo's, so
# any future approval — wherever made — writes to a single shared file and
# benefits every session.
#
# Idempotent. Refuses to clobber an existing real settings.local.json (a
# worktree may have its own approvals that aren't yet in main); the user can
# delete the worktree file manually after eyeballing the diff, then re-run.

set -euo pipefail

git_common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
main_repo=$(dirname "$git_common_dir")
cwd=$(pwd -P)

# No-op in the main repo itself.
[ "$cwd" = "$main_repo" ] && exit 0

src="$main_repo/.claude/settings.local.json"
mkdir -p "$main_repo/.claude" .claude

# If main doesn't have one yet, seed it empty so the symlink target exists.
[ -f "$src" ] || printf '{\n  "permissions": {\n    "allow": []\n  }\n}\n' > "$src"

target=".claude/settings.local.json"

if [ -L "$target" ]; then
  [ "$(readlink "$target")" = "$src" ] && exit 0
  rm "$target"
elif [ -e "$target" ]; then
  # Real file — don't clobber, the worktree may have unmerged approvals.
  echo "skip: $target is a real file; merge into main and remove to enable sharing" >&2
  exit 0
fi

ln -sfn "$src" "$target"
echo "linked $target -> $src" >&2
