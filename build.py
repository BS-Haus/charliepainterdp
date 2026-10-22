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

# The two showreels open their halves of the roll
REELS = {
    "narrative": {"title": "Narrative showreel", "credit": "Features & shorts", "src": "/media/reel-narrative-v2.mp4", "poster": "/media/reel-narrative-v2-poster.jpg", "vimeo": "1149629056"},
    "commercial": {"title": "Commercial showreel", "credit": "Commercials & brand films", "src": "/media/reel-commercial-v2.mp4", "poster": "/media/reel-commercial-v2-poster.jpg", "vimeo": "1188991301"},
}


def credit(p):
    return " · ".join(x for x in [p.get("credit"), p.get("detail")] if x)


def roll():
    """One step per item on the roll: a reel, then its films. The stage reads these as you scroll."""
    steps, bars, index, n = [], [], [], 0
    for group in ("narrative", "commercial"):
        r = REELS[group]
        index.append(f'          <p class="idx-group mono">{group.title()}</p>')
        steps.append(
            f'      <div class="step" data-type="reel" data-group="{group}" data-title="{esc(r["title"])}" data-credit="{esc(r["credit"])}" '
            f'data-src="{r["src"]}" data-poster="{r["poster"]}" data-provider="vimeo" data-id="{r["vimeo"]}" data-kind="Showreel"></div>'
        )
        bars.append(f'        <button class="bar-item is-reel" data-step="{len(steps) - 1}"><span class="mono">{group.title()} reel</span></button>')
        index.append(f'          <button class="idx-item" data-step="{len(steps) - 1}"><span class="mono">{"R1" if group == "narrative" else "R2"}</span><b>Showreel</b></button>')
        for p in content[group]:
            n += 1
            v = p.get("video")
            vattrs = f' data-provider="{v["provider"]}" data-id="{v["id"]}"' + (f' data-hash="{v["hash"]}"' if v.get("hash") else "") if v else ""
            title = p["title"] + (f" — ‘{p['subtitle']}’" if p.get("subtitle") else "")
            steps.append(
                f'      <div class="step" data-type="film" data-group="{group}" data-n="{n:02d}" data-title="{esc(title)}" '
                f'data-credit="{esc(credit(p))}" data-kind="{esc(p["kind"])}" data-stills="{",".join(p["stills"])}"{vattrs}></div>'
            )
            bars.append(f'        <button class="bar-item" data-step="{len(steps) - 1}"><span class="mono">{n:02d} {esc(p["title"])}</span></button>')
            index.append(f'          <button class="idx-item" data-step="{len(steps) - 1}"><span class="mono">{n:02d}</span><b>{esc(p["title"])}</b><i class="mono">{esc(p["kind"])}</i></button>')
    return "\n".join(steps), "\n".join(bars), "\n".join(index), n


narr_more = "\n".join(
    f'          <li><span>{esc(t)}</span><span>{esc(c)}</span><span>{esc(k)}</span></li>'
    for t, k, c in content["narrative_more"]
)
narr_extra = f"""        <div class="also-col">
          <p class="mono">Narrative — also shot</p>
          <ul class="also-list mono">
{narr_more}
          </ul>
        </div>"""
comm_extra = f"""        <div class="also-col">
          <p class="mono">Commercial — also shot</p>
          <p class="also-line">{" · ".join(esc(x) for x in content["commercial_more"])}</p>
        </div>"""

steps, bars, index, films = roll()
out = (ROOT / "template.html").read_text()
out = out.replace("{{STEPS}}", steps)
out = out.replace("{{BARS}}", bars)
out = out.replace("{{INDEX}}", index)
out = out.replace("{{FILM_COUNT}}", f"{films:02d}")
out = out.replace("{{ALSO}}", '      <div class="also-cols">\n' + narr_extra + "\n" + comm_extra + "\n      </div>")
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
