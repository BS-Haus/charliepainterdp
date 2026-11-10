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
  const hero = $(".hero"), screen = $("#screen"), shots = $$("img", screen);
  const work = $("#work"), groupsEl = $("#groups"), bar = $("#bar");
  let openSheet = null;

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
      }, 5000);   // the intro's own clock (styles.css)
    };
    if (shots[0].complete) roll();
    else shots[0].addEventListener("load", roll, { once: true });
    shots[0].addEventListener("error", roll, { once: true });
    setTimeout(roll, 1500);
  }

  /* ---------- The name: a small title above the picture (the stylesheet sizes it), shown once its face has loaded. The
     title and the film under the picture are measured, so the picture can take exactly what they leave ---------- */
  const heroName = $("#hero-name"), heroTitle = $(".hero-title"), tickerEl = $("#ticker");
  const fitName = () => {
    html.style.setProperty("--title-h", `${heroTitle.offsetHeight}px`);
    html.style.setProperty("--ticker-h", `${tickerEl.offsetHeight}px`);
    heroName.classList.add("is-fit");
  };
  document.fonts.ready.then(fitName);
  document.fonts.addEventListener("loadingdone", fitName);
  setTimeout(fitName, 2500);   // whatever happens with the fonts, show the name
  window.addEventListener("resize", fitName);

  /* ======================================================================
     THE SCREEN — three stills from each of the best films, one dissolving into the next. The bar beneath has a segment
     for each film that fills while its stills are up; click one to go to that film, click the screen to open it.
     It rests while it's covered, while a film is open, and while the page is hidden
     ====================================================================== */
  const SHOT = 2400;   // how long each still is up
  const ticks = $$(".tick"), segs = ticks.map((tk) => $(".seg i", tk)), tickNow = $(".ticker-now"), tickTitle = $("#ticker-title"), tickKind = $("#ticker-kind");
  const runs = ticks.map((t) => shots.filter((s) => s.dataset.slug === t.dataset.slug));   // each film's stills
  let at = 0, t = 0, last = 0, frame = 0, covered = false, filled = -1;

  const film = () => ticks.findIndex((tk) => tk.dataset.slug === shots[at].dataset.slug);
  // the films before are full and those after empty (set when the film changes); only the one that's up moves
  const fill = () => {
    const f = film(), run = runs[f], k = run.indexOf(shots[at]);
    if (f !== filled) {
      segs.forEach((seg, i) => { if (i !== f) seg.style.transform = `scaleX(${i < f ? 1 : 0})`; });
      filled = f;
    }
    segs[f].style.transform = `scaleX(${((k + t / SHOT) / run.length).toFixed(4)})`;
  };
  const show = (i) => {
    const prev = shots[at];
    at = (i + shots.length) % shots.length;
    const shot = shots[at];
    t = 0;
    if (prev !== shot) {
      shots.forEach((s) => s.classList.remove("was-on"));
      prev.classList.replace("is-on", "was-on");
      shot.classList.add("is-on");
      // the one underneath goes once the new one has covered it
      setTimeout(() => { if (!prev.classList.contains("is-on")) prev.classList.remove("was-on"); }, reduceMotion ? 0 : 1000);
    }
    // the next stills start loading before they're needed
    [1, 2].forEach((d) => { shots[(at + d) % shots.length].loading = "eager"; });
    const f = film(), p = bySlug.get(shot.dataset.slug);
    ticks.forEach((tk, j) => (j === f ? tk.setAttribute("aria-current", "true") : tk.removeAttribute("aria-current")));
    if (p) {
      screen.href = `/${p.slug}`;
      screen.setAttribute("aria-label", `Open ${p.title}`);
      if (tickTitle.textContent !== p.name) {
        tickTitle.textContent = p.name;
        tickKind.textContent = KINDS[p.kind] || p.kind;
        // the name of the film that's up fades in as it changes
        if (!reduceMotion) tickNow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "cubic-bezier(.4, 0, .2, 1)" });
      }
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
  const playing = () => introDone && !reduceMotion && !covered && !openSheet && !document.hidden;   // with less motion, it holds on the first
  function wake() {
    cancelAnimationFrame(frame);
    if (!playing()) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }
  ticks.forEach((tk, i) => tk.addEventListener("click", () => { show(shots.indexOf(runs[i][0])); wake(); }));
  document.addEventListener("visibilitychange", wake);
  show(0);

  /* ======================================================================
     THE BAR — the page slides up over the pinned screen, which dims and then rests. The bar on the page's top edge
     rides up with it; when it reaches the top it stays as the header and the small name joins it
     ====================================================================== */
  // how far the page travels before it covers the screen (and the bar reaches the top): measured, not read on every scroll
  const shade = $(".hero-shade");
  let span = 1;
  const measure = () => { span = Math.max(1, hero.offsetHeight - bar.offsetHeight); };
  const onScroll = () => {
    const y = window.scrollY, c = clamp(y / span, 0, 1);
    if (!scrollLinked) { shade.style.opacity = (c * 0.85).toFixed(3); bar.style.setProperty("--grey", c.toFixed(3)); }
    bar.classList.toggle("is-top", y >= span - 0.5);
    if ((c >= 0.999) !== covered) {
      covered = c >= 0.999;
      wake();
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measure(); onScroll(); });

  /* ======================================================================
     THE SWITCH — narrative or commercial work. The light pill slides under the one that's on, and the frames change
     over to that half. There are two, kept in step: the bar's, and on a phone the one at the top of the work
     ====================================================================== */
  const toggles = $$(".toggle"), opts = $$(".opt");
  const groups = $$(".group", groupsEl);
  let switching = 0;
  const place = () => toggles.forEach((tg) => {
    const all = $$(".opt", tg), on = all.find((o) => o.getAttribute("aria-checked") === "true"), thumb = $(".thumb", tg);
    if (!on || !tg.offsetWidth) return;   // a switch that isn't showing is placed when it shows (on resize)
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
    if (!reduceMotion) {
      await was.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: OUT, fill: "forwards" }).finished.catch(() => {});
      if (my !== switching) return;
    }
    // if you're down in the work, come back to its top so you see the change
    const workTop = work.getBoundingClientRect().top + window.scrollY - bar.offsetHeight;
    if (window.scrollY > workTop + 4) window.scrollTo({ top: workTop, behavior: "instant" });
    const y = window.scrollY;
    was.getAnimations().forEach((a) => a.cancel());
    was.hidden = true;
    next.hidden = false;
    // the browser would keep a frame from the half that's gone in view (scroll anchoring); stay where you were
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: "instant" });
    $$(".tile", next).forEach((tile) => { tile.classList.remove("in", "rising"); reveal.observe(tile); });
  };
  // either half flips it, like a switch: the other half, or the one that's on (which hands over to the other)
  const other = (group) => (group === "narrative" ? "commercial" : "narrative");
  opts.forEach((o) => o.addEventListener("click", () => choose(o.getAttribute("aria-checked") === "true" ? other(o.dataset.group) : o.dataset.group)));
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
    ...$$(".cv .sec-head, .contact .sec-head, .press .sec-head, .cv-block, .press-item").map((el) => [el, "rv-rule"]),
    ...$$(".sec-title, .about, .mail, .press-title").map((el) => [el, "rv-wipe"]),
    ...$$(".sec-head .label, .cv-block h3, .cv-list li, .links a, .portrait, .press-stand, .press-read").map((el) => [el, "rv"]),
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
        setTimeout(() => { e.target.classList.remove("rv", "rv-wipe", "rv-rule", "in"); e.target.style.removeProperty("--rv-delay"); }, delay + 1700);
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
  const behind = [$(".page"), hero];
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
  const play = (p) => {
    const film = $("#proj-player .film");
    if (!p.video || !film || $("iframe", film)) return;
    film.insertAdjacentHTML("beforeend", `<iframe src="${embed(p.video)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(p.title)}"></iframe>`);
    $("iframe", film).addEventListener("load", (e) => e.target.classList.add("is-ready"), { once: true });
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
    player.classList.toggle("is-still", !p.video);
    // a film opens on its first still; with no player, that still is the picture at the top and isn't repeated below
    player.innerHTML = p.video ? `<div class="film">${pic(0, "", "poster")}</div>` : pic(0, esc(p.title));
    $("#proj-title").textContent = p.title;
    // what it won, where it has something, says more than what kind of film it is
    const rows = [["Director", p.director], ["Production", p.production], p.accolade ? ["Award", p.accolade] : ["Type", KINDS[p.kind] || p.kind]];
    if (p.note) rows.push(["With", p.note.replace(/^(Starring|Talent)\s+/i, "")]);
    // an award reads as what it was, then where: "Best Cinematography – SSIFF" sets as two lines
    const cell = (k, v) => (k === "Award" ? esc(v).replace(/\s+[–—-]\s+(.+)$/, "<span>$1</span>") : esc(v));
    $("#proj-credits").innerHTML = rows.filter((r) => r[1]).slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${cell(k, v)}</dd></div>`).join("");
    $("#proj-stills").innerHTML = p.stills.map((s, j) => j).filter((j) => p.video || j > 0)
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
    wake();
    const phone = asPhone.matches;
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
    play(p);
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
    if (my === moving) play(p);
  };
  const close = async () => {
    if (!openSheet) return;
    const my = ++moving;
    openSheet = null;
    current = null;
    document.title = "Charlie Painter — Director of Photography, London";
    behind.forEach((el) => { el.inert = false; });
    wake();
    lastFocus?.focus?.({ preventScroll: true });
    const phone = asPhone.matches;
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
  // closing goes back to the site's own address without moving the page
  const dismiss = (e) => { e?.preventDefault(); history.pushState(null, "", "/" + location.search); close(); };
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
    if (p) open(p);
    else close();
  };
  function go(slug) {
    if (location.pathname !== `/${slug}`) history.pushState(null, "", `/${slug}${location.search}`);
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

  /* ---------- The bar: which part of the page you're in ---------- */
  // a part is lit once its top has passed the middle of the screen; the last one passed wins
  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));
  const passed = sections.map(() => false);
  const lights = new IntersectionObserver((entries) => {
    entries.forEach((e) => { passed[sections.indexOf(e.target)] = e.isIntersecting || e.boundingClientRect.top < 0; });
    const on = passed.lastIndexOf(true);
    navLinks.forEach((a, i) => a.classList.toggle("is-on", i === on));
  }, { rootMargin: "0px 0px -50% 0px" });
  sections.forEach((el) => el && lights.observe(el));

  measure();
  onScroll();
  route();
  wake();
})();
