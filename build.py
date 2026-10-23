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

# The two showreels open their halves of the roll; their frames are stills pulled from the reel
REELS = {
    "narrative": {"title": "Narrative showreel", "credit": "Features & shorts", "src": "/media/reel-narrative-v3.mp4", "poster": "/media/reel-narrative-v2-poster.jpg", "vimeo": "1149629056"},
    "commercial": {"title": "Commercial showreel", "credit": "Commercials & brand films", "src": "/media/reel-commercial-v2.mp4", "poster": "/media/reel-commercial-v2-poster.jpg", "vimeo": "1188991301"},
}


def credit(p):
    return " · ".join(x for x in [p.get("credit"), p.get("detail")] if x)


def items():
    """Everything on the roll, in order: each half opens with its reel, then its films."""
    out, n = [], 0
    for group in ("narrative", "commercial"):
        r = REELS[group]
        out.append({
            "type": "reel", "group": group, "era": "all", "n": "R1" if group == "narrative" else "R2", "title": r["title"],
            "credit": r["credit"], "kind": "Showreel", "frames": [f"reel-{group}-{i}" for i in range(1, 9)],
            "src": r["src"], "poster": r["poster"], "provider": "vimeo", "id": r["vimeo"],
        })
        for p in content[group]:
            n += 1
            v = p.get("video") or {}
            out.append({
                "type": "film", "group": group, "era": p.get("era", "contemporary"), "n": f"{n:02d}",
                "title": p["title"] + (f" — ‘{p['subtitle']}’" if p.get("subtitle") else ""),
                "credit": credit(p), "kind": p["kind"], "frames": p["stills"],
                "provider": v.get("provider", ""), "id": v.get("id", ""), "hash": v.get("hash", ""),
            })
    return out, n


def attrs(it):
    a = f' data-type="{it["type"]}" data-group="{it["group"]}" data-era="{it["era"]}" data-n="{it["n"]}" data-title="{esc(it["title"])}" data-credit="{esc(it["credit"])}" data-kind="{esc(it["kind"])}"'
    if it.get("src"):
        a += f' data-src="{it["src"]}" data-poster="{it["poster"]}"'
    if it.get("id"):
        a += f' data-provider="{it["provider"]}" data-id="{it["id"]}"'
    if it.get("hash"):
        a += f' data-hash="{it["hash"]}"'
    return a


def roll(all_items):
    """The roll: every frame of every film, side by side, each film labelled beneath its run."""
    runs = []
    for k, it in enumerate(all_items):
        cells = "".join(
            f'<span class="cell" data-f="{f}"><img src="/media/thumbs/{fr}.jpg" alt="" loading="{"eager" if k < 4 else "lazy"}" decoding="async" /></span>'
            for f, fr in enumerate(it["frames"])
        )
        half = ' data-half="1"' if it["type"] == "reel" else ""
        runs.append(f'        <div class="run" data-item="{k}"{half}{attrs(it)}><div class="cells">{cells}</div><p class="run-label mono">{esc(it["n"])}</p></div>')
    return "\n".join(runs)


def deck_map(all_items):
    """The map on the deck: a half for each reel and its films; one segment per film, as long as its run of frames."""
    halves = []
    for group in ("narrative", "commercial"):
        segs = "".join(
            f'<button class="seg{" seg-reel" if it["type"] == "reel" else ""}" data-item="{k}" style="flex-grow:{len(it["frames"])};--i:{k}" aria-label="{esc(it["title"])}"></button>'
            for k, it in enumerate(all_items) if it["group"] == group
        )
        halves.append(f'<div class="half" data-group="{group}"><div class="segs">{segs}</div></div>')
    return "".join(halves)


# The switches on the deck, in two pairs. A film is on the roll when both of its pairs let it through.
# The showreels mix period and contemporary work, so they only run while both of those are on.
SWITCHES = (
    ("era", (("period", "Period"), ("contemporary", "Contemporary"))),
    ("group", (("narrative", "Narrative"), ("commercial", "Commercial"))),
)


def toggles():
    sets, i = [], 0
    for dim, options in SWITCHES:
        buttons = ""
        for val, label in options:
            buttons += f'<button class="tog is-on" data-val="{val}" aria-pressed="true" style="--i:{i}"><i aria-hidden="true"></i>{label}</button>'
            i += 1
        sets.append(f'<div class="tog-set" data-dim="{dim}">{buttons}</div>')
    return "".join(sets)


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

all_items, films = items()
out = (ROOT / "template.html").read_text()
out = out.replace("{{ROLL}}", roll(all_items))
out = out.replace("{{MAP}}", deck_map(all_items))
out = out.replace("{{TOGGLES}}", toggles())
out = out.replace("{{FILM_COUNT}}", f"{films:02d}")
out = out.replace("{{ALSO}}", '      <div class="also-cols">\n' + narr_extra + "\n" + comm_extra + "\n      </div>")
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
