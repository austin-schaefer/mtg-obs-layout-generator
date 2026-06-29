#!/usr/bin/env python3
"""Post the severity-sorted summary table on the audit tracking issue.

Reads filed-issues.json (written by file_issues.py) and posts a formatted
Markdown comment to the specified audit tracking issue via `gh`.

Usage: python3 pipeline/build_summary.py [--filed <path>] [--repo <owner/repo>] [--issue <n>]
       [--round <n>] [--raw-total <n>] [--dedup-total <n>] [--filed-total <n>]
       [--commit <sha>] [--pm-blurbs <json-file>]

The --pm-blurbs flag points to a JSON file mapping issue keys to one-line PM-audience
impact strings (impact on the project / end users, not the mechanism). Example:
  { "image-pipeline-crash": "Card images silently fail to export when paths contain spaces." }
If omitted, the issue title is used as the impact string instead.
"""
import argparse
import json
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("--filed", type=Path, default=SCRIPT_DIR / "filed-issues.json")
parser.add_argument("--repo", type=str, required=True,
                    help="GitHub repo in owner/repo form, e.g. austin-schaefer/mtg-obs-layout-generator")
parser.add_argument("--issue", type=int, required=True,
                    help="Issue number to post the summary comment on (the audit tracking issue)")
parser.add_argument("--round", type=int, default=None,
                    help="Audit round number for the summary header (optional)")
parser.add_argument("--raw-total", type=int, default=None,
                    help="Raw finding count before dedup (optional, for summary header)")
parser.add_argument("--dedup-total", type=int, default=None,
                    help="Deduped finding count after orchestrator pass (optional)")
parser.add_argument("--filed-total", type=int, default=None,
                    help="Number of issues filed (optional, computed from filed.json if omitted)")
parser.add_argument("--commit", type=str, default=None,
                    help="Short commit SHA audited (optional)")
parser.add_argument("--pm-blurbs", type=Path, default=None,
                    help="JSON file mapping issue key -> one-line PM impact string")
args = parser.parse_args()

filed = json.loads(args.filed.read_text())
pm_blurbs = json.loads(args.pm_blurbs.read_text()) if args.pm_blurbs else {}

SEV_ORDER = {"GA-blocking": 0, "High": 1, "Medium": 2, "Low": 3}
rows = []
for key, info in filed.items():
    if key.startswith("_"):
        continue
    rows.append((info["sev"], info["number"], pm_blurbs.get(key, info["title"])))
rows.sort(key=lambda r: (SEV_ORDER[r[0]], r[1]))

counts: dict[str, int] = {}
for sev, _, _ in rows:
    counts[sev] = counts.get(sev, 0) + 1

actual_filed = len([k for k in filed if not k.startswith("_")])
round_label = f"Round {args.round} — " if args.round else ""
raw_info = f"{args.raw_total} raw → " if args.raw_total else ""
dedup_info = f"{args.dedup_total} deduped → " if args.dedup_total else ""
commit_info = f" · commit `{args.commit}`" if args.commit else ""

lines = []
lines.append(f"## {round_label}audit results\n")
lines.append(
    f"**{raw_info}{dedup_info}maintainer triage → {actual_filed} issues filed.**{commit_info}\n"
)
lines.append(
    f"GA-blocking: {counts.get('GA-blocking',0)} · High: {counts.get('High',0)} · "
    f"Medium: {counts.get('Medium',0)} · Low: {counts.get('Low',0)}\n"
)
lines.append("| Severity | Issue | Impact (PM view) |")
lines.append("|---|---|---|")
for sev, num, pm in rows:
    lines.append(f"| {sev} | #{num} | {pm} |")

body = "\n".join(lines)

url = subprocess.run(
    ["gh", "issue", "comment", str(args.issue), "--repo", args.repo, "--edit-last", "--body", body],
    capture_output=True, text=True, check=True,
).stdout.strip()
print(f"Posted/edited summary on #{args.issue}: {url}")
print(f"Rows: {len(rows)} | {counts}")
