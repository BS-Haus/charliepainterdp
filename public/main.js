(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // whatever the visitor sets moving goes at once and settles, coming or going (nothing eases in)
  const OUT = "cubic-bezier(.23, 1, .32, 1)";
  // the browser can tie motion to the scroll itself; where it can't (or with less motion asked for), script does
  const scrollLinked = !reduceMotion && window.CSS?.supports?.("animation-timeline: scroll()");
  const PROJECTS = window.PROJECTS || [];
  const KINDS = window.KINDS || {};
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));

  $$(".year").forEach((y) => { y.textContent = new Date().getFullYear(); });

  const html = document.documentElement;
  const hero = $(".hero"), screen = $("#screen"), allShots = $$("img", screen);
  // the reel that's showing: the stills from whichever half of the work is switched on (narrative to start with)
  let shots = allShots.filter((s) => s.dataset.group === allShots[0].dataset.group);
  const work = $("#work"), groupsEl = $("#groups"), bar = $("#bar");
  let openSheet = null, nowPlaying = null;   // the details panel that's up; the film playing on the display

  /* ---------- The intro plays once per visit (the page marks it before anything paints). It holds on black until the
     screen has its first still to open onto (the page lets it go after 1.5s anyway); the stills start once it's done */
  const intro = html.classList.contains("intro");
  let introDone = !intro;
  if (intro) {
    let rolling = false;
    const roll = () => {
      if (rolling) return;
      rolling = true;
      html.classList.remove("is-waiting");
      setTimeout(() => {
        html.classList.remove("intro");
        try { sessionStorage.setItem("cp-intro", "1"); } catch (e) {}
        introDone = true;
        wake();
      }, 3000);   // the intro's own clock (styles.css)
    };
    if (shots[0].complete) roll();
    else shots[0].addEventListener("load", roll, { once: true });
    shots[0].addEventListener("error", roll, { once: true });
    setTimeout(roll, 1500);
  }


  /* ======================================================================
     THE SCREEN — three stills from each of the best films, one dissolving into the next: the narrative films, or the
     commercial ones, whichever the switch is on. The line has a segment for each film that fills while its stills are
     up; click one to go to that film, click the screen to open it. It rests while it's covered, while a film is open,
     and while the page is hidden
     ====================================================================== */
  const SHOT = 2400;   // how long each still is up
  const allTicks = $$(".tick"), tickTitle = $("#ticker-title"), tickKind = $("#ticker-kind");
  const hudFields = [tickTitle, tickKind], hudTc = $("#hud-tc");
  const two = (n) => String(n).padStart(2, "0");
  let reelGroup = shots[0].dataset.group, ticks, segs, runs;
  // the dashes for the reel that's showing, and each film's stills in it
  const cast = () => {
    ticks = allTicks.filter((tk) => tk.dataset.group === reelGroup);
    segs = ticks.map((tk) => $(".seg i", tk));
    runs = ticks.map((tk) => shots.filter((s) => s.dataset.slug === tk.dataset.slug));
    allTicks.forEach((tk) => { tk.parentElement.hidden = tk.dataset.group !== reelGroup; });
  };
  cast();
  let at = 0, t = 0, last = 0, frame = 0, covered = false, filled = -1, cur = shots[0];

  const film = () => ticks.findIndex((tk) => tk.dataset.slug === shots[at].dataset.slug);
  // the films before are full and those after empty (set when the film changes); only the one that's up moves
  // a still gets its source when it's coming up (only the first has one from the start)
  const load = (img) => { if (img && !img.getAttribute("src") && img.dataset.src) img.src = img.dataset.src; };
  const loaded = (img) => { load(img); return (img.complete ? Promise.resolve() : img.decode()).catch(() => {}); };
  const fill = () => {
    const f = film(), run = runs[f], k = run.indexOf(shots[at]);
    if (f !== filled) {
      segs.forEach((seg, i) => { if (i !== f) seg.style.transform = `scaleX(${i < f ? 1 : 0})`; });
      filled = f;
    }
    // (in twelfths, the way a display's meter steps, not a smooth slide)
    segs[f].style.transform = `scaleX(${(Math.floor(((k + t / SHOT) / run.length) * 12) / 12).toFixed(4)})`;
  };
  const show = (i) => {
    const prev = cur;
    at = (i + shots.length) % shots.length;
    const shot = shots[at];
    cur = shot;
    t = 0;
    if (prev !== shot) {
      allShots.forEach((s) => s.classList.remove("was-on"));
      prev.classList.replace("is-on", "was-on");
      shot.classList.add("is-on");
      // the one underneath goes once the new one has covered it
      setTimeout(() => { if (!prev.classList.contains("is-on")) prev.classList.remove("was-on"); }, reduceMotion ? 0 : 1000);
    }
    // the next stills start loading before they're needed
    load(shot);
    [1, 2].forEach((d) => load(shots[(at + d) % shots.length]));
    const f = film(), p = bySlug.get(shot.dataset.slug);
    allTicks.forEach((tk) => (tk === ticks[f] ? tk.setAttribute("aria-current", "true") : tk.removeAttribute("aria-current")));   // (the other reel's too)
    if (p) {
      screen.href = `/${p.slug}`;
      screen.setAttribute("aria-label", `Open ${p.title}`);
      const changed = tickTitle.textContent !== p.name;
      tickTitle.textContent = p.name;
      tickKind.textContent = KINDS[p.kind] || p.kind;
      // what's up fades in as the film changes
      if (changed && !reduceMotion) hudFields.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "cubic-bezier(.4, 0, .2, 1)" }));
    }
    fill();
  };
  const step = (now) => {
    t += Math.min(now - last, 100);   // a dropped frame doesn't skip a still
    last = now;
    if (t >= SHOT) show(at + 1);
    else fill();
    frame = requestAnimationFrame(step);
  };
  const playing = () => introDone && !reduceMotion && !covered && !openSheet && !nowPlaying && !document.hidden;   // with less motion, it holds on the first
  function wake() {
    cancelAnimationFrame(frame);
    if (!playing()) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }
  allTicks.forEach((tk) => tk.addEventListener("click", () => {
    const to = shots.find((s) => s.dataset.slug === tk.dataset.slug);
    if (to) loaded(to).then(() => { if (shots.includes(to)) { show(shots.indexOf(to)); wake(); } });
  }));
  document.addEventListener("visibilitychange", wake);
  show(0);
  // the timecode: the time of day, at 24 frames a second (with less motion, by the second); only while it's on view
  const stamp = () => {
    if (document.hidden || covered) return;
    const d = new Date(), fr = reduceMotion ? 0 : Math.floor((d.getMilliseconds() * 24) / 1000);
    const tc = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}:${two(fr)}`;
    if (hudTc.textContent !== tc) hudTc.textContent = tc;
  };
  stamp();
  setInterval(stamp, reduceMotion ? 1000 : 1000 / 24);
  // the switch changes the reel: the other half's films from the first, its first still dissolving in over what was up
  // (once it's loaded; the other half's first stills load early, once the page has settled, with each film's first)
  let reeling = 0;
  const reel = (group) => {
    if (group === reelGroup) return;
    const my = ++reeling;
    reelGroup = group;
    shots = allShots.filter((s) => s.dataset.group === group);
    cast();
    segs.forEach((seg) => { seg.style.transform = "scaleX(0)"; });
    at = 0; t = 0; filled = -1;
    cancelAnimationFrame(frame);
    loaded(shots[0]).then(() => { if (my === reeling) { show(0); wake(); } });
  };
  const warm = () => setTimeout(() => {
    ticks.forEach((tk) => load(shots.find((s) => s.dataset.slug === tk.dataset.slug)));   // each film's first, so a dash goes straight to it
    allShots.filter((s) => s.dataset.group !== reelGroup).slice(0, 2).forEach(load);       // and the other half's first, for the switch
  }, 1500);
  if (document.readyState === "complete") warm();
  else window.addEventListener("load", warm, { once: true });

  /* ======================================================================
     THE BAR — the page slides up over the pinned screen, which dims and then rests. The bar on the page's top edge
     rides up with it; when it reaches the top it stays as the header and the small name joins it
     ====================================================================== */

  /* ======================================================================
     THE SWITCH — narrative or commercial work. The light pill slides under the one that's on, and the frames change
     over to that half. There are two, kept in step: the bar's, and on a phone the one at the top of the work
     ====================================================================== */
  const toggles = $$(".toggle"), opts = $$(".opt");
  const groups = $$(".group", groupsEl);
  let switching = 0;
  const place = () => toggles.forEach((tg) => {
    const all = $$(".opt", tg), on = all.find((o) => o.getAttribute("aria-checked") === "true"), thumb = $(".thumb", tg);
    if (!thumb || !on || !tg.offsetWidth) return;   // (a switch with no lit block, or not showing, has nothing to place)
    thumb.style.setProperty("--tw", `${on.offsetWidth}px`);
    thumb.style.setProperty("--tx", `${on.offsetLeft}px`);
    thumb.style.setProperty("--lean", on === all[0] ? "4px" : "-4px");   // on hover it leans towards the other half
  });
  // the half that's going dims away quickly; the frames of the one coming develop in, in reading order
  const choose = async (group) => {
    const my = ++switching;
    groups.forEach((g) => g.getAnimations().forEach((a) => a.cancel()));
    const was = groups.find((g) => !g.hidden), next = groups.find((g) => g.dataset.group === group);
    opts.forEach((o) => { const on = o.dataset.group === group; o.setAttribute("aria-checked", String(on)); o.tabIndex = on ? 0 : -1; });
    place();
    if (was === next) return;
    reel(group);   // the reel on the first screen follows
    const count = $("#work-count");
    count.textContent = `${String($$(".tile", next).length).padStart(2, "0")} films`;
    if (!reduceMotion) {
      await was.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: OUT, fill: "forwards" }).finished.catch(() => {});
      if (my !== switching) return;
    }
    // the work's window shows the change from its top
    $(".win-body", work).scrollTop = 0;
    was.getAnimations().forEach((a) => a.cancel());
    was.hidden = true;
    next.hidden = false;
    $$(".tile", next).forEach((tile) => { tile.classList.remove("in", "rising"); reveal.observe(tile); });
  };
  // either half flips it, like a switch: the other half, or the one that's on (which hands over to the other)
  const other = (group) => (group === "narrative" ? "commercial" : "narrative");
  opts.forEach((o) => o.addEventListener("click", () => choose(o.getAttribute("aria-checked") === "true" ? other(o.dataset.group) : o.dataset.group)));
  $$(".slide").forEach((s) => s.addEventListener("click", () => choose(other($(".opt[aria-checked='true']").dataset.group))));
  toggles.forEach((tg) => tg.addEventListener("keydown", (e) => {
    const to = { ArrowRight: "commercial", ArrowLeft: "narrative" }[e.key];
    if (!to) return;
    e.preventDefault();
    choose(to);
    $(`.opt[data-group="${to}"]`, tg).focus();
  }));
  place();
  document.fonts.ready.then(place);
  window.addEventListener("resize", place);
  requestAnimationFrame(() => toggles.forEach((tg) => tg.classList.add("is-set")));   // from here on the pill slides

  /* ======================================================================
     FRAMES — the pictures develop in their frames as you reach them, those that arrive together in reading order;
     click one and its film opens (its first stills start loading as the pointer arrives on it)
     ====================================================================== */
  const develop = (tile, delay) => {
    tile.style.setProperty("--d", `${delay}ms`);
    tile.classList.add("rising", "in");
    // once it's settled, hovering it answers at once
    setTimeout(() => { tile.classList.remove("rising"); tile.style.removeProperty("--d"); }, delay + 1800);
  };
  const reveal = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e, i) => { develop(e.target, Math.min(i, 5) * 110); reveal.unobserve(e.target); });
  }, { rootMargin: "0px 0px -8% 0px" });

  $$(".tile").forEach((tile) => {
    if (reduceMotion) tile.classList.add("in");
    else reveal.observe(tile);
    tile.addEventListener("click", (e) => {
      e.preventDefault();
      go(tile.dataset.slug);
    });
    tile.addEventListener("pointerenter", () => {
      bySlug.get(tile.dataset.slug)?.stills.slice(0, 3).forEach((s) => { new Image().src = `/media/stills/${s}.jpg`; });
    }, { once: true });
  });

  /* ======================================================================
     CV, CONTACT AND FEATURED — they come up like a focus pull: the rules draw across and the type comes into focus,
     top to bottom. Whatever arrives together is staggered in reading order
     ====================================================================== */
  const reveals = [
    ...$$(".sec-head, .cv-block, .press-item").map((el) => [el, "rv-rule"]),
    ...$$(".about").map((el) => [el, "rv-wipe"]),
    ...$$(".sec-title, .mail, .press-title, .cv-t").map((el) => [el, "rv-decode"]),
    ...$$(".sec-head .label, .cv-block h3, .cv-list li, .links a, .press-stand, .press-read").map((el) => [el, "rv"]),
    ...$$(".portrait, .closing").map((el) => [el, "rv-power"]),
  ];
  const arrive = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e, i) => {
        const delay = Math.min(i, 14) * 55;
        e.target.style.setProperty("--rv-delay", `${delay}ms`);
        e.target.classList.add("in");
        arrive.unobserve(e.target);
        // once it has settled it's itself again: its own hover answers at once
        setTimeout(() => { e.target.classList.remove("rv", "rv-wipe", "rv-rule", "rv-decode", "rv-power", "in"); e.target.style.removeProperty("--rv-delay"); }, delay + 1900);
      });
  }, { rootMargin: "0px 0px -8% 0px" });
  if (!reduceMotion) reveals.forEach(([el, kind]) => { el.classList.add(kind); arrive.observe(el); });

  /* ======================================================================
     THE FILM — a panel laid over the site. Each film has its own address (/vetala, a page of its own, so a link to it
     previews as that film), so the back button closes it and a film can be sent on its own; the old #/vetala links still
     open it. It comes up once its first picture is ready, quickly and whole: the site dims and blurs as the panel rises
     into place (from the bottom on phones); the film's player fades in over its first still once the panel has settled.
     Prev and next slide one film out and the next in. Closing is quicker than opening. While it's up, the site behind
     can't be reached (Tab stays in the panel). Whatever is cut short carries on from where it had got to
     ====================================================================== */
  const scrim = $("#scrim"), layer = $("#layer"), proj = $("#proj"), sheetBody = $("#proj-body"), progress = $(".sheet-progress i");
  const behind = [$(".page")];   // (the film keeps playing on the display beside its details)
  const asPhone = window.matchMedia("(max-width: 760px)");
  let lastFocus = null, current = null, moving = 0;
  const motion = (el, frames, o) => (reduceMotion ? null : el.animate(frames, o));
  const over = (a) => (a ? a.finished.catch(() => {}) : Promise.resolve());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // stop whatever an element is doing, leaving it where it had got to
  const hold = (el) => el.getAnimations().forEach((a) => { try { a.commitStyles(); } catch (e) {} a.cancel(); });
  const rest = (el) => { el.getAnimations().forEach((a) => a.cancel()); el.removeAttribute("style"); };
  // a picture fades up once it's in; one that's already in is simply there
  const settle = (img) => {
    if (img.complete && img.naturalWidth) img.classList.add("is-in");
    else img.addEventListener("load", () => img.classList.add("is-in"), { once: true });
  };
  // the panel waits (briefly) for its first picture, so it never arrives empty
  const ready = (ms) => {
    const img = $("#proj-player img");
    return Promise.race([img ? img.decode().catch(() => {}) : Promise.resolve(), wait(ms)]);
  };
  // the line along the bar's foot fills as you go down the film (by script only where the browser can't tie it to the scroll)
  const track = () => {
    if (scrollLinked) return;
    const range = layer.scrollHeight - layer.clientHeight;
    progress.style.transform = `scaleX(${range > 0 ? (layer.scrollTop / range).toFixed(4) : 0})`;
  };
  if (!scrollLinked) layer.addEventListener("scroll", track, { passive: true });
  // the half that's switched on first, then the other: a film from the screen always has a place in the run
  const order = () => [...groups.filter((g) => !g.hidden), ...groups.filter((g) => g.hidden)].flatMap((g) => $$(".tile", g).map((t) => t.dataset.slug));
  const embed = ({ provider, id, hash }) => provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1&transparent=0`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const renderFilm = (p) => {
    const list = order(), i = list.indexOf(p.slug);
    const prev = bySlug.get(list[(i - 1 + list.length) % list.length]);
    const next = bySlug.get(list[(i + 1) % list.length]);
    // every picture is given its size, so each holds its space before it has loaded
    const pic = (j, alt, cls = "") => {
      const [w, h] = p.dims[j];
      return `<img${cls && ` class="${cls}"`} src="/media/stills/${p.stills[j]}.jpg" width="${w}" height="${h}" alt="${alt}" decoding="async" />`;
    };
    const player = $("#proj-player");
    player.classList.add("is-still");
    // its details open on its first still (the film itself plays on the display); that still isn't repeated below
    player.innerHTML = pic(0, esc(p.title));
    $("#proj-title").textContent = p.title;
    // what it won, where it has something, says more than what kind of film it is
    const rows = [["Director", p.director], ["Production", p.production], p.accolade ? ["Award", p.accolade] : ["Type", KINDS[p.kind] || p.kind]];
    if (p.note) rows.push(["With", p.note.replace(/^(Starring|Talent)\s+/i, "")]);
    // an award reads as what it was, then where: "Best Cinematography – SSIFF" sets as two lines
    const cell = (k, v) => (k === "Award" ? esc(v).replace(/\s+[–—-]\s+(.+)$/, "<span>$1</span>") : esc(v));
    $("#proj-credits").innerHTML = rows.filter((r) => r[1]).slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${cell(k, v)}</dd></div>`).join("");
    $("#proj-stills").innerHTML = p.stills.map((s, j) => j).filter((j) => j > 0)
      .map((j) => `<figure class="still">${pic(j, `${esc(p.title)} — still ${j + 1}`).replace("<img", `<img loading="${j < 3 ? "eager" : "lazy"}"`)}</figure>`).join("");
    $$("img", proj).forEach(settle);
    $("#proj-pos").textContent = `${pad(i + 1)} / ${pad(list.length)}`;
    $("#proj-prev").href = `/${prev.slug}`;
    $("#proj-next").href = `/${next.slug}`;
    const follow = $("#proj-follow");
    follow.href = `/${next.slug}`;
    $(".proj-follow-title", follow).textContent = next.title;
    layer.scrollTop = 0;
    track();
    current = p.slug;
    document.title = `${p.title} — Charlie Painter`;
  };

  const open = async (p) => {
    if (openSheet) return turn(p);
    const my = ++moving, cutShort = !layer.hidden;   // reopened while it was still going
    lastFocus = document.activeElement;
    openSheet = proj;
    rest(sheetBody);
    renderFilm(p);
    document.body.classList.add("is-locked");
    behind.forEach((el) => { el.inert = true; });
    light("work");
    wake();
    const phone = false;   // (it opens in the menu's window, the same on a phone)
    const from = phone ? { transform: `translateY(${innerHeight}px)` } : { opacity: 0, transform: "translateY(28px) scale(.97)" };
    const to = phone ? { transform: "none" } : { opacity: 1, transform: "none" };
    hold(proj);
    hold(scrim);
    if (!cutShort) { proj.removeAttribute("style"); scrim.removeAttribute("style"); }
    // the site dims at once; the panel waits, out of sight, for its first picture (not long), then rises: 240ms on a
    // desktop, 320ms as a sheet on a phone, title and credits with it
    const rise = motion(proj, cutShort ? [to] : [from, to], { duration: phone ? 320 : 240, easing: OUT, fill: "forwards" });
    rise?.pause();
    layer.hidden = false;
    scrim.classList.add("is-on");
    proj.focus({ preventScroll: true });
    motion(scrim, cutShort ? [{ opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: OUT, fill: "forwards" });
    if (!cutShort) await ready(120);
    if (my !== moving) return;
    rise?.play();
    await over(rise);
    if (my !== moving) return;
    rest(proj);
    rest(scrim);
  };
  // from one film to the next while the panel is up: this one slides away, that one slides in from the side it's on
  const turn = async (p) => {
    if (p.slug === current) return;
    const my = ++moving, list = order(), n = list.length;
    let d = list.indexOf(p.slug) - list.indexOf(current);
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    const dir = d < 0 ? -1 : 1;
    hold(sheetBody);
    await over(motion(sheetBody, [{ opacity: 0, transform: `translateX(${-dir * 24}px)` }], { duration: 150, easing: OUT, fill: "forwards" }));
    if (my !== moving) return;
    renderFilm(p);
    await ready(120);
    if (my !== moving) return;
    rest(sheetBody);
    const slide = motion(sheetBody, [{ opacity: 0, transform: `translateX(${dir * 36}px)` }, { opacity: 1, transform: "none" }], { duration: 250, easing: OUT });
    await over(slide);
  };
  const close = async () => {
    if (!openSheet) return;
    const my = ++moving;
    openSheet = null;
    current = null;
    document.title = nowPlaying ? `${bySlug.get(nowPlaying).title} — Charlie Painter` : "Charlie Painter — Director of Photography, London";
    behind.forEach((el) => { el.inert = false; });
    light(openWin);
    wake();
    lastFocus?.focus?.({ preventScroll: true });
    const phone = false;
    [proj, scrim, sheetBody].forEach(hold);
    const away = motion(proj, [phone ? { transform: `translateY(${innerHeight}px)` } : { opacity: 0, transform: "translateY(14px) scale(.985)" }],
      { duration: 200, easing: OUT, fill: "forwards" });
    const fade = motion(scrim, [{ opacity: 0 }], { duration: 200, easing: OUT, fill: "forwards" });
    await Promise.all([over(away), over(fade)]);
    if (my !== moving) return;
    layer.hidden = true;
    scrim.classList.remove("is-on");
    document.body.classList.remove("is-locked");
    [proj, scrim, sheetBody].forEach(rest);
    $("#proj-player").innerHTML = "";
    $("#proj-stills").innerHTML = "";
  };
  // closing steps back to where the film was opened from (its window, or the display), as the back button would; a film
  // that the visit started on goes to the site's own address
  const dismiss = (e) => { e?.preventDefault(); close(); };   // (the details close; the film plays on)
  $(".proj-back").addEventListener("click", dismiss);
  // a click on the blurred site around the panel closes it too
  layer.addEventListener("click", (e) => { if (e.target === layer) dismiss(e); });
  document.addEventListener("keydown", (e) => {
    if (!openSheet) return;
    if (e.key === "Escape") dismiss(e);
    if (e.target.closest("iframe")) return;
    if (e.key === "ArrowRight") go($("#proj-next").getAttribute("href").slice(1));
    if (e.key === "ArrowLeft") go($("#proj-prev").getAttribute("href").slice(1));
  });

  // which film the address names: /vetala (or, from older links, #/vetala, which becomes /vetala)
  const route = () => {
    const old = location.hash.match(/^#\/(.+)$/);
    const slug = old ? decodeURIComponent(old[1]) : location.pathname.replace(/^\/|\.html$|\/$/g, "");
    const p = bySlug.get(slug);
    if (old && p) history.replaceState(null, "", `/${slug}${location.search}`);
    const w = (location.hash.match(/^#(work|cv|contact|press)$/) || [])[1];
    if (w) showWin(w === "press" ? "contact" : w);
    else hideWin();
    if (p) { playHere(p); if (openSheet) open(p); }   // (with its details up, they follow the film)
    else { stopHere(); close(); }
  };
  function go(slug) {
    // one step in the history for a film however many it moves through, so one step back closes it
    if (location.pathname !== `/${slug}`) history[nowPlaying && history.state?.film ? "replaceState" : "pushState"]({ film: true }, "", `/${slug}${location.search}`);
    route();
  }
  // a link to a film here opens it in place rather than loading its page again
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='/']");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    const slug = a.getAttribute("href").slice(1);
    if (!bySlug.has(slug)) return;
    e.preventDefault();
    go(slug);
  });
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);

  /* ======================================================================
     THE MENU — the places to go come up as windows over the display, the way a camera's menu comes up over its
     picture: choose one and its cell lights white and its window comes up (quickly, rising a little), the display
     behind dims, goes out of focus and rests; choose it again, or Close, or Escape, or the display around it, and it
     goes. Each has its own address (#work, #cv, #contact), so the back button goes back through them
     ====================================================================== */
  const wins = new Map($$(".win").map((w) => [w.id, w]));
  const cells = $$(".nav .cell"), winScrim = $("#win-scrim");
  let openWin = null, winMoving = 0;
  function light(id) {
    cells.forEach((c) => (id && c.getAttribute("href") === `#${id}` ? c.setAttribute("aria-current", "true") : c.removeAttribute("aria-current")));
  }
  function showWin(id) {
    if (openWin === id || !wins.has(id)) return;
    ++winMoving;
    const was = openWin && wins.get(openWin), win = wins.get(id);
    openWin = id;
    light(openSheet ? "work" : id);
    hero.classList.add("is-dim");
    hero.inert = true;
    winScrim.hidden = false;
    covered = true;
    wake();
    if (was) { was.getAnimations().forEach((a) => a.cancel()); was.hidden = true; }
    win.getAnimations().forEach((a) => a.cancel());
    win.hidden = false;
    motion(win, [{ opacity: 0, transform: "translateY(10px) scale(.994)" }, { opacity: 1, transform: "none" }], { duration: was ? 180 : 260, easing: OUT });
  }
  async function hideWin() {
    if (!openWin) return;
    const my = ++winMoving, win = wins.get(openWin);
    openWin = null;
    light(null);
    if (!openSheet) { hero.classList.remove("is-dim"); hero.inert = false; }
    winScrim.hidden = true;
    covered = false;
    wake();
    await over(motion(win, [{ opacity: 1 }, { opacity: 0, transform: "translateY(6px) scale(.996)" }], { duration: 180, easing: OUT }));
    if (my === winMoving || openWin !== win.id) win.hidden = true;
  }
  const toWin = (id) => {
    const url = "/" + location.search + (id ? `#${id}` : "");
    if (id && openWin && !openSheet) history.replaceState(null, "", url);   // from one window to another: one step back closes
    else history.pushState(null, "", url);
    route();
  };
  cells.forEach((c) => c.addEventListener("click", (e) => {
    e.preventDefault();
    const id = c.getAttribute("href").slice(1);
    toWin(openWin === id && !openSheet ? null : id);
  }));
  $(".mark").addEventListener("click", (e) => { e.preventDefault(); toWin(null); });
  winScrim.addEventListener("click", () => toWin(null));
  $$(".win-close").forEach((b) => b.addEventListener("click", () => toWin(null)));
  $$(".win-top").forEach((b) => b.addEventListener("click", () => b.closest(".win-body").scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openWin && !openSheet && !e.defaultPrevented) toWin(null); });

  /* ======================================================================
     NOW PLAYING — choose a film (the picture on the display, or a frame in the work's window) and it plays right there
     on the display, in place of the stills: the readouts make way, and a card at the top left says what's playing,
     with the way to its details (in the menu's window), the film before or after, and back to the stills. A film with
     no player plays as its own stills, one into the next. Its address is the film's (/vetala): back, or Stop, or
     Escape goes back to the stills
     ====================================================================== */
  const stage = $("#player"), np = $("#np");
  let slides = 0;
  const unload = () => { clearInterval(slides); stage.innerHTML = ""; };
  function playHere(p) {
    if (nowPlaying === p.slug) return;
    const fresh = !nowPlaying;
    nowPlaying = p.slug;
    unload();
    if (p.video) stage.innerHTML = `<iframe src="${embed(p.video)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(p.title)}"></iframe>`;
    else {
      stage.innerHTML = p.stills.map((s, j) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async"${j ? "" : ' class="is-on"'} />`).join("");
      let k = 0;
      if (!reduceMotion && p.stills.length > 1) slides = setInterval(() => {
        const imgs = $$("img", stage);
        imgs[k].classList.remove("is-on");
        k = (k + 1) % imgs.length;
        imgs[k].classList.add("is-on");
      }, 3200);
    }
    stage.hidden = false;
    hero.classList.add("is-playing");
    const list = order(), i = list.indexOf(p.slug);
    $("#np-title").textContent = p.title;
    $("#np-meta").textContent = [KINDS[p.kind] || p.kind, p.director && `Dir. ${p.director}`].filter(Boolean).join(" · ");
    $("#np-prev").href = `/${list[(i - 1 + list.length) % list.length]}`;
    $("#np-next").href = `/${list[(i + 1) % list.length]}`;
    np.hidden = false;
    if (fresh) motion(np, [{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: OUT });
    else motion($("#np-title"), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: OUT });
    document.title = `${p.title} — Charlie Painter`;
    wake();
  }
  function stopHere() {
    if (!nowPlaying) return;
    nowPlaying = null;
    unload();
    stage.hidden = true;
    hero.classList.remove("is-playing");
    np.hidden = true;
    document.title = "Charlie Painter — Director of Photography, London";
    wake();
  }
  const stop = () => {
    if (history.state?.film) history.back();
    else { history.pushState(null, "", "/" + location.search); route(); }
  };
  $("#np-stop").addEventListener("click", stop);
  $("#np-info").addEventListener("click", () => { if (nowPlaying) open(bySlug.get(nowPlaying)); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nowPlaying && !openWin && !openSheet && !e.defaultPrevented) stop(); });

  /* ---------- The time where he is, by the contact: London, to the second ---------- */
  const clock = $("#clock");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" });
    const tick = () => { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  }

  route();
  wake();
})();
