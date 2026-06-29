#!/usr/bin/env python3
"""Orchestrator dedup pass — encodes the orchestrator's by-hand dedup decisions.

Edit the WITHDRAWN, MERGES, and OVERRIDES constants below for each new audit run,
then run: python3 pipeline/finalize_dedup.py [--agg <path>] [--out <path>]

  - WITHDRAWN: source finding IDs excluded (author retracted).
  - MERGES:    multiple raw findings collapsed into one deduped finding (authored
               title/pm_impact + union of files/AC + concatenated technical).
  - OVERRIDES: singleton findings that need a severity bump, overlap tag, or
               regression/orchestrator note (but are NOT merged with anything).
  - Everything else: auto-singleton inheriting the source finding's own fields.

Writes deduped.json in the schema build_triage_html.py expects.

Usage: python3 pipeline/finalize_dedup.py [--agg <path>] [--out <path>] [--commit <sha>]
Defaults: aggregated.json and deduped.json alongside this script.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("--agg", type=Path, default=SCRIPT_DIR / "aggregated.json")
parser.add_argument("--out", type=Path, default=SCRIPT_DIR / "deduped.json")
parser.add_argument("--commit", type=str, default="HEAD",
                    help="Short commit SHA the audit was run against (cosmetic, shown in triage HTML)")
args = parser.parse_args()

AGG = json.loads(args.agg.read_text())
OUT = args.out
COMMIT = args.commit

by_id = {f["id"]: f for f in AGG["findings"]}

# ---------------------------------------------------------------------------
# RUN-SPECIFIC DATA — replace these for each new audit
# ---------------------------------------------------------------------------

# Finding IDs the author retracted mid-analysis.
WITHDRAWN: set[str] = set()

# Dedup merges: multiple raw findings collapsed into one canonical finding.
# Each entry becomes one row in deduped.json. Members are source finding IDs.
# Required keys: dedup_id, members, severity, primary_lens, title, pm_impact.
# Optional: regression_of, overlaps_open_issue, orchestrator_notes.
MERGES: list[dict] = [
    # Example:
    # {
    #     "dedup_id": "audit-rate-limit-bypass",
    #     "members": ["persona-a-01", "persona-b-03"],
    #     "severity": "High", "primary_lens": "security",
    #     "title": "Rate-limiter reads attacker-controlled header",
    #     "pm_impact": "An attacker can bypass the per-IP cap by spoofing the header.",
    #     "orchestrator_notes": "Found independently by two reviewers — high confidence.",
    # },
]

# Singleton overrides: adjust severity/tags/notes for a finding without merging it.
# Keys that can be overridden: severity, primary_lens, title, regression_of,
#   overlaps_open_issue, orchestrator_notes.
OVERRIDES: dict[str, dict] = {
    # "persona-a-02": {
    #     "severity": "High",
    #     "orchestrator_notes": "Core of the cache-amplification class.",
    # },
}

# ---------------------------------------------------------------------------
# Pipeline logic (do not edit below this line)
# ---------------------------------------------------------------------------

SEV_ORDER = {"GA-blocking": 0, "High": 1, "Medium": 2, "Low": 3}


def src_row(f):
    return {
        "reviewer_id": f["_reviewer_id"],
        "finding_id": f["id"],
        "severity": f["_severity_norm"],
        "title": f["title"],
        "ga_blocking": f["_ga_blocking"],
    }


def union(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


merged_ids: set[str] = set()
deduped: list[dict] = []

# Build merged clusters
for m in MERGES:
    members = [by_id[i] for i in m["members"] if i in by_id]
    merged_ids.update(m["members"])
    base = members[0]
    files = union([p for f in members for p in f.get("files", [])])
    acs = union([a for f in members for a in f.get("acceptance_criteria", [])])
    tech_parts = []
    for f in members:
        tech_parts.append(f"[{f['_reviewer_id']} · {f['id']}]\n{f.get('technical','')}")
    reviewers = union([f["_reviewer_id"] for f in members])
    lenses = union([f["_lens"] for f in members])
    sevs = {f["_severity_norm"] for f in members}
    deduped.append({
        "dedup_id": m["dedup_id"],
        "title": m["title"],
        "severity": m["severity"],
        "ga_blocking": m["severity"] == "GA-blocking",
        "primary_lens": m["primary_lens"],
        "raw_finding_count": len(members),
        "reviewer_count": len(reviewers),
        "lens_count": len(lenses),
        "regression_of": m.get("regression_of"),
        "overlaps_open_issue": m.get("overlaps_open_issue"),
        "severity_disagreement": len(sevs) > 1,
        "pm_impact": m["pm_impact"],
        "technical": "\n\n".join(tech_parts),
        "files": files,
        "acceptance_criteria": acs,
        "remediation_hint": " / ".join(union([f.get("remediation_hint", "") for f in members if f.get("remediation_hint")])),
        "orchestrator_notes": m.get("orchestrator_notes", ""),
        "sources": [src_row(f) for f in members],
    })

# Auto-singletons for everything else (minus withdrawn)
for f in AGG["findings"]:
    if f["id"] in WITHDRAWN or f["id"] in merged_ids:
        continue
    ov = OVERRIDES.get(f["id"], {})
    sev = ov.get("severity", f["_severity_norm"])
    deduped.append({
        "dedup_id": f["id"],
        "title": ov.get("title", f["title"]),
        "severity": sev,
        "ga_blocking": sev == "GA-blocking",
        "primary_lens": ov.get("primary_lens", f["_lens"]),
        "raw_finding_count": 1,
        "reviewer_count": 1,
        "lens_count": 1,
        "regression_of": ov.get("regression_of"),
        "overlaps_open_issue": ov.get("overlaps_open_issue"),
        "severity_disagreement": False,
        "pm_impact": f.get("pm_impact", ""),
        "technical": f.get("technical", ""),
        "files": f.get("files", []),
        "acceptance_criteria": f.get("acceptance_criteria", []),
        "remediation_hint": f.get("remediation_hint", ""),
        "orchestrator_notes": ov.get("orchestrator_notes", ""),
        "sources": [src_row(f)],
    })

deduped.sort(key=lambda d: (SEV_ORDER[d["severity"]], -d["reviewer_count"], d["dedup_id"]))

result = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "commit": COMMIT,
    "raw_total": len(AGG["findings"]),
    "raw_collapsed_into_dedup": len(merged_ids),
    "withdrawn": sorted(WITHDRAWN),
    "dedup_total": len(deduped),
    "findings": deduped,
}
OUT.write_text(json.dumps(result, indent=2))

hist: dict[str, int] = {}
for d in deduped:
    hist[d["severity"]] = hist.get(d["severity"], 0) + 1
print(f"Raw findings:         {len(AGG['findings'])}")
print(f"Withdrawn:            {len(WITHDRAWN)}")
print(f"Collapsed into merges:{len(merged_ids)}")
print(f"Deduped total:        {len(deduped)}")
for s in ["GA-blocking", "High", "Medium", "Low"]:
    print(f"  {s:<13} {hist.get(s, 0)}")
print(f"Wrote {OUT}")
