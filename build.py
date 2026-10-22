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


def film_attrs(p):
    a = f' data-title="{esc(p["title"])}" data-stills="{",".join(p["stills"])}" data-tint="{p.get("tint", "#11110f")}"'
    v = p.get("video")
    if v:
        a += f' data-provider="{v["provider"]}" data-id="{v["id"]}"'
        if v.get("hash"):
            a += f' data-hash="{v["hash"]}"'
    return a


def credit(p):
    return " · ".join(x for x in [p.get("credit"), p.get("detail")] if x)


def title_html(p):
    sub = f' <em>‘{esc(p["subtitle"])}’</em>' if p.get("subtitle") else ""
    return f"{esc(p['title'])}{sub}"


def reel_list(items, start=0):
    """Clean rows: number, title, credits, type, and a line of small shots that drive the channel."""
    rows = []
    for i, p in enumerate(items):
        n = start + i + 1
        sub = f' <em>‘{esc(p["subtitle"])}’</em>' if p.get("subtitle") else ""
        shots = "".join(
            f'<button class="shot" data-i="{k}" tabindex="-1" aria-label="Frame {k + 1}"><img src="/media/thumbs/{st}.jpg" alt="" loading="lazy" decoding="async" /></button>'
            for k, st in enumerate(p["stills"][:6])
        )
        action = "Play" if p.get("video") else "View frames from"
        rows.append(f'''          <li class="row"{film_attrs(p)} data-n="{n:02d}" data-credit="{esc(credit(p))}" data-kind="{esc(p['kind'])}">
            <button class="row-open" aria-label="{action} {esc(p['title'])}">
              <span class="row-n mono">{n:02d}</span>
              <span class="row-title">{esc(p['title'])}{sub}</span>
              <span class="row-credit mono">{esc(credit(p))}</span>
              <span class="row-kind mono">{esc(p['kind'])}</span>
            </button>
            <div class="shots">{shots}</div>
          </li>''')
    return "\n".join(rows)


def timeline(items, start=0):
    """Each film as a clip on its track, made of its own frames; width follows how many frames it has."""
    clips = []
    for i, p in enumerate(items):
        frames = "".join(f'<img src="/media/thumbs/{st}.jpg" alt="" loading="lazy" decoding="async" />' for st in p["stills"])
        clips.append(
            f'          <button class="clip" data-n="{start + i + 1:02d}" style="flex-grow:{len(p["stills"])}" aria-label="{esc(p["title"])}">'
            f'<span class="clip-name mono">{esc(p["title"])}</span><span class="clip-frames">{frames}</span></button>'
        )
    return "\n".join(clips)


narr_more = "\n".join(
    f'          <li><span>{esc(t)}</span><span>{esc(c)}</span><span>{esc(k)}</span></li>'
    for t, k, c in content["narrative_more"]
)
narr_extra = f"""        <div class="also-col">
          <p class="mono">Also shot — narrative</p>
          <ul class="also-list mono">
{narr_more}
          </ul>
        </div>"""
comm_extra = f"""        <div class="also-col">
          <p class="mono">Also shot — commercial</p>
          <p class="also-line">{" · ".join(esc(x) for x in content["commercial_more"])}</p>
        </div>"""

out = (ROOT / "template.html").read_text()
out = out.replace("{{NARRATIVE}}", reel_list(content["narrative"]))
out = out.replace("{{COMMERCIAL}}", reel_list(content["commercial"], len(content["narrative"])))
out = out.replace("{{NARRATIVE_COUNT}}", f'{len(content["narrative"]):02d}')
out = out.replace("{{COMMERCIAL_COUNT}}", f'{len(content["commercial"]):02d}')
out = out.replace("{{ALSO}}", '      <div class="panel-head mono"><span>Also shot</span></div>\n      <div class="also-cols">\n' + narr_extra + "\n" + comm_extra + "\n      </div>")
out = out.replace("{{TL_NARRATIVE}}", timeline(content["narrative"]))
out = out.replace("{{TL_COMMERCIAL}}", timeline(content["commercial"], len(content["narrative"])))
out = out.replace("{{FILM_COUNT}}", f'{len(content["narrative"]) + len(content["commercial"]):02d}')
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
