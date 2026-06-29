#!/usr/bin/env python3
"""Aggregate reviewer JSON files into one structure for orchestrator dedup.

Raw files use `persona` + `primary_lens` (older formats may use `dimension`).
Both are handled. The heuristic fingerprint only groups obvious duplicates; the
orchestrator does the authoritative dedup by hand over aggregated.json.

Usage: python3 pipeline/aggregate.py [--raw-dir <path>] [--out <path>]
Defaults: raw/ in the same directory as this script, aggregated.json alongside it.
"""
import argparse
import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("--raw-dir", type=Path, default=SCRIPT_DIR / "raw")
parser.add_argument("--out", type=Path, default=SCRIPT_DIR / "aggregated.json")
args = parser.parse_args()

RAW_DIR = args.raw_dir
OUT = args.out

SEV_RANK = {"GA-blocking": 0, "High": 1, "Medium": 2, "Low": 3}


def normalize_severity(f):
    sev = f.get("severity", "Low")
    if isinstance(sev, list):
        sev = sev[0]
    return sev


def fingerprint(f):
    title = (f.get("title") or "").lower()
    words = re.sub(r"[^a-z0-9 ]", " ", title).split()
    stop = {"missing", "without", "header", "headers", "should", "with", "from",
            "into", "this", "that", "which", "could", "would", "page", "pages",
            "when", "have", "does", "lacks", "lack"}
    keep = [w for w in words if len(w) > 3 and w not in stop]
    return " ".join(sorted(set(keep))[:6])


all_findings = []
by_reviewer = {}
for p in sorted(RAW_DIR.glob("*.json")):
    data = json.loads(p.read_text())
    rid = data.get("reviewer_id", p.stem)
    lens = data.get("primary_lens") or data.get("dimension", "?")
    by_reviewer[rid] = {
        "persona": data.get("persona", data.get("dimension", rid)),
        "primary_lens": lens,
        "finding_count": len(data.get("findings", [])),
        "self_assessment": data.get("self_assessment", {}),
    }
    for f in data.get("findings", []):
        f["_reviewer_id"] = rid
        f["_lens"] = lens
        f["_severity_norm"] = normalize_severity(f)
        f["_ga_blocking"] = bool(f.get("ga_blocking"))
        f["_fp"] = fingerprint(f)
        all_findings.append(f)

all_findings.sort(key=lambda f: (
    0 if f["_ga_blocking"] else 1,
    SEV_RANK.get(f["_severity_norm"], 9),
    f["_lens"],
    f["_fp"],
))

OUT.write_text(json.dumps({
    "reviewers": by_reviewer,
    "findings_total": len(all_findings),
    "findings": all_findings,
}, indent=2))

print(f"=== AGGREGATED {len(all_findings)} findings from {len(by_reviewer)} reviewers ===\n")
print(f"{'Reviewer':<32} {'Lens':<18} {'Count':>5}")
for rid, info in sorted(by_reviewer.items()):
    print(f"{rid:<32} {info['primary_lens']:<18} {info['finding_count']:>5}")
print()

hist: dict[str, int] = {}
ga_count = 0
for f in all_findings:
    s = f["_severity_norm"]
    hist[s] = hist.get(s, 0) + 1
    if f["_ga_blocking"]:
        ga_count += 1
print("Severity histogram (pre-dedup):")
for s in ["GA-blocking", "High", "Medium", "Low"]:
    print(f"  {s:<13} {hist.get(s, 0):>4}")
print(f"  (ga_blocking flag): {ga_count}\n")

print("=== Fingerprint groups (>=2 findings = likely dupe) ===")
groups: dict[str, list] = {}
for f in all_findings:
    groups.setdefault(f["_fp"], []).append(f)
for fp, items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    if len(items) < 2:
        continue
    reviewers = [i["_reviewer_id"] for i in items]
    sevs = [i["_severity_norm"] + ("/GA" if i["_ga_blocking"] else "") for i in items]
    print(f"  [{len(items)}x] fp='{fp[:60]}'")
    print(f"      reviewers: {', '.join(reviewers)}")
    print(f"      sevs: {', '.join(sevs)}")
    print(f"      sample title: {items[0]['title'][:100]}")
print(f"\nWrote: {OUT}")
