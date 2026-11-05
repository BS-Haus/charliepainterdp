#!/usr/bin/env python3
"""Render public/index.html from template.html + content.json.

Edit content.json (add a film, reorder, change credits), then run:  python3 build.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
content = json.loads((ROOT / "content.json").read_text())
esc = html.escape

LABELS = {"narrative": "Narrative", "commercial": "Commercial"}
KINDS = {"Short": "Short film", "Feature": "Feature film"}
FILMS = {f["slug"]: f for g in ("narrative", "commercial") for f in content[g]}


def title_of(f):
    return f["title"] + (f" ‘{f['subtitle']}’" if f.get("subtitle") else "")


def credit_line(f):
    return " / ".join(x for x in (f.get("director"), f.get("production")) if x)


def jpeg_size(name):
    """A still's width and height, from its JPEG frame header — so the page can hold its space before it loads."""
    data = (ROOT / "public" / "media" / "stills" / f"{name}.jpg").read_bytes()
    i = 2
    while i + 9 < len(data):
        marker, size = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            return [int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")]
        i += 2 + size
    raise ValueError(f"no frame header in {name}.jpg")


def projects():
    """Every project in page order (narrative first) — the data the project view is built from."""
    return [{"slug": f["slug"], "group": group, "title": title_of(f), "name": f["title"], "kind": f["kind"], "note": f.get("note", ""),
             "accolade": f.get("accolade", ""), "director": f.get("director", ""), "production": f.get("production", ""),
             "video": f.get("video"), "stills": f["stills"], "dims": [jpeg_size(s) for s in f["stills"]]}
            for group in ("narrative", "commercial") for f in content[group]]


def film_tile(f, eager):
    """A frame per film: its one best still, its title, and beneath it what it won, or failing that who made it."""
    under = f.get("accolade") or credit_line(f) or f["kind"]
    return f'''        <article class="tile" data-slug="{f["slug"]}">
          <img src="/media/stills/{f["stills"][0]}.jpg" alt="" loading="{"eager" if eager else "lazy"}" decoding="async" draggable="false" />
          <div class="tile-cap"><h3 class="tile-title"><a href="#/{f["slug"]}">{esc(title_of(f))}</a></h3><p class="tile-credit credit">{esc(under)}</p></div>
        </article>'''


def group_section(group, first):
    films = content[group]
    tiles = "\n".join(film_tile(f, first and i < 2) for i, f in enumerate(films))
    return f'''      <section class="group" data-group="{group}" aria-label="{LABELS[group]}"{"" if first else " hidden"}>
        <div class="grid">
{tiles}
        </div>
      </section>'''


def screen():
    """The first screen's stills, three from each of the best films, one after another."""
    shots = []
    for show in content["showcase"]:
        for s in show["stills"]:
            first = not shots
            on = ' class="is-on"' if first else ""
            shots.append(f'<img src="/media/stills/{s}.jpg" alt="" data-slug="{show["slug"]}" loading="{"eager" if first else "lazy"}" '
                         f'decoding="async" draggable="false"{on} />')
    return "\n        ".join(shots)


def ticker():
    """Which film you're looking at: a segment for each that fills while its stills play, its name beneath."""
    current = ' aria-current="true"'
    return "".join(
        f'<li><button class="tick" data-slug="{show["slug"]}"{current if i == 0 else ""}>'
        f'<span class="seg"><i></i></span><span class="tick-name">{esc(FILMS[show["slug"]]["title"])}</span></button></li>'
        for i, show in enumerate(content["showcase"])
    )


def press():
    return "\n".join(
        f'''      <a class="press-item" href="{esc(a["url"])}" target="_blank" rel="noopener">
        <span class="press-title">{esc(a["title"])}</span>
        <span class="press-stand credit">{esc(a["standfirst"])}</span>
        <span class="press-read label">Read in {esc(a["outlet"])} ↗&#xFE0E;</span>
      </a>'''
        for a in content["press"]
    )


def plain(title):
    """A title without its aside or curly quotes, to match a CV line to a film on the site."""
    return re.sub(r"\s*\(.*?\)", "", title).replace("’", "'").strip().lower()


BY_TITLE = {plain(f["title"]): f["slug"] for f in FILMS.values()}


def table(label, head, rows, cls=""):
    """One of the CV's tables, titled above its frame. Cells are plain text, a missing one an en dash."""
    cells = lambda xs, role: "".join(f'<span role="{role}">{x}</span>' for x in xs)
    lines = [f'          <div class="cv-row cv-head" role="row">{cells(head, "columnheader")}</div>']
    for r in rows:
        lines.append(f'          <div class="cv-row" role="row"{r[1]}>{cells(r[0], "cell")}</div>')
    body = "\n".join(lines)
    return f'''      <div class="cv-group">
        <h3 class="cv-group-title" id="cv-{label.lower().replace(" ", "-")}">{label}</h3>
        <div class="cv-table{cls}" role="table" aria-labelledby="cv-{label.lower().replace(" ", "-")}">
{body}
        </div>
      </div>'''


def cv():
    """The credits, a table to each kind. A film with its own page here opens from its row, which ends in a View pill."""
    groups = []
    for key, label in (("feature", "Feature film"), ("short", "Short film"), ("commercial", "Commercial")):
        lines = [(t, d, p, BY_TITLE.get(plain(t))) for t, d, p in content["cv"][key]]
        opens = any(slug for *_, slug in lines)   # the View column only where something opens
        rows = []
        for t, d, p, slug in lines:
            name = f'<a href="#/{slug}">{esc(t)}</a>' if slug else esc(t)
            view = ['<span class="view" aria-hidden="true">View</span>' if slug else ""] if opens else []
            rows.append(([name, esc(d) or "–", esc(p) or "–", *view], f' data-slug="{slug}"' if slug else ""))
        groups.append(table(label, ["Film", "Director", "Production", *([""] if opens else [])], rows, " opens" if opens else ""))
    return "\n".join(groups)


def awards():
    """What the work has won: a dot for the result, lit for a win."""
    rows = [([esc(a), esc(f), f'<span class="result{" won" if r == "Winner" else ""}">{esc(r)}</span>'], "") for r, a, f in content["awards"]]
    return table("Awards", ["Award", "Festival", "Result"], rows, " awards")


def cv_count():
    n = sum(len(v) for v in content["cv"].values())
    return f"{n} credits · {len(content['awards'])} awards"


def name_mark(name="Charlie Painter"):
    """The wordmark, letter by letter."""
    words = ("".join(f"<i>{esc(c)}</i>" for c in word) for word in name.split(" "))
    return '<span class="hero-name-in" aria-hidden="true">' + " ".join(f'<span class="w">{w}</span>' for w in words) + "</span>"


first = FILMS[content["showcase"][0]["slug"]]
out = (ROOT / "template.html").read_text()
out = out.replace("{{NAME}}", name_mark())
out = out.replace("{{SCREEN}}", screen())
out = out.replace("{{TICKER}}", ticker())
out = out.replace("{{FIRST_SLUG}}", first["slug"]).replace("{{FIRST_TITLE}}", esc(first["title"]))
out = out.replace("{{FIRST_KIND}}", esc(KINDS.get(first["kind"], first["kind"])))
out = out.replace("{{GROUPS}}", group_section("narrative", True) + "\n" + group_section("commercial", False))
# the switch on the bar: narrative or commercial work
toggle = "".join(
    f'<button class="opt" role="radio" aria-checked="{"true" if g == "narrative" else "false"}" data-group="{g}">{LABELS[g]}</button>'
    for g in ("narrative", "commercial")
)
out = out.replace("{{TOGGLE}}", toggle)
out = out.replace("{{CV}}", cv())
out = out.replace("{{AWARDS}}", awards())
out = out.replace("{{CV_COUNT}}", cv_count())
out = out.replace("{{ABOUT}}", esc(content["about"]))
out = out.replace("{{PRESS}}", press())
out = out.replace("{{KINDS}}", json.dumps(KINDS))
out = out.replace("{{PROJECTS}}", json.dumps(projects(), ensure_ascii=False).replace("</", "<\\/"))
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
