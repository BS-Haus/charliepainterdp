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


def reel_list(items):
    """An accordion of films: slim title bars; the open one becomes a big screen that flicks through its frames."""
    rows = []
    for i, p in enumerate(items):
        sub = f' <em>‘{esc(p["subtitle"])}’</em>' if p.get("subtitle") else ""
        band = "".join(f'<img src="/media/thumbs/{st}.jpg" alt="" loading="lazy" decoding="async" />' for st in p["stills"])
        stage = "".join(
            f'<img src="/media/stills/{st}.jpg" alt="Frame {k + 1} from {esc(p["title"])}" loading="lazy" decoding="async" />'
            for k, st in enumerate(p["stills"])
        )
        ticks = "".join("<i></i>" for _ in p["stills"])
        play = '<button class="rl-play">Play film ↗</button>' if p.get("video") else ""
        rows.append(f'''        <li class="rl"{film_attrs(p)}>
          <button class="rl-head" aria-expanded="false">
            <span class="rl-band" aria-hidden="true">{band}</span>
            <span class="rl-n mono">{i + 1:02d}</span>
            <span class="rl-title">{esc(p['title'])}{sub}</span>
            <span class="rl-credit mono">{esc(credit(p))}</span>
            <span class="rl-kind mono">{esc(p['kind'])}</span>
          </button>
          <div class="rl-body"><div class="rl-inner">
            <div class="rl-stage" role="button" tabindex="-1" aria-label="View frames from {esc(p['title'])}">{stage}</div>
            <div class="rl-info mono">
              <p class="rl-count"><span class="rl-i">01</span> / {len(p["stills"]):02d}</p>
              <p class="rl-ticks">{ticks}</p>
              <p class="rl-credit-full">{esc(credit(p))}</p>
              <div class="rl-acts">{play}<button class="rl-frames">All frames</button></div>
            </div>
          </div></div>
        </li>''')
    return "\n".join(rows)


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
out = out.replace("{{COMMERCIAL}}", reel_list(content["commercial"]))
out = out.replace("{{NARRATIVE_COUNT}}", f'{len(content["narrative"]):02d}')
out = out.replace("{{COMMERCIAL_COUNT}}", f'{len(content["commercial"]):02d}')
out = out.replace("{{ALSO}}", narr_extra + "\n" + comm_extra)
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
