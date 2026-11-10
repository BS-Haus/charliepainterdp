#!/usr/bin/env python3
"""Render public/index.html from template.html + content.json, and a page for each film (public/<slug>.html, served at
/<slug>): the same site with that film open, so a link to a film previews as that film.

Edit content.json (add a film, reorder, change credits), then run:  python3 build.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).parent
SITE = "https://charliepainterdp.vercel.app"   # the address search and link previews are pointed at
content = json.loads((ROOT / "content.json").read_text())
esc = html.escape

LABELS = {"narrative": "Narrative", "commercial": "Commercial"}
KINDS = {"Short": "Short film", "Feature": "Feature film"}
FILMS = {f["slug"]: f for g in ("narrative", "commercial") for f in content[g]}
GROUP = {f["slug"]: g for g in ("narrative", "commercial") for f in content[g]}   # which half of the work a film is in


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
          <div class="tile-cap"><h3 class="tile-title"><a href="/{f["slug"]}">{esc(title_of(f))}</a></h3><p class="tile-credit credit">{esc(under)}</p></div>
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
    """The first screen's stills, three from each of the best films, one after another; each knows its half of the work,
    so the switch can change the reel (narrative to start with)"""
    shots = []
    for show in content["showcase"]:
        for s in show["stills"]:
            first = not shots
            on = ' class="is-on"' if first else ""
            shots.append(f'<img src="/media/stills/{s}.jpg" alt="" data-slug="{show["slug"]}" data-group="{GROUP[show["slug"]]}" '
                         f'loading="{"eager" if first else "lazy"}" decoding="async" draggable="false"{on} />')
    return "\n        ".join(shots)


def ticker():
    """Which film you're looking at: a segment for each that fills while its stills play, its name beneath. Only the
    reel that's showing has its dashes out (narrative to start with)"""
    current = ' aria-current="true"'
    start = GROUP[content["showcase"][0]["slug"]]
    return "".join(
        f'<li{"" if GROUP[show["slug"]] == start else " hidden"}><button class="tick" data-slug="{show["slug"]}" data-group="{GROUP[show["slug"]]}"{current if i == 0 else ""}>'
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


def cv_rows(rows):
    return "\n".join(
        f'          <li><span class="cv-t">{esc(t)}</span><span class="cv-c">{esc(" / ".join(x for x in (d, p) if x))}</span></li>'
        for t, d, p in rows
    )


def cv():
    blocks = []
    for key, label in (("feature", "Feature film"), ("short", "Short film"), ("commercial", "Commercial")):
        blocks.append(f'''      <div class="cv-block">
        <h3 class="label">{label}</h3>
        <ul class="cv-list">
{cv_rows(content["cv"][key])}
        </ul>
      </div>''')
    return "\n".join(blocks)


def awards():
    return "\n".join(
        f'          <li><span class="label">{esc(r)}</span><span class="cv-t">{esc(a)}</span><span class="cv-c">{esc(f)}</span></li>'
        for r, a, f in content["awards"]
    )


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
# (one Tab stop: the one that's on; the arrow keys move between them)
off = ' tabindex="-1"'
toggle = "".join(
    f'<button class="opt" role="radio" aria-checked="{"true" if g == "narrative" else "false"}"{"" if g == "narrative" else off} data-group="{g}">{LABELS[g]}</button>'
    for g in ("narrative", "commercial")
)
out = out.replace("{{TOGGLE}}", toggle)
out = out.replace("{{CV}}", cv())
out = out.replace("{{AWARDS}}", awards())
out = out.replace("{{ABOUT}}", esc(content["about"]))
out = out.replace("{{PRESS}}", press())
out = out.replace("{{KINDS}}", json.dumps(KINDS))
out = out.replace("{{PROJECTS}}", json.dumps(projects(), ensure_ascii=False).replace("</", "<\\/"))


def person():
    """Who the site is about, for search: only what the page itself says."""
    data = {
        "@context": "https://schema.org", "@type": "Person", "name": "Charlie Painter", "jobTitle": "Director of Photography",
        "description": content["about"], "url": f"{SITE}/", "image": f"{SITE}/media/portrait.jpg", "email": "mailto:charlie@charliepainterdp.com",
        "address": {"@type": "PostalAddress", "addressLocality": "London", "addressCountry": "GB"},
        "sameAs": ["https://vimeo.com/charliepainterdp", "https://www.instagram.com/charliepainter_dp", "https://www.imdb.com/name/nm15809574/"],
        "award": [f"{a}, {f}" for r, a, f in content["awards"] if r == "Winner"],
    }
    return '\n  <script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def about_film(f):
    """A film's page, in a sentence: what it is, who made it, what it won."""
    kind = KINDS.get(f["kind"], f["kind"]).lower()
    line = f"{title_of(f)}, {'an' if kind[0] in 'aeiou' else 'a'} {kind}"
    if f.get("director"):
        line += f" directed by {f['director']}"
    if f.get("production"):
        line += f" for {f['production']}"
    line += ". Cinematography by Charlie Painter."
    if f.get("accolade"):
        line += f" {f['accolade']}."
    return line


def page(film=None):
    """The site's head for the whole site, or for one film's own page."""
    if film is None:
        still, title = "operationdynamo-1", "Charlie Painter — Director of Photography, London"
        meta = {"TITLE": title, "OG_TITLE": "Charlie Painter — Director of Photography", "URL": f"{SITE}/",
                "DESCRIPTION": "Charlie Painter is a London-based cinematographer working across narrative features, shorts and commercials. "
                               "Winner of Best Cinematography at SSIFF 2025 and a British Society of Cinematographers mentee.",
                "OG_DESCRIPTION": "Narrative features, shorts and commercials. London.", "OG_IMAGE_ALT": "A still from Operation Dynamo, shot by Charlie Painter",
                "JSONLD": person(), "FILM_ATTR": ""}
    else:
        still, title = film["stills"][0], f"{title_of(film)} — Charlie Painter"
        meta = {"TITLE": title, "OG_TITLE": title, "URL": f"{SITE}/{film['slug']}", "DESCRIPTION": about_film(film), "OG_DESCRIPTION": about_film(film),
                "OG_IMAGE_ALT": f"A still from {title_of(film)}", "JSONLD": "", "FILM_ATTR": f' data-film="{film["slug"]}"'}
    w, h = jpeg_size(still)
    meta.update({"OG_IMAGE": f"{SITE}/media/stills/{still}.jpg", "OG_IMAGE_W": str(w), "OG_IMAGE_H": str(h)})
    head = out
    for k, v in meta.items():
        head = head.replace("{{" + k + "}}", v if k in ("JSONLD", "FILM_ATTR") else esc(v))
    return head


(ROOT / "public" / "index.html").write_text(page())
for f in FILMS.values():
    (ROOT / "public" / f"{f['slug']}.html").write_text(page(f))
print(f"Built public/index.html and {len(FILMS)} film pages")
