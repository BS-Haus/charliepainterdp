(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // whatever the visitor sets moving goes at once and settles (in or out: nothing eases in); a sheet let go of runs on
  const OUT = "cubic-bezier(.23, 1, .32, 1)";
  const DRAWER = "cubic-bezier(.32, .72, 0, 1)";
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
      }, 3000);
    };
    if (shots[0].complete) roll();
    else shots[0].addEventListener("load", roll, { once: true });
    shots[0].addEventListener("error", roll, { once: true });
    setTimeout(roll, 1500);
  }

  /* ---------- The name, edge to edge: sized to the width once its face has loaded. The screen above takes whatever
     height it leaves ---------- */
  const heroName = $("#hero-name"), nameIn = $(".hero-name-in", heroName);
  const fitName = () => {
    heroName.style.fontSize = "100px";
    heroName.style.fontSize = `${(100 * heroName.clientWidth) / nameIn.offsetWidth}px`;
    html.style.setProperty("--name-h", `${heroName.offsetHeight}px`);
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
  const ticks = $$(".tick"), tickTitle = $("#ticker-title"), tickKind = $("#ticker-kind");
  const runs = ticks.map((t) => shots.filter((s) => s.dataset.slug === t.dataset.slug));   // each film's stills
  let at = 0, t = 0, last = 0, frame = 0, covered = false;

  const film = () => ticks.findIndex((tk) => tk.dataset.slug === shots[at].dataset.slug);
  const fill = () => {
    const f = film(), run = runs[f], k = run.indexOf(shots[at]);
    ticks.forEach((tk, i) => tk.style.setProperty("--p", i < f ? 1 : i > f ? 0 : ((k + t / SHOT) / run.length).toFixed(4)));
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
      screen.href = `#/${p.slug}`;
      screen.setAttribute("aria-label", `Open ${p.title}`);
      if (tickTitle.textContent !== p.name) {
        tickTitle.textContent = p.name;
        tickKind.textContent = KINDS[p.kind] || p.kind;
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
  const onScroll = () => {
    const span = hero.offsetHeight - bar.offsetHeight;
    const c = clamp(window.scrollY / (span || 1), 0, 1);
    hero.style.setProperty("--cover", c.toFixed(3));
    bar.classList.toggle("is-top", bar.getBoundingClientRect().top <= 0.5);
    if ((c >= 0.999) !== covered) {
      covered = c >= 0.999;
      wake();
    }
    lights();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ======================================================================
     THE SWITCH — narrative or commercial work. The light pill slides under the one that's on, and the frames change
     over to that half
     ====================================================================== */
  const toggle = $("#toggle"), opts = $$(".opt", toggle), thumb = $(".thumb", toggle);
  const groups = $$(".group", groupsEl);
  let switching = 0;
  const place = () => {
    const on = opts.find((o) => o.getAttribute("aria-checked") === "true");
    thumb.style.setProperty("--tw", `${on.offsetWidth}px`);
    thumb.style.setProperty("--tx", `${on.offsetLeft}px`);
  };
  // the half that's going dims away quickly; the frames of the one coming develop in, in reading order
  const choose = async (group) => {
    const my = ++switching;
    groups.forEach((g) => g.getAnimations().forEach((a) => a.cancel()));
    const was = groups.find((g) => !g.hidden), next = groups.find((g) => g.dataset.group === group);
    opts.forEach((o) => o.setAttribute("aria-checked", String(o.dataset.group === group)));
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
  opts.forEach((o) => o.addEventListener("click", () => choose(o.dataset.group)));
  toggle.addEventListener("keydown", (e) => {
    const to = { ArrowRight: "commercial", ArrowLeft: "narrative" }[e.key];
    if (!to) return;
    e.preventDefault();
    choose(to);
    $(`.opt[data-group="${to}"]`, toggle).focus();
  });
  place();
  document.fonts.ready.then(place);
  window.addEventListener("resize", place);
  requestAnimationFrame(() => toggle.classList.add("is-set"));   // from here on the pill slides

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
      location.hash = `#/${tile.dataset.slug}`;
    });
    tile.addEventListener("pointerenter", () => {
      bySlug.get(tile.dataset.slug)?.stills.slice(0, 3).forEach((s) => { new Image().src = `/media/stills/${s}.jpg`; });
    }, { once: true });
  });

  // a CV line for a film that's here opens it from anywhere on its row
  $$(".cv-row[data-slug]").forEach((row) => row.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    location.hash = `#/${row.dataset.slug}`;
  }));

  /* ======================================================================
     CV, CONTACT AND FEATURED — they come up like a focus pull: the rules draw across and the type comes into focus,
     top to bottom. Whatever arrives together is staggered in reading order
     ====================================================================== */
  const reveals = [
    ...$$(".cv .sec-head, .contact .sec-head, .press .sec-head").map((el) => [el, "rv-rule"]),
    ...$$(".sec-title, .about, .mail, .press-title").map((el) => [el, "rv-wipe"]),
    ...$$(".sec-head .label, .cv-group, .links a, .portrait, .press-item").map((el) => [el, "rv"]),
  ];
  const arrive = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e, i) => {
        const delay = Math.min(i, 14) * 55;
        e.target.style.setProperty("--rv-delay", `${delay}ms`);
        e.target.classList.add("in");
        arrive.unobserve(e.target);
        // once it has settled it's itself again: its own hover and press answer at once
        setTimeout(() => { e.target.classList.remove("rv", "rv-wipe", "rv-rule", "in"); e.target.style.removeProperty("--rv-delay"); }, delay + 1700);
      });
  }, { rootMargin: "0px 0px -8% 0px" });
  if (!reduceMotion) reveals.forEach(([el, kind]) => { el.classList.add(kind); arrive.observe(el); });

  /* ======================================================================
     THE FILM — a panel laid over the site. Each film has its own address (#/vetala), so the back button closes it and a
     film can be sent on its own. It comes up once its first picture is ready, quickly and whole: the site dims and blurs
     as the panel comes up into focus (on phones the sheet rises from the bottom, solid all the way); the film's player
     fades in over its first still once it has settled. Prev and next swap one film for the next, sliding from the side
     it's on. Going is quicker than coming. Whatever is cut short carries on from where it had got to
     ====================================================================== */
  const scrim = $("#scrim"), layer = $("#layer"), deck = $("#deck"), proj = $("#proj"), sheetBody = $("#proj-body"), progress = $("#sheet-progress");
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
  const track = () => {
    const span = layer.scrollHeight - layer.clientHeight;
    progress.style.setProperty("--sp", span > 0 ? (layer.scrollTop / span).toFixed(4) : 0);
    proj.classList.toggle("is-scrolled", proj.getBoundingClientRect().top < -0.5);   // the bar's rule shows once something's under it
  };
  layer.addEventListener("scroll", track, { passive: true });
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
    $("#proj-prev").href = `#/${prev.slug}`;
    $("#proj-next").href = `#/${next.slug}`;
    const follow = $("#proj-follow");
    follow.href = `#/${next.slug}`;
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
    wake();
    const phone = asPhone.matches;
    // desktop: up 16px into focus over 240ms; phone: the sheet (and its handle) rise from below the screen over 320ms
    const from = phone ? { transform: "translateY(calc(100% + 48px))" } : { opacity: 0, transform: "translateY(16px)", filter: "blur(4px)" };
    const to = phone ? { transform: "none" } : { opacity: 1, transform: "none", filter: "blur(0px)" };
    hold(deck);
    hold(scrim);
    if (!cutShort) { deck.removeAttribute("style"); scrim.removeAttribute("style"); }
    // the site dims at once; the panel waits, out of sight, for its first picture (not long), then comes up
    const rise = motion(deck, cutShort ? [to] : [from, to], { duration: phone ? 320 : 240, easing: OUT, fill: "forwards" });
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
    rest(deck);
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
    await over(motion(sheetBody, [{ opacity: 0, transform: `translateX(${-dir * 12}px)` }], { duration: 150, easing: OUT, fill: "forwards" }));
    if (my !== moving) return;
    renderFilm(p);
    await ready(120);
    if (my !== moving) return;
    rest(sheetBody);
    const slide = motion(sheetBody, [{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: "none" }], { duration: 250, easing: OUT });
    await over(slide);
    if (my === moving) play(p);
  };
  // let go of after a pull, a sheet runs on out on the drawer curve; otherwise it goes in 200ms, back the way it came
  const close = async (thrown = false) => {
    if (!openSheet) return;
    const my = ++moving;
    openSheet = null;
    current = null;
    document.title = "Charlie Painter — Director of Photography, London";
    wake();
    lastFocus?.focus?.({ preventScroll: true });
    const phone = asPhone.matches;
    [deck, scrim, sheetBody].forEach(hold);
    const away = motion(deck, [phone ? { transform: "translateY(calc(100% + 48px))" } : { opacity: 0, transform: "translateY(16px)", filter: "blur(4px)" }],
      { duration: thrown ? 300 : 200, easing: thrown ? DRAWER : OUT, fill: "forwards" });
    const fade = motion(scrim, [{ opacity: 0 }], { duration: thrown ? 300 : 200, easing: OUT, fill: "forwards" });
    await Promise.all([over(away), over(fade)]);
    if (my !== moving) return;
    layer.hidden = true;
    scrim.classList.remove("is-on");
    document.body.classList.remove("is-locked");
    [deck, scrim, sheetBody].forEach(rest);
    $("#proj-player").innerHTML = "";
    $("#proj-stills").innerHTML = "";
  };
  // closing drops the film's address without moving the page
  const dismiss = (e, thrown) => { e?.preventDefault(); history.pushState(null, "", location.pathname + location.search); close(thrown); };
  $(".proj-back").addEventListener("click", dismiss);
  $("#grab").addEventListener("click", dismiss);

  /* On a phone the sheet can be pulled down to close, from anywhere on it once it's scrolled to its top: a pull past
     min(64px, 15% of the sheet) or a flick (faster than 0.11px/ms over the last 100ms) sends it off; anything less springs
     it back. A finger that catches it springing back takes it from where it is. Moving under 4px is still a tap */
  let pull = null;
  const offset = () => parseFloat(getComputedStyle(deck).translate.split(" ")[1]) || 0;
  layer.addEventListener("touchstart", (e) => {
    if (!asPhone.matches || !openSheet || e.touches.length > 1) return;
    deck.getAnimations().filter((a) => a.effect.getKeyframes().some((k) => "translate" in k)).forEach((a) => { try { a.commitStyles(); } catch (x) {} a.cancel(); });
    const y = e.touches[0].clientY;
    pull = { y0: y, from: offset(), on: false, top: layer.scrollTop <= 0, trail: [[e.timeStamp, y]] };
  }, { passive: true });
  layer.addEventListener("touchmove", (e) => {
    if (!pull) return;
    const y = e.touches[0].clientY, dy = y - pull.y0;
    if (!pull.on) {
      if (!pull.top || layer.scrollTop > 0 || dy < 0) { pull = null; return; }   // that's a scroll
      e.preventDefault();
      if (dy < 4) return;
      pull.on = true;
    }
    e.preventDefault();
    deck.style.translate = `0 ${Math.max(0, pull.from + dy)}px`;
    pull.trail.push([e.timeStamp, y]);
    while (pull.trail.length > 2 && e.timeStamp - pull.trail[0][0] > 100) pull.trail.shift();
  }, { passive: false });
  const letGo = (e) => {
    if (!pull) return;
    const was = pull;
    pull = null;
    if (!was.on) return;
    e.preventDefault();   // the end of a pull isn't a tap on what it started on
    const at = offset(), [t0, y0] = was.trail[0], [t1, y1] = was.trail[was.trail.length - 1];
    const speed = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;
    if (e.type === "touchend" && (at > Math.min(64, proj.offsetHeight * 0.15) || speed > 0.11)) return dismiss(null, true);
    deck.style.translate = "";
    motion(deck, [{ translate: `0 ${at}px` }, { translate: "0 0" }], { duration: 400, easing: DRAWER });
  };
  layer.addEventListener("touchend", letGo, { passive: false });
  layer.addEventListener("touchcancel", letGo);
  // a click on the blurred site around the panel closes it too
  layer.addEventListener("click", (e) => { if (e.target === layer || e.target === deck) dismiss(e); });
  document.addEventListener("keydown", (e) => {
    if (!openSheet) return;
    if (e.key === "Escape") dismiss(e);
    if (e.target.closest("iframe")) return;
    if (e.key === "ArrowRight") location.hash = $("#proj-next").getAttribute("href");
    if (e.key === "ArrowLeft") location.hash = $("#proj-prev").getAttribute("href");
  });

  const route = () => {
    const m = location.hash.match(/^#\/(.+)$/);
    const p = m && bySlug.get(decodeURIComponent(m[1]));
    if (p) open(p);
    else close();
  };
  window.addEventListener("hashchange", route);

  /* ---------- The bar: which part of the page you're in ---------- */
  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));
  function lights() {
    let on = -1;
    sections.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= innerHeight * 0.5) on = i; });
    if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) on = sections.length - 1;
    navLinks.forEach((a, i) => a.classList.toggle("is-on", i === on));
  }

  onScroll();
  route();
  wake();
})();
