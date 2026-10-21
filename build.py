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


def wall(sections):
    """Every film on one screen: each is a small contact-sheet block of up to four frames."""
    out, n = [], 0
    for label, items in sections:
        out.append(f'          <div class="w-cell w-chapter"><span class="mono">{len(items):02d} films</span><b>{label}</b></div>')
        for p in items:
            n += 1
            frames = p["stills"][:4]
            count = len(frames)
            imgs = "".join(f'<img src="/media/thumbs/{st}.jpg" alt="" loading="lazy" decoding="async" />' for st in frames)
            sub = f' — ‘{esc(p["subtitle"])}’' if p.get("subtitle") else ""
            out.append(f'''          <button class="w-cell w-film"{film_attrs(p)} data-n="{n:02d}" data-credit="{esc(credit(p))}" data-kind="{esc(p['kind'])}" aria-label="{"Play" if p.get("video") else "View frames from"} {esc(p['title'])}">
            <span class="w-sheet w-sheet-{count}">{imgs}</span>
            <span class="w-cap mono"><span>{n:02d}</span><b>{esc(p['title'])}{esc(sub)}</b><span>{esc(p['kind'])}</span></span>
          </button>''')
    out.append('''          <a class="w-cell w-studio" href="https://painterstudio.vercel.app" target="_blank" rel="noopener"><span class="mono">For brands</span><b>Painter.Studio ↗</b><span class="mono">Charlie’s content studio</span></a>''')
    return "\n".join(out)


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

total = len(content["narrative"]) + len(content["commercial"])
out = (ROOT / "template.html").read_text()
out = out.replace("{{WALL}}", wall([("Narrative", content["narrative"]), ("Commercial", content["commercial"])]))
out = out.replace("{{FILM_COUNT}}", f"{total:02d}")
out = out.replace("{{ALSO}}", narr_extra + "\n" + comm_extra)
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
