(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Screen: big up top, docks bottom-left as you scroll ---------- */
  const REELS = {
    narrative: { n: "01", label: "Narrative", src: "/media/reel-narrative.mp4", poster: "/media/reel-narrative-poster.jpg", vimeo: "1149629056" },
    commercial: { n: "02", label: "Commercial", src: "/media/reel-commercial.mp4", poster: "/media/reel-commercial-poster.jpg", vimeo: "1188991301" },
  };
  let current = "narrative";
  const video = $("#reel-video");
  const tc = $("#tc");
  const screen = $("#screen");
  const slot = $("#screen-slot");
  const label = $("#screen-label");
  const framesEl = $("#screen-frames");
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const tick = () => {
    const t = video.currentTime || 0;
    tc.textContent = `01:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (reduceMotion) { video.removeAttribute("autoplay"); video.pause(); }

  // Docked size mirrors the CSS: --dock-w is clamp(260px, 23vw, 380px), --gutter is clamp(16px, 2.4vw, 36px)
  const canDock = window.matchMedia("(min-width: 861px)");
  const place = () => {
    const r = slot.getBoundingClientRect();
    let x = r.left, y = r.top, w = r.width, h = r.height, p = 0;
    if (canDock.matches) {
      const vw = window.innerWidth, gutter = clamp(vw * 0.024, 16, 36), dw = clamp(vw * 0.23, 260, 380), dh = dw / 2;
      p = clamp((64 - r.top) / (r.height * 0.7), 0, 1);
      const e = reduceMotion ? (p > 0.5 ? 1 : 0) : easeInOut(p);
      x = lerp(r.left, gutter, e);
      // hold just under the header while it shrinks, rather than sliding off the top
      y = lerp(Math.max(r.top, 64), window.innerHeight - gutter - dh, e);
      w = lerp(r.width, dw, e);
      h = lerp(r.height, dh, e);
    }
    screen.style.width = `${w}px`;
    screen.style.height = `${h}px`;
    screen.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    screen.classList.toggle("is-docked", p >= 1);
    $("#top").classList.toggle("is-compact", window.scrollY > 30);
  };
  let placing = false;
  const queuePlace = () => { if (!placing) { placing = true; requestAnimationFrame(() => { placing = false; place(); }); } };
  window.addEventListener("scroll", queuePlace, { passive: true });
  window.addEventListener("resize", queuePlace);
  place();

  // On phones the screen scrolls away with the page; stop it when it's gone
  new IntersectionObserver(([e]) => {
    if (reduceMotion || canDock.matches) return;
    e.isIntersecting ? video.play().catch(() => {}) : video.pause();
  }).observe(slot);

  // The screen plays whichever film you're hovering, otherwise the reel for the list you're in
  let showing = null, filmTimer = 0;
  const showFilm = (el, n) => {
    if (showing === el) return;
    showing = el;
    framesEl.innerHTML = el.dataset.stills.split(",").map((s) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async" />`).join("");
    const imgs = $$("img", framesEl);
    let i = 0;
    imgs[0].classList.add("on");
    clearInterval(filmTimer);
    if (!reduceMotion && imgs.length > 1) filmTimer = setInterval(() => { imgs[i].classList.remove("on"); i = (i + 1) % imgs.length; imgs[i].classList.add("on"); }, 650);
    label.textContent = `${n} · ${el.dataset.title}`;
    screen.classList.add("is-film");
  };
  const showReel = () => {
    showing = null;
    clearInterval(filmTimer);
    framesEl.innerHTML = "";
    label.textContent = `Reel ${REELS[current].n} · ${REELS[current].label}`;
    screen.classList.remove("is-film");
  };
  const setReel = (key) => {
    if (key === current) return;
    current = key;
    video.poster = REELS[key].poster;
    video.src = REELS[key].src;
    if (!reduceMotion) video.play().catch(() => {});
    if (!showing) showReel();
  };

  /* ---------- Lightbox: films and frames ---------- */
  const lb = $("#lb");
  const stage = $("#lb-stage");
  const title = $("#lb-title");
  const count = $("#lb-count");
  const prev = $("#lb-prev");
  const next = $("#lb-next");
  const filmBtn = $("#lb-film");
  let job = null;
  let frames = [];
  let idx = 0;
  let lastFocus = null;

  const embed = ({ provider, id, hash }) =>
    provider === "youtube"
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Film"></iframe>`
      : `<iframe src="https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Film"></iframe>`;

  const show = () => { lb.hidden = false; document.body.style.overflow = "hidden"; video.pause(); requestAnimationFrame(() => lb.classList.add("is-open")); $("#lb-close").focus(); };

  const openFilm = (data, label) => {
    stage.innerHTML = `<div class="film">${embed(data)}</div>`;
    title.textContent = label;
    count.textContent = "";
    prev.hidden = next.hidden = true;
    filmBtn.hidden = true;
  };

  const showFrame = () => {
    stage.innerHTML = `<img src="/media/stills/${frames[idx]}.jpg" alt="Frame ${idx + 1} from ${job.dataset.title}" />`;
    count.textContent = `Frame ${pad(idx + 1)} / ${pad(frames.length)}`;
    prev.hidden = next.hidden = frames.length < 2;
  };

  const openFrames = (li, start = 0) => {
    job = li;
    frames = li.dataset.stills.split(",");
    idx = start;
    title.textContent = li.dataset.title;
    filmBtn.hidden = !li.dataset.id;
    showFrame();
  };

  const open = (li, frameIndex) => {
    lastFocus = document.activeElement;
    if (frameIndex == null && li.dataset.id) {
      job = li;
      openFilm(li.dataset, li.dataset.title);
    } else {
      openFrames(li, frameIndex || 0);
    }
    show();
  };

  window.cpOpen = (el, i) => open(el, i);

  const close = () => {
    lb.classList.remove("is-open");
    lb.hidden = true;
    stage.innerHTML = "";
    document.body.style.overflow = "";
    if (!reduceMotion) video.play().catch(() => {});
    lastFocus?.focus();
  };

  const step = (d) => { idx = (idx + d + frames.length) % frames.length; showFrame(); };
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  filmBtn.addEventListener("click", () => openFilm(job.dataset, job.dataset.title));
  $("#lb-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && !next.hidden) step(1);
    if (e.key === "ArrowLeft" && !prev.hidden) step(-1);
  });

  screen.addEventListener("click", (e) => {
    if (e.target.closest("#reel-sound")) return;
    if (showing) open(showing, null);
    else $("#reel-sound").click();
  });

  $("#reel-sound").addEventListener("click", () => {
    lastFocus = document.activeElement;
    job = null;
    openFilm({ provider: "vimeo", id: REELS[current].vimeo }, `${REELS[current].label} showreel`);
    show();
  });

  /* ---------- Work: one film open at a time, every frame on show ---------- */
  const workEl = $("#work");
  const rows = $$(".rl", workEl);
  const canHover = window.matchMedia("(hover: hover)").matches;
  let openRow = null, hoverTimer = 0;

  const flickTo = (row, i) => {
    const imgs = $$(".rl-stage img", row), thumbs = $$(".rl-thumb", row);
    row._i = Math.max(0, Math.min(imgs.length - 1, i));
    imgs.forEach((im, k) => im.classList.toggle("on", k === row._i));
    thumbs.forEach((t, k) => t.classList.toggle("on", k === row._i));
    $(".rl-i", row).textContent = pad(row._i + 1);
    $(".rl-scrub span", row).style.transform = `scaleX(${(row._i + 1) / imgs.length})`;
  };

  const expand = (row) => {
    if (row === openRow) return;
    if (openRow) { openRow.classList.remove("is-open"); $(".rl-head", openRow).setAttribute("aria-expanded", "false"); }
    openRow = row;
    row.classList.add("is-open");
    $(".rl-head", row).setAttribute("aria-expanded", "true");
    flickTo(row, 0);
  };

  rows.forEach((row) => {
    const head = $(".rl-head", row);
    const n = $(".rl-n", row).textContent;
    head.addEventListener("mouseenter", () => showFilm(row, n));
    head.addEventListener("focus", () => showFilm(row, n));
    const stage = $(".rl-stage", row);
    const count = $$(".rl-stage img", row).length;
    if (canHover) {
      // a short dwell so sweeping the mouse down the list doesn't open every film on the way
      head.addEventListener("mouseenter", () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => expand(row), 160); });
      head.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
    }
    head.addEventListener("click", () => (row === openRow && row.dataset.id ? open(row, null) : expand(row)));
    head.addEventListener("focus", () => expand(row));
    // Sweep across the main frame to flick through the film
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      flickTo(row, Math.floor(((e.clientX - r.left) / r.width) * count));
    });
    stage.addEventListener("click", () => open(row, row._i || 0));
    $$(".rl-thumb", row).forEach((t) => {
      const i = Number(t.dataset.i);
      t.addEventListener("mouseenter", () => flickTo(row, i));
      t.addEventListener("focus", () => flickTo(row, i));
      t.addEventListener("click", () => (canHover ? open(row, i) : flickTo(row, i)));
    });
    $(".rl-frames", row).addEventListener("click", () => open(row, row._i || 0));
    $(".rl-play", row)?.addEventListener("click", () => open(row, null));
  });
  expand(rows[0]);
  $$(".rl-list", workEl).forEach((list) => list.addEventListener("mouseleave", showReel));

  // Reach the commercial list and the screen switches to the commercial reel
  const lists = $$(".rl-list", workEl);
  new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) setReel(e.target === lists[1] ? "commercial" : "narrative");
  }), { rootMargin: "-45% 0px -45% 0px" }).observe(lists[0]);
  new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) setReel("commercial");
    else if (e.boundingClientRect.top > 0) setReel("narrative");
  }), { rootMargin: "-45% 0px -45% 0px" }).observe(lists[1]);

  /* ---------- Quiet reveals ---------- */
  const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
  }), { threshold: 0.1 });
  $$(".also-col, .about-line, .about-grid, .contact-grid").forEach((el) => { el.classList.add("rv"); obs.observe(el); });
})();
