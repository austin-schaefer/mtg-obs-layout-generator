#!/usr/bin/env python3
"""Build the maintainer triage HTML from deduped.json.

Reads deduped.json, writes a self-contained HTML triage UI that lets the maintainer
mark findings as dropped and add notes, then copy a JSON blob to paste back to the
orchestrating agent. Notes auto-save to localStorage.

Usage: python3 pipeline/build_triage_html.py [--deduped <path>] [--out <path>]
Defaults: deduped.json alongside this script, output to ../triage.html (repo root tmp/ or cwd).
"""
import argparse
import html
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
parser = argparse.ArgumentParser()
parser.add_argument("--deduped", type=Path, default=SCRIPT_DIR / "deduped.json")
parser.add_argument("--out", type=Path, default=SCRIPT_DIR.parent.parent.parent / "tmp" / "triage.html")
args = parser.parse_args()

DEDUPED = json.loads(args.deduped.read_text())
OUT = args.out
OUT.write_text("")  # truncate

SEV_ORDER = {"GA-blocking": 0, "High": 1, "Medium": 2, "Low": 3}
SEV_CLASS = {
    "GA-blocking": "sev-ga",
    "High": "sev-high",
    "Medium": "sev-med",
    "Low": "sev-low",
}

findings = sorted(DEDUPED["findings"], key=lambda d: (SEV_ORDER[d["severity"]], -d["reviewer_count"], d["dedup_id"]))

hist: dict[str, int] = {}
for d in findings:
    hist[d["severity"]] = hist.get(d["severity"], 0) + 1


def esc(s):
    return html.escape(str(s) if s is not None else "")


header = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>obs-layouts — Audit Triage</title>
<style>
  :root {{
    --bg: #f7f5f0; --panel: #fff; --ink: #1b1b1b; --muted: #6b6b6b; --rule: #d8d2c2; --accent: #5a4632;
    --ga: #7a1b1b; --ga-bg: #fbe9e7; --high: #a44a00; --high-bg: #fdebd0;
    --med: #6b5800; --med-bg: #fff5cf; --low: #4a6b3a; --low-bg: #e9f0e3;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
  header.page {{ padding: 24px 32px 16px; border-bottom: 1px solid var(--rule); background: var(--panel); }}
  header.page h1 {{ margin: 0 0 4px; font-size: 22px; font-weight: 700; }}
  header.page .meta {{ color: var(--muted); font-size: 13px; }}
  .summary {{ display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 0; }}
  .pill {{ background: #efeadd; border: 1px solid var(--rule); padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; }}
  .pill.sev-ga {{ background: var(--ga-bg); color: var(--ga); border-color: #f3c7c1; }}
  .pill.sev-high {{ background: var(--high-bg); color: var(--high); border-color: #ecd6a9; }}
  .pill.sev-med {{ background: var(--med-bg); color: var(--med); border-color: #ead8a4; }}
  .pill.sev-low {{ background: var(--low-bg); color: var(--low); border-color: #c8d8b9; }}
  .instructions {{ background: #fffce8; border: 1px solid #ead8a4; padding: 14px 18px; margin: 16px 32px; border-radius: 8px; font-size: 14px; }}
  .instructions h3 {{ margin: 0 0 6px; font-size: 14px; font-weight: 700; }}
  .instructions ol {{ margin: 4px 0 0; padding-left: 22px; }}
  .instructions code {{ background: #f1efe1; padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }}
  main {{ padding: 12px 32px 80px; }}
  .severity-section {{ margin-top: 28px; }}
  .severity-section > h2 {{ margin: 0 0 12px; font-size: 17px; font-weight: 700; border-bottom: 1px solid var(--rule); padding-bottom: 6px; }}
  .finding {{ background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; margin-bottom: 12px; padding: 16px 20px; }}
  .finding.dropped {{ opacity: 0.55; background: #efeadd; }}
  .finding .chips {{ display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }}
  .chip {{ display: inline-flex; align-items: center; padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 4px; border: 1px solid var(--rule); background: #efeadd; color: var(--ink); }}
  .chip.sev-ga {{ background: var(--ga-bg); color: var(--ga); border-color: #f3c7c1; }}
  .chip.sev-high {{ background: var(--high-bg); color: var(--high); border-color: #ecd6a9; }}
  .chip.sev-med {{ background: var(--med-bg); color: var(--med); border-color: #ead8a4; }}
  .chip.sev-low {{ background: var(--low-bg); color: var(--low); border-color: #c8d8b9; }}
  .chip.id {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); background: transparent; border-color: transparent; padding-left: 0; }}
  .chip.regression {{ background: #fbe9e7; color: var(--ga); border-color: #f3c7c1; }}
  .chip.overlap {{ background: #e7f3fb; color: #1a4a73; border-color: #b5d5ec; }}
  .finding h3 {{ margin: 4px 0 12px; font-size: 16px; font-weight: 700; line-height: 1.35; }}
  .pm-impact {{ font-size: 15px; line-height: 1.6; background: #fcfaf3; border-left: 4px solid var(--accent); padding: 10px 14px; margin: 0 0 10px; }}
  details {{ margin: 8px 0 0; border-top: 1px dotted var(--rule); padding-top: 8px; }}
  details summary {{ cursor: pointer; font-size: 13px; color: var(--muted); font-weight: 600; }}
  details[open] summary {{ margin-bottom: 6px; }}
  details .body {{ padding: 6px 0 0; font-size: 13.5px; }}
  details pre {{ background: #f8f6ee; border: 1px solid var(--rule); padding: 10px 12px; border-radius: 4px; font-size: 12.5px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }}
  .file-list, .ac-list {{ margin: 4px 0 0; padding-left: 22px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }}
  .ac-list {{ font-family: inherit; font-size: 13.5px; }}
  .orch-notes {{ background: #f5efde; border: 1px solid #e1d6b6; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin: 10px 0 0; }}
  .orch-notes strong {{ color: var(--accent); }}
  .source {{ font-size: 12.5px; padding: 4px 0; border-bottom: 1px dotted var(--rule); }}
  .source:last-child {{ border-bottom: none; }}
  .source .src-meta {{ color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
  .controls {{ margin-top: 12px; display: flex; gap: 12px; align-items: flex-start; }}
  .controls label.drop {{ font-size: 13px; cursor: pointer; user-select: none; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--rule); background: #fbf9f1; }}
  .controls label.drop:has(input:checked) {{ background: #fbe9e7; color: var(--ga); border-color: #f3c7c1; }}
  .controls textarea {{ flex: 1; min-height: 50px; padding: 8px 10px; font: inherit; font-size: 13px; border: 1px solid var(--rule); border-radius: 4px; background: #fefdf7; resize: vertical; }}
  .controls textarea:focus {{ outline: 2px solid #c8b58a; outline-offset: 0; }}
  footer.sticky {{ position: fixed; bottom: 0; left: 0; right: 0; background: var(--panel); border-top: 1px solid var(--rule); padding: 12px 32px; display: flex; gap: 12px; align-items: center; box-shadow: 0 -2px 8px rgba(0,0,0,0.04); z-index: 10; }}
  footer.sticky button {{ background: var(--accent); color: #fff; border: 0; padding: 9px 16px; font: inherit; font-weight: 600; border-radius: 4px; cursor: pointer; }}
  footer.sticky button:hover {{ background: #6f5942; }}
  footer.sticky .status {{ color: var(--muted); font-size: 13px; }}
  .pre-output {{ background: #f8f6ee; border: 1px solid var(--rule); border-radius: 4px; padding: 10px 12px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 200px; overflow-y: auto; flex: 1; margin: 0; white-space: pre; }}
</style>
</head>
<body>
<header class="page">
  <h1>obs-layouts — Audit Triage</h1>
  <div class="meta">Generated {esc(DEDUPED["generated_at"])} · commit <code>{esc(DEDUPED["commit"])}</code></div>
  <div class="summary">
    <span class="pill"><strong>{DEDUPED["raw_total"]}</strong> raw → <strong>{DEDUPED["dedup_total"]}</strong> deduped</span>
    <span class="pill sev-ga">{hist.get("GA-blocking",0)} GA-blocking</span>
    <span class="pill sev-high">{hist.get("High",0)} High</span>
    <span class="pill sev-med">{hist.get("Medium",0)} Medium</span>
    <span class="pill sev-low">{hist.get("Low",0)} Low</span>
  </div>
</header>

<div class="instructions">
  <h3>Maintainer triage instructions</h3>
  <ol>
    <li>For each finding, read the <strong>PM impact</strong> first — that's the visitor-/launch-facing consequence. Expand <em>Technical detail</em> only when severity ambiguity matters.</li>
    <li>If you want to skip a finding (duplicate of something already filed, out of scope, not real), tick <strong>Drop</strong>.</li>
    <li>Use the per-finding <strong>note</strong> box for severity adjustments, scope tweaks, or filing instructions (e.g. <code>file as separate issue</code> vs <code>comment on #N</code>). An <span class="chip overlap" style="font-size:11px;">overlaps #N</span> chip means the orchestrator already suspects overlap with an open issue — confirm or override.</li>
    <li>When done, click <strong>Copy notes</strong> at the bottom — it builds a JSON blob keyed by <code>dedup_id</code>. Paste it back in chat and the orchestrator will process: file new issues, post comments on existing issues, drop the rest, and post the severity-sorted summary table on the audit tracking issue.</li>
  </ol>
  <p style="margin-top:8px;color:var(--muted);font-size:12.5px;">Your notes auto-save to localStorage as you type (key: <code>obs-layouts-audit</code>). Closing this tab won't lose your work.</p>
</div>

<main>
"""
with OUT.open("a") as f:
    f.write(header)


def render_finding(d):
    chips = [
        f'<span class="chip {SEV_CLASS[d["severity"]]}">{esc(d["severity"])}</span>',
        f'<span class="chip">{esc(d["primary_lens"])}</span>',
        f'<span class="chip" title="reviewers that surfaced this finding">{d["reviewer_count"]} reviewer{"s" if d["reviewer_count"]>1 else ""}</span>',
    ]
    if d.get("lens_count", 1) > 1:
        chips.append(f'<span class="chip" title="cross-lens convergence">cross-lens ({d["lens_count"]} lenses)</span>')
    if d.get("regression_of"):
        chips.append(f'<span class="chip regression" title="regresses a prior-round fix">regression: {esc(d["regression_of"])}</span>')
    if d.get("overlaps_open_issue"):
        chips.append(f'<span class="chip overlap" title="overlaps an existing open issue">overlaps {esc(d["overlaps_open_issue"])}</span>')
    if d.get("severity_disagreement"):
        chips.append(f'<span class="chip" title="reviewers disagreed on severity">severity disagreement</span>')
    chips.append(f'<span class="chip id">{esc(d["dedup_id"])}</span>')

    file_items = "".join(f"<li>{esc(p)}</li>" for p in d.get("files", []))
    ac_items = "".join(f"<li>{esc(ac)}</li>" for ac in d.get("acceptance_criteria", []))

    source_rows = []
    for s in d["sources"]:
        ga = " <strong style='color:var(--ga)'>[GA]</strong>" if s.get("ga_blocking") else ""
        source_rows.append(
            f'<div class="source"><span class="src-meta">{esc(s["reviewer_id"])} · {esc(s["finding_id"])} · {esc(s["severity"])}{ga}</span><br>{esc(s["title"])}</div>'
        )
    sources_html = "".join(source_rows)

    return f"""
  <article class="finding" data-id="{esc(d["dedup_id"])}" data-severity="{esc(d["severity"])}">
    <div class="chips">{"".join(chips)}</div>
    <h3>{esc(d["title"])}</h3>
    <div class="pm-impact"><strong>PM impact:</strong> {esc(d["pm_impact"])}</div>
    {f'<div class="orch-notes"><strong>Orchestrator notes:</strong> {esc(d["orchestrator_notes"])}</div>' if d.get("orchestrator_notes") else ""}

    <details>
      <summary>Technical detail</summary>
      <div class="body"><pre>{esc(d["technical"])}</pre></div>
    </details>

    <details>
      <summary>Files ({len(d.get("files", []))}) · Acceptance criteria ({len(d.get("acceptance_criteria", []))}) · Remediation hint</summary>
      <div class="body">
        <p style="margin:2px 0 4px;font-weight:600;font-size:13px;">Files</p>
        <ul class="file-list">{file_items}</ul>
        <p style="margin:8px 0 4px;font-weight:600;font-size:13px;">Acceptance criteria</p>
        <ul class="ac-list">{ac_items}</ul>
        <p style="margin:8px 0 4px;font-weight:600;font-size:13px;">Remediation hint</p>
        <pre>{esc(d.get("remediation_hint", ""))}</pre>
      </div>
    </details>

    <details>
      <summary>Sources ({d["raw_finding_count"]} raw finding{"s" if d["raw_finding_count"]>1 else ""} from {d["reviewer_count"]} reviewer{"s" if d["reviewer_count"]>1 else ""})</summary>
      <div class="body">{sources_html}</div>
    </details>

    <div class="controls">
      <label class="drop"><input type="checkbox" data-role="drop"> Drop</label>
      <textarea data-role="note" placeholder="Notes / severity override / filing instruction…"></textarea>
    </div>
  </article>
"""


for severity in ["GA-blocking", "High", "Medium", "Low"]:
    items = [d for d in findings if d["severity"] == severity]
    if not items:
        continue
    with OUT.open("a") as f:
        f.write(f'\n  <section class="severity-section" data-sev="{severity}">\n    <h2>{severity} ({len(items)})</h2>\n')
    for d in items:
        with OUT.open("a") as f:
            f.write(render_finding(d))
    with OUT.open("a") as f:
        f.write("  </section>\n")

footer = r"""</main>

<footer class="sticky">
  <button id="copy-btn" type="button">Copy notes JSON</button>
  <button id="paste-btn" type="button" style="background:#6b6b6b;">Load from localStorage</button>
  <button id="clear-btn" type="button" style="background:transparent;color:var(--ga);border:1px solid var(--ga);">Clear all notes</button>
  <span class="status" id="status">0 drops · 0 notes</span>
  <pre class="pre-output" id="output" hidden></pre>
</footer>

<script>
(function() {
  const STORAGE_KEY = 'obs-layouts-audit';
  const findings = document.querySelectorAll('.finding');
  const status = document.getElementById('status');
  const output = document.getElementById('output');

  function gather() {
    const out = {};
    findings.forEach(el => {
      const id = el.dataset.id;
      const drop = el.querySelector('input[data-role=drop]').checked;
      const note = el.querySelector('textarea[data-role=note]').value.trim();
      if (drop || note) { out[id] = { drop, note }; }
    });
    return out;
  }
  function persist() {
    const data = gather();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const drops = Object.values(data).filter(v => v.drop).length;
    const notes = Object.values(data).filter(v => v.note).length;
    status.textContent = `${drops} drop${drops!==1?'s':''} · ${notes} note${notes!==1?'s':''}`;
    findings.forEach(el => {
      const id = el.dataset.id;
      el.classList.toggle('dropped', !!(data[id] && data[id].drop));
    });
  }
  function restore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { persist(); return; }
    try {
      const data = JSON.parse(raw);
      findings.forEach(el => {
        const id = el.dataset.id;
        const entry = data[id];
        if (!entry) return;
        if (entry.drop) el.querySelector('input[data-role=drop]').checked = true;
        if (entry.note) el.querySelector('textarea[data-role=note]').value = entry.note;
      });
    } catch (e) { console.warn('triage: bad localStorage', e); }
    persist();
  }

  findings.forEach(el => {
    el.querySelector('input[data-role=drop]').addEventListener('change', persist);
    el.querySelector('textarea[data-role=note]').addEventListener('input', persist);
  });

  document.getElementById('copy-btn').addEventListener('click', async () => {
    const data = gather();
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      output.hidden = false;
      output.textContent = `Copied ${Object.keys(data).length} entries to clipboard:\n\n` + text;
    } catch (e) {
      output.hidden = false;
      output.textContent = 'Clipboard blocked. Copy manually:\n\n' + text;
    }
  });
  document.getElementById('paste-btn').addEventListener('click', restore);
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (!confirm('Clear all drops + notes? This wipes localStorage too.')) return;
    findings.forEach(el => {
      el.querySelector('input[data-role=drop]').checked = false;
      el.querySelector('textarea[data-role=note]').value = '';
    });
    localStorage.removeItem(STORAGE_KEY);
    persist();
  });

  restore();
})();
</script>
</body>
</html>
"""
with OUT.open("a") as f:
    f.write(footer)

print(f"Wrote {OUT}")
print(f"  Size: {OUT.stat().st_size:,} bytes")
print(f"  Findings rendered: {len(findings)}")
for s in ["GA-blocking", "High", "Medium", "Low"]:
    print(f"  {s}: {hist.get(s, 0)}")
