(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Reel: narrative / commercial, with a running timecode ---------- */
  const REELS = {
    narrative: { n: "01", label: "Narrative", caption: "Narrative showreel", src: "/media/reel-narrative.mp4", poster: "/media/reel-narrative-poster.jpg", vimeo: "1149629056" },
    commercial: { n: "02", label: "Commercial", caption: "Commercial showreel", src: "/media/reel-commercial.mp4", poster: "/media/reel-commercial-poster.jpg", vimeo: "1188991301" },
  };
  let current = "narrative";
  const video = $("#reel-video");
  const tc = $("#tc");
  const pauseBtn = $("#reel-pause");

  const setReel = (key) => {
    if (key === current) return;
    current = key;
    const r = REELS[key];
    video.poster = r.poster;
    video.src = r.src;
    if (!reduceMotion) video.play().catch(() => {});
    $("#reel-caption").textContent = r.caption;
    $("#top-reel").textContent = `Reel ${r.n} · ${r.label}`;
    $$("[data-reel]").forEach((b) => {
      const on = b.dataset.reel === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    setPaused(false);
  };
  $$("[data-reel]").forEach((b) => b.addEventListener("click", () => setReel(b.dataset.reel)));

  const setPaused = (paused) => {
    paused ? video.pause() : video.play().catch(() => {});
    pauseBtn.textContent = paused ? "Play" : "Pause";
    pauseBtn.setAttribute("aria-pressed", String(paused));
  };
  pauseBtn.addEventListener("click", () => setPaused(!video.paused));

  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const t = video.currentTime || 0;
    tc.textContent = `01:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (reduceMotion) { video.removeAttribute("autoplay"); setPaused(true); }

  // Pause the reel while it's off screen
  new IntersectionObserver(([e]) => {
    if (pauseBtn.getAttribute("aria-pressed") === "true") return;
    e.isIntersecting ? video.play().catch(() => {}) : video.pause();
  }).observe(video);

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
    if (pauseBtn.getAttribute("aria-pressed") !== "true") video.play().catch(() => {});
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

  $("#reel-sound").addEventListener("click", () => {
    lastFocus = document.activeElement;
    job = null;
    openFilm({ provider: "vimeo", id: REELS[current].vimeo }, REELS[current].caption);
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

  /* ---------- Black or white canvas ---------- */
  const themeBtn = $("#theme");
  const applyTheme = (t) => {
    if (t === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    $("span", themeBtn).textContent = t === "light" ? "Dark" : "Light";
    themeBtn.setAttribute("aria-label", `Switch to ${t === "light" ? "dark" : "light"} background`);
    try { localStorage.setItem("cp-theme", t); } catch (e) {}
  };
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  themeBtn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));

  /* ---------- Logo only once the big name has left the screen ---------- */
  const logo = $("#logo");
  new IntersectionObserver(([e]) => logo.classList.toggle("is-hidden", e.isIntersecting)).observe($(".name"));

  /* ---------- Quiet reveals ---------- */
  const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
  }), { threshold: 0.1 });
  $$(".also-col, .about-line, .about-grid, .contact-grid").forEach((el) => { el.classList.add("rv"); obs.observe(el); });
})();
