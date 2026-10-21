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


def index_view(items):
    """A: big titles, with a sticky monitor that plays through the active film's frames."""
    rows = "\n".join(
        f"""          <li class="ix-item"{film_attrs(p)} data-credit="{esc(credit(p))}" data-kind="{esc(p['kind'])}">
            <button class="ix-btn"><span class="ix-n mono">{i + 1:02d}</span><span class="ix-title">{title_html(p)}</span><span class="ix-kind mono">{esc(p['kind'])}</span></button>
          </li>"""
        for i, p in enumerate(items)
    )
    return f"""      <div class="v v-index">
        <ol class="ix-list">
{rows}
        </ol>
        <aside class="monitor" aria-live="polite">
          <div class="monitor-screen"></div>
          <div class="monitor-cap">
            <p class="monitor-title"></p>
            <p class="monitor-credit mono"></p>
            <div class="monitor-acts mono"><button class="m-play">Play film ↗</button><button class="m-frames">View frames</button></div>
          </div>
        </aside>
      </div>"""


def sheet_view(items):
    """B: every frame on one contact sheet, numbered and grouped by film."""
    cells = []
    for p in items:
        for k, s in enumerate(p["stills"]):
            cells.append(
                f'<button class="sh-cell" data-film="{esc(p["title"])}" data-i="{k}" style="--tint:{p.get("tint", "#111")}">'
                f'<img src="/media/thumbs/{s}.jpg" alt="Frame from {esc(p["title"])}" loading="lazy" decoding="async" />'
                f'<span class="mono">{esc(p["title"])} <b>{k + 1:02d}</b></span></button>'
            )
    return f"""      <div class="v v-sheet" hidden>
        <div class="sheet">{''.join(cells)}</div>
      </div>"""


def screen_view(items):
    """C: one key frame per film, side by side, like stepping along a screening programme."""
    cards = "\n".join(
        f"""          <li class="sc-card"{film_attrs(p)}>
            <button class="sc-btn">
              <span class="sc-frame"><img src="/media/stills/{p['stills'][0]}.jpg" alt="" loading="lazy" decoding="async" /></span>
              <span class="sc-meta"><span class="mono">{i + 1:02d} · {esc(p['kind'])}</span><b>{title_html(p)}</b><small class="mono">{esc(credit(p))}</small></span>
            </button>
          </li>"""
        for i, p in enumerate(items)
    )
    return f"""      <div class="v v-screen" hidden>
        <ol class="sc-track">
{cards}
        </ol>
        <div class="sc-nav mono"><button class="sc-prev" aria-label="Previous film">←</button><button class="sc-next" aria-label="Next film">→</button></div>
      </div>"""


def panel(key, items, extra):
    hidden = "" if key == "narrative" else " hidden"
    return f"""    <div class="panel" data-set="{key}" id="panel-{key}" role="tabpanel"{hidden}>
{index_view(items)}
{sheet_view(items)}
{screen_view(items)}
{extra}
    </div>"""


narr_more = "\n".join(
    f'          <li><span>{esc(t)}</span><span>{esc(c)}</span><span>{esc(k)}</span></li>'
    for t, k, c in content["narrative_more"]
)
narr_extra = f"""      <div class="also">
        <p class="mono">Also shot</p>
        <ul class="also-list mono">
{narr_more}
        </ul>
      </div>"""
comm_extra = f"""      <div class="also">
        <p class="mono">Also shot</p>
        <p class="also-line">{" · ".join(esc(x) for x in content["commercial_more"])}</p>
      </div>
      <a class="studio-link mono" href="https://painterstudio.vercel.app" target="_blank" rel="noopener">
        <span>Commissioning content for a brand?</span>
        <b>Painter.Studio — Charlie’s content studio ↗</b>
      </a>"""

out = (ROOT / "template.html").read_text()
out = out.replace("{{NARRATIVE_PANEL}}", panel("narrative", content["narrative"], narr_extra))
out = out.replace("{{COMMERCIAL_PANEL}}", panel("commercial", content["commercial"], comm_extra))
out = out.replace("{{NARRATIVE_COUNT}}", f'{len(content["narrative"]):02d}')
out = out.replace("{{COMMERCIAL_COUNT}}", f'{len(content["commercial"]):02d}')
(ROOT / "public" / "index.html").write_text(out)
print("Built public/index.html")
