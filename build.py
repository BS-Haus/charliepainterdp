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

# Each half of the work opens with its showreel; a reel's "stills" are frames pulled from it
REELS = {
    "narrative": {"slug": "narrativeshowreel", "title": "Narrative showreel", "kind": "Showreel", "note": "Features & shorts",
                  "src": "/media/reel-narrative-v3.mp4", "poster": "/media/reel-narrative-v2-poster.jpg",
                  "video": {"provider": "vimeo", "id": "1149629056"}, "stills": [f"reel-narrative-{i}" for i in range(1, 9)]},
    "commercial": {"slug": "commercial-showreel", "title": "Commercial showreel", "kind": "Showreel", "note": "Commercials & brand films",
                   "src": "/media/reel-commercial-v2.mp4", "poster": "/media/reel-commercial-v2-poster.jpg",
                   "video": {"provider": "vimeo", "id": "1188991301"}, "stills": [f"reel-commercial-{i}" for i in range(1, 9)]},
}
LABELS = {"narrative": "Narrative", "commercial": "Commercial"}


def title_of(f):
    return f["title"] + (f" ‘{f['subtitle']}’" if f.get("subtitle") else "")


def credit_line(f):
    return " / ".join(x for x in (f.get("director"), f.get("production")) if x)


def projects():
    """Every project in page order (narrative first) — the data the project view is built from."""
    out = []
    for group in ("narrative", "commercial"):
        r = REELS[group]
        out.append({"slug": r["slug"], "group": group, "title": r["title"], "kind": r["kind"], "note": r["note"],
                    "director": "", "production": "", "video": r["video"], "stills": r["stills"]})
        for f in content[group]:
            out.append({"slug": f["slug"], "group": group, "title": title_of(f), "kind": f["kind"], "note": f.get("note", ""),
                        "director": f.get("director", ""), "production": f.get("production", ""),
                        "video": f.get("video"), "stills": f["stills"]})
    return out


def reel_tile(group):
    r = REELS[group]
    return f'''        <article class="tile tile-reel" data-slug="{r["slug"]}">
          <video muted playsinline loop preload="none" poster="{r["poster"]}" data-src="{r["src"]}"></video>
          <div class="tile-cap"><p class="tile-kind mono"><span class="rec" aria-hidden="true"></span>Showreel</p><h3 class="tile-title"><a href="#/{r["slug"]}">{esc(r["title"])}</a></h3><p class="tile-credit mono">{esc(r["note"])}</p></div>
          <span class="tile-watch mono" aria-hidden="true">Watch with sound ↗</span>
        </article>'''


def film_tile(f, eager):
    n = len(f["stills"])
    imgs = "".join(
        f'<img src="/media/stills/{s}.jpg" alt="" loading="{"eager" if eager and i == 0 else "lazy"}" decoding="async" draggable="false" />'
        for i, s in enumerate(f["stills"])
    )
    # a small counter in the corner; the arrows either side of it only show on hover
    count = (f'<div class="tile-count mono"><button class="tile-step tile-prev" aria-label="Previous still">←</button>'
             f'<span><b class="tile-n">01</b> / {n:02d}</span>'
             f'<button class="tile-step tile-next" aria-label="Next still">→</button></div>') if n > 1 else ""
    return f'''        <article class="tile" data-slug="{f["slug"]}">
          <div class="slides">{imgs}</div>
          <div class="tile-cap"><h3 class="tile-title"><a href="#/{f["slug"]}">{esc(title_of(f))}</a></h3><p class="tile-credit mono">{esc(credit_line(f) or f["kind"])}</p></div>
          {count}
        </article>'''


def group_section(group, first):
    films = content[group]
    tiles = "\n".join(film_tile(f, first and i < 2) for i, f in enumerate(films))
    count = f'{len(films)} {"films" if group == "narrative" else "projects"}'
    return f'''      <section class="group" data-group="{group}" aria-label="{LABELS[group]}">
        <header class="group-head mono"><h2>{LABELS[group]}</h2><span>{count} + showreel</span></header>
{reel_tile(group)}
        <div class="grid">
{tiles}
        </div>
      </section>'''


def cv_rows(rows):
    return "\n".join(
        f'          <li><span class="cv-t">{esc(t)}</span><span class="cv-c">{esc(" / ".join(x for x in (d, p) if x))}</span></li>'
        for t, d, p in rows
    )


def cv():
    blocks = []
    for key, label in (("feature", "Feature film"), ("short", "Short film"), ("commercial", "Commercial")):
        blocks.append(f'''      <div class="cv-block">
        <h3 class="mono">{label}</h3>
        <ul class="cv-list">
{cv_rows(content["cv"][key])}
        </ul>
      </div>''')
    return "\n".join(blocks)


def awards():
    return "\n".join(
        f'          <li><span class="mono">{esc(r)}</span><span class="cv-t">{esc(a)}</span><span class="cv-c">{esc(f)}</span></li>'
        for r, a, f in content["awards"]
    )


out = (ROOT / "template.html").read_text()
out = out.replace("{{GROUPS}}", group_section("narrative", True) + "\n" + group_section("commercial", False))
out = out.replace("{{CV}}", cv())
out = out.replace("{{AWARDS}}", awards())
out = out.replace("{{ABOUT}}", esc(content["about"]))
out = out.replace("{{PROJECTS}}", json.dumps(projects(), ensure_ascii=False).replace("</", "<\\/"))
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
