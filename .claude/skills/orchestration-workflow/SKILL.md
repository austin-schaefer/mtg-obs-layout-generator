---
name: orchestration-workflow
description: "Multi-agent orchestration playbook for obs-layouts audit sweeps and fix campaigns. Use when orchestrating an audit (security, code-excellence, a11y), bundling audit findings into fix waves, dispatching parallel fix-agents, running per-PR reviewers, building cumulative preview branches, or running a mop-up sweep of audit residue. Triggers: 'orchestrate', 'multi-agent fix', 'fix wave', 'audit fixes', 'bundle audit findings', 'sweep PRs', 'cumulative preview', 'parallel fix-agents', 'reviewer-per-PR'."
---

## When to use

- An audit orchestration ticket exists and you're driving it.
- A pile of issues needs to land in parallel fix-PRs.
- You're stacking finished fix-PRs into a cumulative preview branch for end-to-end validation before any go to `main`.
- A mop-up sweep needs to clear residue (drift, regressions, leftover-from-triage).

Skip if it's a single-issue change.

## Loop

1. **Inventory the issues.** `gh issue view <orchestrator>` for the AC + the wrap-up comment. List the child issues with `gh issue list`. For each, pull title + AC; do not start reading bodies in full.
2. **Plan-agent bundles into waves.** One sub-agent reads all issue bodies and returns a JSON plan: `{wave, branch_name, issues, est_files_touched, risk_notes}`. Bundle related findings into one PR per maintainer preference — experience shows that grouping related work into one branch reduces review fatigue and merge-order complexity; resist the urge to split every finding into its own PR. Smallest-touch branches go first within a wave.
3. **Dispatch fix-agents in parallel-background.** Confirm with the user what model to use for sub-agents, if they didn't specify. One sub-agent per branch, each in its own worktree on its own port. Spawn as background tasks; you'll be notified as they land. Do not poll.
4. **Reviewer fires on completion.** Each fix-agent's task-notification triggers an independent reviewer sub-agent (separate worktree). Reviewer posts its verdict (ready to merge; or has issues that must be addressed) to the PR as a one line comment.
5. **Merge wave into cumulative preview branch.** Branch `preview/<orchestrator>` off `main`; merge LGTM'd PR branches in order (smallest-touch first). Validate: currently run the Python CLI (`./download_images.py`) and any available test scripts; when the Astro site lands, add `npm run build` + `npx astro check` (those commands do not exist yet — note them in the checklist so they get picked up automatically once the site ships). Push. Leave any dev server running on a fixed port; share probe URLs.
6. **Stage-gate.** Pause for the user before the next wave or merge-to-main. The cumulative preview branch is the user-verifiable checkpoint — always give the user a chance to click through before merging to `main`. Staged verification is load-bearing; do not skip it even when the wave looks clean.

## HTML triage pattern

For audit orchestrators (steps before fix waves): Every dedup pass terminates in `tmp/<audit>/triage.html` — never in `gh issue create` directly.

- One finding per row. Columns: severity / action / type / reviewer-count chips, PM-audience summary, technical detail, file refs, AC bullets.
- Per-row textarea (autosaves to `localStorage` keyed by finding id).
- Per-row "Drop this" checkbox.
- "Copy notes" button exports `{[id]: {note, drop}}` JSON to the clipboard.
- Maintainer reviews, marks drops, pastes notes back; only then does the orchestrator file issues.

This is non-negotiable. Experience across multiple audit rounds shows that 40–50% of deduped findings get dropped on maintainer triage — as already-tracked items, post-launch-only scope, or design-call findings. Filing without triage wastes the team's time on noise. See `pipeline/build_triage_html.py` for the working template.

## Worker (fix-agent) model

```
model: XXX
subagent_type: code-craftsman   # or main-thread Opus for higher-judgment fixes
worktree: .claude/worktrees/fix-<branch>/
port: PORT=43XX <dev-server-script>   # never bare; see Sharp edges
result: tmp/orchestration-<n>/wave<k>/<issue>.json
```

Each fix-agent gets a brief containing: issue numbers + ACs verbatim, the branch name, the worktree path, the assigned port, the result-JSON schema, and a hard "no compound shells / no env-prefixes / wrapper scripts only" rule (failure to enforce this up front produces an approval storm that stalls the whole wave — add the wrapper script rather than approving ad-hoc compound shells). Result JSON:

```json
{"issues": "325,326", "branch": "...", "pr_url": "...", "pr_number": N,
 "summary": "...", "verification": ["test 342/342", "probe of /404 ..."],
 "concerns": "..."}
```

Fix-agents open the PR themselves (`gh pr create`) before terminating. PR body starts with `Closes #<n>` lines.

## Reviewer model

Separate agent. Own worktree (so checking out the PR branch doesn't disturb the fix-agent's or the orchestrator's). **Independent verification, not re-running the author's commands** — reviewers who merely re-run what the author ran miss the class of bugs the author didn't think to probe. Concretely:

- Check out the PR branch fresh.
- Run the test suite.
- Probe 3-5 surfaces the author *didn't* mention, in addition to ones they did.
- For visual changes: use the `obs-layouts-design` skill for screenshot comparison.
- Verdict goes to a single one-line `gh pr comment` (e.g. `LGTM — 342/342 pass, probed 12 routes incl. 3 garbage URLs, h1 + canonical contract holds`).

Result JSON same shape as fix-agent's, plus `{verdict, comment_url, evidence: [...]}`.

## Cumulative preview branch

On conflict: stop and ask. Do not auto-resolve. Use a JSON halt record like `{step_failed, conflicts: {file: {kind, ours_summary, theirs_summary}}}` to capture the state cleanly before stopping.

The cumulative branch is *not* the merge-to-main path — it's the integration test. Once it's green and the user has clicked through preview URLs, individual PRs merge to `main` in dependency order (or `gh pr merge` the preview branch as one if the user prefers; ask).

## Sharp edges

**Verification is load-bearing.** Reviewers MUST probe surfaces the AC didn't name, vet against preview builds. The reviewer can and MUST override the PR author if their independent probe contradicts the author's claim.

**Sub-agents over-prune content-judgment work.** Parallelize mechanical restructure; serialize content-pruning. For audit triage, prefer the orchestrator doing the dedup pass over delegating it.

**Port collisions kill sibling worktrees.** When a dev server is introduced (it arrives with the Astro site), dev-start must kill LISTEN owners on bind. Default port 4321 is almost always another worktree's. Always assign a port per lane (`PORT=43XX <script>`) with the port pre-assigned at orchestration start. Scan 4321–4330 once at orchestration start; allocate one port per worktree. Until dev-server scripts exist, this discipline is cosmetic — note it in the brief anyway so sub-agents don't race on a future default.

**Read-tool cache anomalies under heavy parallel work.** After 8 parallel fix-agents have read the same files, the main orchestrator's Read may return stale content for files those agents wrote. When in doubt re-Read or run `git show HEAD:<path>` to anchor on the on-disk truth.

**Never poll, await notifications.** Background sub-agents fire task-notifications on completion. Don't sleep-loop; let the harness wake you. Write each landed result to `tmp/orchestration-<n>/wave<k>/<id>.json` immediately so a session hiccup doesn't lose it — incremental writes have saved multiple audit runs from losing all per-wave state on a timeout.

**Bias to broad whitelist; never per-call approve.** The predictable cost of heavy delegation is an approval storm: the same Bash shape appears across sub-agents and each instance requires a manual approval. The moment a Bash shape repeats across sub-agents, add a `settings.local.json` rule or write a wrapper script. Never approve the same shape twice in one session.

**Sub-agent brief Bash discipline.** Hard-restrict spawned sub-agents to: wrapper scripts under `scripts/`, single-verb commands (`gh <noun> <verb> <args>`, `git <verb> <args>`, `npm <verb> <args>`), no `&&`/`||`/`;`/`|`/`2>&1`/env-prefixes/`$(...)`/HEREDOCs except the one `gh pr create` body shape. Each compound shape that slips through becomes its own approval entry.

**Triage drops are signal, not failure.** A 40–50% triage-drop rate is normal and healthy for broad sweeps. Most drops are already-tracked items, post-launch-only scope, or findings that are design calls outside the current mandate.

**This is a PUBLIC repository.** Every PR title, branch name, issue title, issue body, and inline comment is publicly visible to anyone on the internet. Before filing issues or posting PR comments, verify they are public-safe: no secrets, tokens, API keys, personal data, internal service URLs, or private customer information. See the `public-repo-safety` skill for a pre-flight checklist.

## Anti-patterns

- Filing issues directly from reviewer output — always pass through the maintainer-reviewed triage HTML.
- Sequential delegation when waves are independent — fan out, then await notifications.
- Re-running the author's verification as "the review" — write an independent probe set.
- Auto-resolving merge conflicts in the cumulative preview branch — halt and ask.
- Letting fix-agents open ad-hoc dev servers on default port — every lane gets an assigned port up front.
- Treating LGTM as merge authorization — LGTM means "this PR's claim is independently verified." The merge-to-main decision is the user's, after the cumulative preview is green.
- Polling for sub-agent completion. The harness will wake you.
- Approving the same Bash shape twice in one session. Edit settings or write a wrapper script the first time it repeats.
