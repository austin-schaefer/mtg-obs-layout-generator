#!/usr/bin/env python3
"""File audit issues after maintainer triage.

Reads an issues spec JSON file and creates one GitHub issue per entry. Supports
posting a comment to an existing issue rather than creating a new one (for overlap
routing). Writes filed-issues.json (idempotent: skips keys already recorded).

Usage:
  python3 pipeline/file_issues.py --repo <owner/repo> --issues <issues-spec.json>
                                   [--filed <path>] [--milestone <name>]

Issues spec JSON format (array of objects):
  [
    {
      "key":       "cache-amplification",   // unique slug for idempotency
      "type":      "bug",                   // bug | feature | chore
      "sev":       "High",                  // GA-blocking | High | Medium | Low
      "milestone": false,                   // true => attach --milestone <name>
      "title":     "CDN cache amplification via uncanonicalized query params",
      "body":      "## Problem\\n..."
    },
    {
      "key":       "_comment_71",           // leading _ => post as comment, not new issue
      "issue":     71,                      // existing issue number to comment on
      "body":      "## Round-N audit comment..."
    }
  ]

filed-issues.json format (written incrementally, idempotent):
  {
    "cache-amplification": { "url": "...", "number": 123, "title": "...", "sev": "High", ... },
    "_comment_71":         { "url": "..." }
  }
"""
import argparse
import json
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("--repo", type=str, required=True,
                    help="GitHub repo in owner/repo form, e.g. austin-schaefer/mtg-obs-layout-generator")
parser.add_argument("--issues", type=Path, required=True,
                    help="Path to issues spec JSON file")
parser.add_argument("--filed", type=Path, default=SCRIPT_DIR / "filed-issues.json",
                    help="Path to filed-issues.json (output, idempotent)")
parser.add_argument("--milestone", type=str, default=None,
                    help="Milestone name to attach to issues with milestone=true")
args = parser.parse_args()

REPO = args.repo
FILED = args.filed
ISSUES = json.loads(args.issues.read_text())


def run(cmd_args):
    return subprocess.run(cmd_args, capture_output=True, text=True, check=True).stdout.strip()


def main():
    filed = json.loads(FILED.read_text()) if FILED.exists() else {}

    for spec in ISSUES:
        key = spec["key"]
        if key in filed:
            print(f"skip (already filed): {key} -> {filed[key].get('url','?')}")
            continue

        # Comment-only entries (key starts with "_" and has an "issue" field)
        if key.startswith("_") and "issue" in spec:
            url = run(["gh", "issue", "comment", str(spec["issue"]),
                       "--repo", REPO, "--body", spec["body"]])
            filed[key] = {"url": url}
            FILED.write_text(json.dumps(filed, indent=2))
            print(f"commented on #{spec['issue']}: {url}")
            continue

        # New issue
        cmd = ["gh", "issue", "create", "--repo", REPO,
               "--title", spec["title"], "--body", spec["body"],
               "--label", "inbox", "--label", "needs-refinement",
               "--label", f"type:{spec['type']}"]
        if spec.get("milestone") and args.milestone:
            cmd += ["--milestone", args.milestone]
        url = run(cmd)
        num = int(url.rstrip("/").split("/")[-1])
        filed[key] = {
            "url": url,
            "number": num,
            "title": spec["title"],
            "sev": spec["sev"],
            "milestone": bool(spec.get("milestone")),
            "sources": spec.get("sources", []),
        }
        FILED.write_text(json.dumps(filed, indent=2))
        print(f"filed #{num}: {spec['title']}")

    actual = len([k for k in filed if not k.startswith("_")])
    comments = len([k for k in filed if k.startswith("_")])
    print(f"\nDone. {actual} issues + {comments} comment(s).")


if __name__ == "__main__":
    main()
