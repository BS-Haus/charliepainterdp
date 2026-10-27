(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PROJECTS = window.PROJECTS || [];
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  const REEL_OF = { narrative: "narrativeshowreel", commercial: "commercial-showreel" };

  $$(".year").forEach((y) => { y.textContent = new Date().getFullYear(); });

  const hero = $(".hero"), heroReel = $("#hero-reel"), heroWatch = $("#hero-watch"), heroWatchTitle = $("#hero-watch-title");
  const work = $("#work"), groupsEl = $("#groups"), bar = $("#bar");
  let openSheet = null;

  /* ---------- The intro plays once per visit (the page marks it before anything paints) ---------- */
  if (document.documentElement.classList.contains("intro")) {
    setTimeout(() => {
      document.documentElement.classList.remove("intro");
      try { sessionStorage.setItem("cp-intro", "1"); } catch (e) {}
    }, 4300);
  }

  /* ---------- The name, edge to edge: sized to the width once its face has loaded ---------- */
  const heroName = $("#hero-name"), nameIn = $(".hero-name-in", heroName);
  const fitName = () => {
    heroName.style.fontSize = "100px";
    heroName.style.fontSize = `${(100 * heroName.clientWidth) / nameIn.offsetWidth}px`;
    heroName.classList.add("is-fit");
  };
  document.fonts.ready.then(fitName);
  document.fonts.addEventListener("loadingdone", fitName);
  setTimeout(fitName, 2500);   // whatever happens with the fonts, show the name
  window.addEventListener("resize", fitName);

  /* ======================================================================
     THE REEL AND THE BAR — the page slides up over the pinned reel, which dims and then stops. The bar on the page's top
     edge rides up with it; when it reaches the top it stays as the header and the small name joins it
     ====================================================================== */
  let covered = false;
  const onScroll = () => {
    const span = hero.offsetHeight - bar.offsetHeight;
    const c = clamp(window.scrollY / (span || 1), 0, 1);
    hero.style.setProperty("--cover", c.toFixed(3));
    bar.classList.toggle("is-top", bar.getBoundingClientRect().top <= 0.5);
    if ((c >= 0.999) !== covered) {
      covered = c >= 0.999;
      if (covered) heroReel.pause();
      else if (!reduceMotion && !openSheet) heroReel.play().catch(() => {});
    }
    lights();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ======================================================================
     THE KEYS — narrative or commercial first. Nothing is hidden: the halves swap places, and the reel behind the work
     becomes that half's reel
     ====================================================================== */
  const keys = $$(".key");
  const putFirst = (group) => {
    const groups = $$(".group", groupsEl);
    if (groups[0].dataset.group === group) return;
    // if you're down in the work, come back to its top so you see the swap
    const workTop = work.getBoundingClientRect().top + window.scrollY - bar.offsetHeight;
    if (window.scrollY > workTop + 4) window.scrollTo({ top: workTop, behavior: "instant" });
    const y = window.scrollY, before = groups.map((g) => g.getBoundingClientRect().top);
    groupsEl.prepend(groups.find((g) => g.dataset.group === group));
    // the browser would keep the frame you were looking at in view (scroll anchoring); stay at the top of the work
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: "instant" });
    if (reduceMotion) return;
    groups.forEach((g, i) => {
      const dy = before[i] - g.getBoundingClientRect().top;
      if (dy) g.animate([{ transform: `translateY(${dy}px)`, opacity: 0.5 }, { transform: "none", opacity: 1 }], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  };
  const swapReel = (group) => {
    const src = heroReel.dataset[group], poster = heroReel.dataset[`poster${group[0].toUpperCase()}${group.slice(1)}`];
    if (heroReel.getAttribute("src") === src) return;
    const p = bySlug.get(REEL_OF[group]);
    heroWatch.href = `#/${p.slug}`;
    heroWatchTitle.textContent = p.title;
    heroReel.classList.add("is-swapping");
    setTimeout(() => {
      heroReel.poster = poster;
      heroReel.src = src;
      if (!reduceMotion && !covered) heroReel.play().catch(() => {});
      heroReel.classList.remove("is-swapping");
    }, reduceMotion ? 0 : 450);
  };
  const choose = (group) => {
    keys.forEach((k) => k.setAttribute("aria-checked", String(k.dataset.first === group)));
    putFirst(group);
    swapReel(group);
  };
  keys.forEach((k) => k.addEventListener("click", () => choose(k.dataset.first)));
  $(".keys").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); choose("commercial"); $('[data-first="commercial"]').focus(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); choose("narrative"); $('[data-first="narrative"]').focus(); }
  });

  /* ======================================================================
     FRAMES — each film's frame holds all its stills: swipe (touch or trackpad), drag, or the arrows by the counter.
     A plain click opens the film
     ====================================================================== */
  const reveal = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); reveal.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px" });

  $$(".tile").forEach((tile) => {
    if (tile.getBoundingClientRect().top < innerHeight) tile.classList.add("in");
    else reveal.observe(tile);
    let dragged = false;
    const slides = $(".slides", tile);
    if (slides) {
      const n = $(".tile-n", tile);
      const at = () => Math.round(slides.scrollLeft / slides.clientWidth);
      const go = (i) => slides.scrollTo({ left: clamp(i, 0, slides.children.length - 1) * slides.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
      slides.addEventListener("scroll", () => { if (n) n.textContent = pad(at() + 1); }, { passive: true });
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

  /* ======================================================================
     CV AND CONTACT — they come up like a focus pull: the rules draw across and the type comes into focus, top to bottom.
     Whatever arrives together is staggered in reading order
     ====================================================================== */
  const reveals = [
    ...$$(".cv .sec-head, .contact .sec-head, .cv-block").map((el) => [el, "rv-rule"]),
    ...$$(".sec-title, .about, .mail").map((el) => [el, "rv-wipe"]),
    ...$$(".sec-head .label, .cv-block h3, .cv-list li, .links a").map((el) => [el, "rv"]),
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
     THE FILM — slides up from the bottom. Each film has its own address (#/vetala), so the back button closes it and a
     film can be sent on its own
     ====================================================================== */
  const scrim = $("#scrim"), proj = $("#proj");
  let lastFocus = null, closeTimer = 0;
  const order = () => $$("#groups .tile").map((t) => t.dataset.slug);   // follows the keys
  const embed = ({ provider, id, hash }) => provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1&transparent=0`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const renderFilm = (p) => {
    const list = order(), i = list.indexOf(p.slug);
    // a showreel isn't in the grid: it leads into the first film
    const prev = bySlug.get(list[i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length]);
    const next = bySlug.get(list[i < 0 ? 0 : (i + 1) % list.length]);
    $("#proj-player").innerHTML = p.video
      ? `<div class="film"><iframe src="${embed(p.video)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${esc(p.title)}"></iframe></div>`
      : `<img src="/media/stills/${p.stills[0]}.jpg" alt="${esc(p.title)}" />`;
    $("#proj-player iframe")?.addEventListener("load", (e) => e.target.classList.add("is-ready"), { once: true });
    $("#proj-title").textContent = p.title;
    const rows = [["Director", p.director], ["Production", p.production], [p.kind === "Showreel" ? "Showreel" : "Type", p.kind === "Showreel" ? p.note : p.kind]];
    if (p.note && p.kind !== "Showreel") rows.push(["With", p.note.replace(/^(Starring|Talent)\s+/i, "")]);
    $("#proj-credits").innerHTML = rows.filter((r) => r[1]).slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $("#proj-stills").innerHTML = p.stills.map((s, j) => `<img src="/media/stills/${s}.jpg" alt="${esc(p.title)} — still ${j + 1}" loading="${j < 2 ? "eager" : "lazy"}" decoding="async" />`).join("");
    $("#proj-pos").textContent = i < 0 ? "Showreel" : `${pad(i + 1)} / ${pad(list.length)}`;
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
    heroReel.pause();
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
    closeTimer = setTimeout(() => { proj.hidden = true; $("#proj-player").innerHTML = ""; $("#proj-stills").innerHTML = ""; }, reduceMotion ? 0 : 650);
    if (!reduceMotion && !covered) heroReel.play().catch(() => {});
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
})();
