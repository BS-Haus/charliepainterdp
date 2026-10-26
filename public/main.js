(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PROJECTS = window.PROJECTS || [];
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));

  $$(".year").forEach((y) => { y.textContent = new Date().getFullYear(); });

  /* ======================================================================
     THE SWITCH — narrative or commercial first. Nothing is hidden: the two halves swap places
     ====================================================================== */
  const sw = $(".switch");
  const lens = $(".switch-lens", sw);
  const swButtons = $$("button", sw);
  const groupsEl = $("#groups");
  const work = $("#work");

  const placeLens = () => {
    const on = swButtons.find((b) => b.getAttribute("aria-checked") === "true");
    sw.style.setProperty("--lens-w", `${on.offsetWidth}px`);
    sw.style.setProperty("--lens-x", `${on.offsetLeft - 3}px`);
  };

  // Each half glides to its new place (measure, swap, then play the difference back)
  const putFirst = (group) => {
    const groups = $$(".group", groupsEl);
    if (groups[0].dataset.group === group) return;
    // if you're down the page, come back to the top of the work so you see the swap
    const top = work.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    if (window.scrollY > top + 4) window.scrollTo({ top, behavior: "auto" });
    const before = groups.map((g) => g.getBoundingClientRect().top);
    groupsEl.prepend(groups.find((g) => g.dataset.group === group));
    if (reduceMotion) return;
    groups.forEach((g, i) => {
      const dy = before[i] - g.getBoundingClientRect().top;
      if (dy) g.animate([{ transform: `translateY(${dy}px)`, opacity: 0.55 }, { transform: "none", opacity: 1 }], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  };

  swButtons.forEach((b) => b.addEventListener("click", () => {
    swButtons.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    placeLens();
    putFirst(b.dataset.first);
  }));
  placeLens();
  document.fonts?.ready.then(placeLens);
  window.addEventListener("resize", placeLens);

  /* ======================================================================
     FRAMES — each film's frame holds all its stills: swipe (touch or trackpad), drag, or use the arrows.
     A plain click opens the film
     ====================================================================== */
  const reveal = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px" });

  $$(".tile").forEach((tile) => {
    // whatever's on the first screen is there from the start; the rest come up as you reach them
    if (tile.getBoundingClientRect().top < innerHeight) tile.classList.add("in");
    else reveal.observe(tile);
    let dragged = false;
    const slides = $(".slides", tile);
    if (slides) {
      const bars = $$(".tile-bars i", tile);
      const at = () => Math.round(slides.scrollLeft / slides.clientWidth);
      const go = (i) => slides.scrollTo({ left: Math.max(0, Math.min(slides.children.length - 1, i)) * slides.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
      slides.addEventListener("scroll", () => { const i = at(); bars.forEach((bar, j) => bar.classList.toggle("is-on", j === i)); }, { passive: true });
      $(".tile-prev", tile)?.addEventListener("click", (e) => { e.stopPropagation(); go(at() - 1); });
      $(".tile-next", tile)?.addEventListener("click", (e) => { e.stopPropagation(); go(at() + 1); });
      // drag with a mouse (touch already swipes natively)
      let drag = null;
      slides.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, left: slides.scrollLeft, moved: false };
        dragged = false;
      });
      window.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; slides.classList.add("is-dragging"); }
        if (drag.moved) slides.scrollLeft = drag.left - dx;
      });
      window.addEventListener("pointerup", () => {
        if (!drag) return;
        if (drag.moved) {
          dragged = true;
          const dir = slides.scrollLeft - drag.left;
          const i = Math.abs(dir) > slides.clientWidth * 0.15 ? (dir > 0 ? Math.ceil : Math.floor)(slides.scrollLeft / slides.clientWidth) : at();
          slides.classList.remove("is-dragging");
          go(i);
        }
        drag = null;
      });
    }
    tile.addEventListener("click", (e) => {
      if (dragged) { dragged = false; return; }
      if (e.target.closest(".tile-step")) return;
      e.preventDefault();
      location.hash = `#/${tile.dataset.slug}`;
    });
  });

  // The showreels play silently while they're on screen
  const reelObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduceMotion) v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.25 });
  $$(".tile-reel video").forEach((v) => reelObs.observe(v));

  /* ======================================================================
     PROJECT — slides up over the page. Every film has its own address (#/vetala), so it can be shared
     ====================================================================== */
  const proj = $("#proj"), scrollEl = $("#proj-scroll");
  const player = $("#proj-player"), titleEl = $("#proj-title"), credits = $("#proj-credits"), stills = $("#proj-stills");
  const posEl = $("#proj-pos"), prevEl = $("#proj-prev"), nextEl = $("#proj-next"), follow = $("#proj-follow");
  let openSlug = null, lastFocus = null, closeTimer = 0;

  // the running order is whatever the page shows now, so prev / next follow the switch
  const order = () => $$("#groups .tile").map((t) => t.dataset.slug);
  const embed = ({ provider, id, hash }) => provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const render = (p) => {
    const list = order(), i = list.indexOf(p.slug);
    const prev = bySlug.get(list[(i - 1 + list.length) % list.length]), next = bySlug.get(list[(i + 1) % list.length]);
    player.innerHTML = p.video
      ? `<div class="film"><iframe src="${embed(p.video)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(p.title)}"></iframe></div>`
      : `<img src="/media/stills/${p.stills[0]}.jpg" alt="${esc(p.title)}" />`;
    titleEl.textContent = p.title;
    const rows = [["Director", p.director], ["Production", p.production], [p.kind === "Showreel" ? "Showreel" : "Type", p.kind === "Showreel" ? p.note : p.kind]];
    if (p.note && p.kind !== "Showreel") rows.push(["With", p.note.replace(/^(Starring|Talent)\s+/i, "")]);
    credits.innerHTML = rows.filter((r) => r[1]).slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    stills.innerHTML = p.stills.map((s, j) => `<img src="/media/stills/${s}.jpg" alt="${esc(p.title)} — still ${j + 1}" loading="${j < 2 ? "eager" : "lazy"}" decoding="async" />`).join("");
    posEl.textContent = `${pad(i + 1)} / ${pad(list.length)}`;
    prevEl.href = `#/${prev.slug}`;
    nextEl.href = `#/${next.slug}`;
    follow.href = `#/${next.slug}`;
    $(".proj-follow-title", follow).textContent = next.title;
    scrollEl.scrollTop = 0;
  };

  const open = (slug) => {
    const p = bySlug.get(slug);
    if (!p) return close();
    clearTimeout(closeTimer);
    if (!openSlug) lastFocus = document.activeElement;
    openSlug = slug;
    render(p);
    $$(".tile-reel video").forEach((v) => v.pause());
    proj.hidden = false;
    document.body.classList.add("is-locked");
    requestAnimationFrame(() => requestAnimationFrame(() => proj.classList.add("is-open")));
    proj.focus({ preventScroll: true });   // the panel takes focus, so keys work without a ring on a click
    document.title = `${p.title} — Charlie Painter`;
  };

  const close = () => {
    if (!openSlug) return;
    openSlug = null;
    proj.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    document.title = "Charlie Painter — Director of Photography, London";
    closeTimer = setTimeout(() => { proj.hidden = true; player.innerHTML = ""; stills.innerHTML = ""; }, reduceMotion ? 0 : 650);
    lastFocus?.focus?.({ preventScroll: true });
  };

  const route = () => {
    const m = location.hash.match(/^#\/(.+)$/);
    if (m) open(decodeURIComponent(m[1]));
    else close();
  };
  window.addEventListener("hashchange", route);
  route();

  // back to the work without jumping the page: drop the film's address, keep where you were
  $(".proj-back", proj).addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState(null, "", location.pathname + location.search);
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (!openSlug) return;
    if (e.key === "Escape") $(".proj-back", proj).click();
    if (e.key === "ArrowRight" && !e.target.closest("iframe")) location.hash = nextEl.getAttribute("href");
    if (e.key === "ArrowLeft" && !e.target.closest("iframe")) location.hash = prevEl.getAttribute("href");
  });

  /* ---------- Header: which section you're in ---------- */
  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));
  const lights = () => {
    let on = 0;
    sections.forEach((el, k) => { if (el && el.getBoundingClientRect().top < innerHeight * 0.45) on = k; });
    if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) on = sections.length - 1;
    navLinks.forEach((a, k) => a.classList.toggle("is-on", k === on));
  };
  window.addEventListener("scroll", lights, { passive: true });
  lights();
})();
