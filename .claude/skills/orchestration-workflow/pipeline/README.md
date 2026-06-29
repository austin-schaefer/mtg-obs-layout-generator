# Audit Pipeline

A reusable scaffold for a multi-persona audit sweep: fan out N independent
auditor agents, aggregate and deduplicate their findings, build a human triage
HTML for maintainer review, then file GitHub issues from the triaged set. This
directory preserves the **machinery** (the 5 scripts + the triage HTML format) —
the transferable part. The binding orchestration playbook is
[`../SKILL.md`](../SKILL.md).

> **The auditor prompts are intentionally not shipped here.** Persona briefs are
> authored fresh per audit by the orchestrator. Checking in a fixed set of
> prompts would bias every future sweep toward the lenses and phrasings of one
> past run — the opposite of the orthogonal, independent coverage the pattern
> depends on. Write new personas each round; only the scripts and the HTML shape
> are meant to persist.

---

## The pattern

1. **Define orthogonal personas.** Pick a handful of independent auditor lenses
   that cover different problem classes (e.g. security, image-pipeline correctness,
   CLI usability, error handling, a11y, code quality, test coverage). Each is a
   self-contained agent brief. Divergence between framings is the point — overlap
   is found and collapsed later, not prevented up front.
2. **Share one contract.** All personas emit findings in the same JSON shape
   (below) to `raw/<persona-slug>.json`, against the codebase at a single pinned
   commit. Keep the auditors blind to each other's output so coverage stays
   independent.
3. **Aggregate → dedup → triage → file.** The 5 scripts take it from raw
   findings to filed issues; the maintainer's only manual touchpoint is the
   triage HTML.

### Raw finding contract (what each auditor writes)

Each `raw/<slug>.json` is one object per reviewer:

```jsonc
{
  "reviewer_id": "image-pipeline-auditor",  // unique slug; falls back to filename
  "persona": "Image pipeline correctness",   // human label
  "primary_lens": "correctness",             // one-word lens, used for sorting
  "self_assessment": { /* free-form, optional */ },
  "findings": [
    {
      "id": "img-01",                         // unique within this reviewer's output
      "title": "…",                           // required; drives dup fingerprinting
      "severity": "GA-blocking|High|Medium|Low",
      "ga_blocking": false,                    // bool; sorts above severity
      "pm_impact": "…",                        // plain-language user/PM impact
      "files": ["download_images.py"],         // optional
      "detail": "…"                            // evidence / repro / rationale
    }
  ]
}
```

`aggregate.py` only hard-requires `title` + `severity`; the rest flows through to
the triage HTML, so richer findings produce a richer review.

---

## 5-stage pipeline

### Stage 1 — Spawn personas, collect raw findings

**Consumes:** the persona briefs you authored this round + the codebase at a
pinned commit.
**Produces:** `raw/<persona-slug>.json`, one file per auditor.
**How to run:** Spawn the auditors in parallel via the orchestration skill
(`../SKILL.md`), each writing its own JSON to a shared `tmp/audit-<round>/raw/`.

### Stage 2 — Aggregate

**Consumes:** `raw/*.json`.
**Produces:** `aggregated.json` — all findings sorted by severity and
fingerprint-grouped to surface likely duplicates.
```
python3 pipeline/aggregate.py --raw-dir tmp/audit-<round>/raw --out tmp/audit-<round>/aggregated.json
```

### Stage 3 — Orchestrator dedup (`finalize_dedup.py`)

**Consumes:** `aggregated.json`.
**Produces:** `deduped.json` — the canonical finding set after the orchestrator's
by-hand review (merges, withdrawals, severity overrides, auto-singletons).
**How to run:** Fill in the `WITHDRAWN`, `MERGES`, and `OVERRIDES` constants
(empty templates near the top of the script, marked `--- EDIT PER ROUND ---`) to
reflect your read of `aggregated.json`, then:
```
python3 pipeline/finalize_dedup.py --agg tmp/audit-<round>/aggregated.json \
    --out tmp/audit-<round>/deduped.json --commit <sha>
```
This stage is the orchestrator's intellectual work: collapsing true duplicates,
deciding final severity, writing the merged `pm_impact`.

### Stage 4 — Build triage HTML

**Consumes:** `deduped.json`.
**Produces:** a self-contained interactive HTML review UI.
```
python3 pipeline/build_triage_html.py --deduped tmp/audit-<round>/deduped.json \
    --out tmp/audit-<round>-triage.html
```
The maintainer opens it, reads the PM-impact blurbs, marks drops, adds notes,
then uses "Copy notes JSON" and hands the result back to the orchestrator.
Notes persist to `localStorage` under the key `obs-layouts-audit` so closing the
tab doesn't lose work.

### Stage 5 — File issues (`file_issues.py`) + post summary (`build_summary.py`)

**Consumes:** maintainer triage notes + an orchestrator-authored issues-spec JSON
(array of objects; schema in the `file_issues.py` docstring).
**Produces:** `filed-issues.json` (idempotent — skips already-filed keys), the
GitHub issues themselves, and a severity-sorted summary comment on the tracking
issue.
```
python3 pipeline/file_issues.py --repo austin-schaefer/mtg-obs-layout-generator \
    --issues tmp/audit-<round>/issues-spec.json \
    --filed tmp/audit-<round>/filed-issues.json --milestone "v1.0"

python3 pipeline/build_summary.py --repo austin-schaefer/mtg-obs-layout-generator \
    --issue <tracking-issue-n> \
    --filed tmp/audit-<round>/filed-issues.json \
    --pm-blurbs tmp/audit-<round>/pm-blurbs.json \
    --round <n> --raw-total <N> --dedup-total <N> --commit <sha>
```

---

**Note on public safety:** obs-layouts is a public GitHub repo. Every issue title,
body, and comment filed by these scripts is publicly visible. Review `issues-spec.json`
for public-safety before running `file_issues.py` — no secrets, tokens, or private
data should appear in any filed issue. See the `public-repo-safety` skill.
