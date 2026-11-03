(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  const place = () => {
    const on = opts.find((o) => o.getAttribute("aria-checked") === "true");
    thumb.style.setProperty("--tw", `${on.offsetWidth}px`);
    thumb.style.setProperty("--tx", `${on.offsetLeft}px`);
  };
  const choose = (group) => {
    const was = groups.find((g) => !g.hidden), next = groups.find((g) => g.dataset.group === group);
    opts.forEach((o) => o.setAttribute("aria-checked", String(o.dataset.group === group)));
    place();
    if (was === next) return;
    // if you're down in the work, come back to its top so you see the change
    const workTop = work.getBoundingClientRect().top + window.scrollY - bar.offsetHeight;
    if (window.scrollY > workTop + 4) window.scrollTo({ top: workTop, behavior: "instant" });
    const y = window.scrollY;
    was.hidden = true;
    next.hidden = false;
    // the browser would keep a frame from the half that's gone in view (scroll anchoring); stay where you were
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: "instant" });
    $$(".tile", next).forEach((tile) => tile.classList.add("in"));
    if (!reduceMotion) next.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" });
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
     FRAMES — they come up as you reach them; click one and its film opens
     ====================================================================== */
  const reveal = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px" });

  $$(".tile").forEach((tile) => {
    if (tile.getBoundingClientRect().top < innerHeight) tile.classList.add("in");
    else reveal.observe(tile);
    tile.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = `#/${tile.dataset.slug}`;
    });
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
        e.target.style.setProperty("--rv-delay", `${Math.min(i, 14) * 55}ms`);
        e.target.classList.add("in");
        arrive.unobserve(e.target);
      });
  }, { rootMargin: "0px 0px -8% 0px" });
  if (!reduceMotion) reveals.forEach(([el, kind]) => { el.classList.add(kind); arrive.observe(el); });

  /* ======================================================================
     THE FILM — a layer over the site. Each film has its own address (#/vetala), so the back button closes it and a
     film can be sent on its own
     ====================================================================== */
  const scrim = $("#scrim"), proj = $("#proj");
  let lastFocus = null, closeTimer = 0;
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
    $("#proj-player").innerHTML = p.video
      ? `<div class="film"><iframe src="${embed(p.video)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(p.title)}"></iframe></div>`
      : `<img src="/media/stills/${p.stills[0]}.jpg" alt="${esc(p.title)}" />`;
    $("#proj-player iframe")?.addEventListener("load", (e) => e.target.classList.add("is-ready"), { once: true });
    $("#proj-title").textContent = p.title;
    // what it won, where it has something, says more than what kind of film it is
    const rows = [["Director", p.director], ["Production", p.production], p.accolade ? ["Award", p.accolade] : ["Type", KINDS[p.kind] || p.kind]];
    if (p.note) rows.push(["With", p.note.replace(/^(Starring|Talent)\s+/i, "")]);
    $("#proj-credits").innerHTML = rows.filter((r) => r[1]).slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $("#proj-stills").innerHTML = p.stills.map((s, j) => `<img src="/media/stills/${s}.jpg" alt="${esc(p.title)} — still ${j + 1}" loading="${j < 2 ? "eager" : "lazy"}" decoding="async" />`).join("");
    $("#proj-pos").textContent = `${pad(i + 1)} / ${pad(list.length)}`;
    $("#proj-prev").href = `#/${prev.slug}`;
    $("#proj-next").href = `#/${next.slug}`;
    const follow = $("#proj-follow");
    follow.href = `#/${next.slug}`;
    $(".proj-follow-title", follow).textContent = next.title;
    $("#proj-scroll").scrollTop = 0;
    document.title = `${p.title} — Charlie Painter`;
  };

  const open = (p) => {
    renderFilm(p);
    clearTimeout(closeTimer);
    if (!openSheet) lastFocus = document.activeElement;
    openSheet = proj;
    proj.hidden = false;
    scrim.classList.add("is-on");
    document.body.classList.add("is-locked");
    wake();
    requestAnimationFrame(() => requestAnimationFrame(() => proj.classList.add("is-open")));
    proj.focus({ preventScroll: true });
  };
  const close = () => {
    if (!openSheet) return;
    openSheet = null;
    proj.classList.remove("is-open");
    scrim.classList.remove("is-on");
    document.body.classList.remove("is-locked");
    document.title = "Charlie Painter — Director of Photography, London";
    closeTimer = setTimeout(() => { proj.hidden = true; $("#proj-player").innerHTML = ""; $("#proj-stills").innerHTML = ""; }, reduceMotion ? 0 : 600);
    wake();
    lastFocus?.focus?.({ preventScroll: true });
  };
  // closing drops the film's address without moving the page
  const dismiss = (e) => { e?.preventDefault(); history.pushState(null, "", location.pathname + location.search); close(); };
  $(".proj-back").addEventListener("click", dismiss);
  scrim.addEventListener("click", dismiss);
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
