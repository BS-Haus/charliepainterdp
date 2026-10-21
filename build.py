#!/usr/bin/env python3
"""Render public/index.html from template.html + content.json.

Edit content.json (add a film, reorder, change credits), then run:  python3 build.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).parent
content = json.loads((ROOT / "content.json").read_text())
esc = html.escape


def row(i, p):
    video = p.get("video")
    attrs = f' data-title="{esc(p["title"])}"'
    if video:
        attrs += f' data-provider="{video["provider"]}" data-id="{video["id"]}"'
        if video.get("hash"):
            attrs += f' data-hash="{video["hash"]}"'
    attrs += f' data-stills="{",".join(p["stills"])}"'
    sub = f' <em>‘{esc(p["subtitle"])}’</em>' if p.get("subtitle") else ""
    credit = " · ".join(x for x in [p.get("credit"), p.get("detail")] if x)
    frames = "".join(
        f'<button class="frame" data-i="{k}" tabindex="-1" aria-hidden="true">'
        f'<img src="/media/thumbs/{s}.jpg" alt="" loading="lazy" decoding="async" /></button>'
        for k, s in enumerate(p["stills"])
    )
    action = "Play film" if video else "View frames"
    return f"""        <li class="job"{attrs}>
          <button class="job-open" aria-label="{action}: {esc(p['title'])}">
            <span class="job-n mono">{i:02d}</span>
            <span class="job-name"><b>{esc(p['title'])}</b>{sub}<small class="mono">{esc(credit)}</small></span>
          </button>
          <div class="strip">{frames}</div>
          <div class="job-meta mono"><span>{esc(p['kind'])}</span><span class="job-act">{action} ↗</span></div>
        </li>"""


def section(items):
    return "\n".join(row(i + 1, p) for i, p in enumerate(items))


narr_more = "\n".join(
    f'          <li><span>{esc(t)}</span><span>{esc(k)}</span><span>{esc(c)}</span></li>'
    for t, k, c in content["narrative_more"]
)
comm_more = " · ".join(esc(x) for x in content["commercial_more"])

out = (ROOT / "template.html").read_text()
out = out.replace("{{NARRATIVE}}", section(content["narrative"]))
out = out.replace("{{NARRATIVE_COUNT}}", f'{len(content["narrative"]) + len(content["narrative_more"]):02d}')
out = out.replace("{{NARRATIVE_MORE}}", narr_more)
out = out.replace("{{COMMERCIAL}}", section(content["commercial"]))
out = out.replace("{{COMMERCIAL_COUNT}}", f'{len(content["commercial"]) + len(content["commercial_more"]):02d}')
out = out.replace("{{COMMERCIAL_MORE}}", comm_more)
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
