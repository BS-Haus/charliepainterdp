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

  /* ---------- Work: tabs, three views, and the index monitor ---------- */
  const work = $("#work");
  const filmIn = (panel, t) => panel.querySelector(`.ix-item[data-title="${CSS.escape(t)}"]`);
  const canHover = window.matchMedia("(hover: hover)").matches;
  let view = "index";
  try { view = localStorage.getItem("cp-view") || "index"; } catch (e) {}

  const tint = (el) => work.style.setProperty("--tint", el?.dataset.tint || "#11110f");

  // Monitor: steps through the active film's frames like a slow slideshow
  const monitors = new Map();
  const setActive = (panel, item) => {
    const m = monitors.get(panel);
    if (!m || m.item === item) return;
    m.item = item;
    $$(".ix-item", panel).forEach((li) => li.classList.toggle("is-active", li === item));
    const stills = item.dataset.stills.split(",");
    m.screen.innerHTML = stills.map((s) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async" />`).join("");
    m.frames = $$("img", m.screen);
    m.i = 0;
    m.frames[0].classList.add("on");
    $(".monitor-title", panel).textContent = item.dataset.title;
    $(".monitor-credit", panel).textContent = [item.dataset.kind, item.dataset.credit].filter(Boolean).join(" · ");
    $(".m-play", panel).hidden = !item.dataset.id;
    tint(item);
  };
  setInterval(() => {
    if (reduceMotion) return;
    monitors.forEach((m) => {
      if (!m.frames || m.frames.length < 2 || m.panel.hidden) return;
      m.frames[m.i].classList.remove("on");
      m.i = (m.i + 1) % m.frames.length;
      m.frames[m.i].classList.add("on");
    });
  }, 1600);

  $$(".panel").forEach((panel) => {
    const m = { panel, screen: $(".monitor-screen", panel), item: null };
    monitors.set(panel, m);
    const items = $$(".ix-item", panel);
    items.forEach((li) => {
      if (canHover) li.addEventListener("mouseenter", () => setActive(panel, li));
      $(".ix-btn", li).addEventListener("focus", () => setActive(panel, li));
      $(".ix-btn", li).addEventListener("click", () => {
        // Touch: the first tap shows the film in the monitor, the second opens it
        if (!canHover && m.item !== li) return setActive(panel, li);
        open(li, null);
      });
    });
    setActive(panel, items[0]);
    $(".m-play", panel).addEventListener("click", () => open(m.item, null));
    $(".m-frames", panel).addEventListener("click", () => open(m.item, m.i || 0));
    m.screen.addEventListener("click", () => open(m.item, m.i || 0));

    // Contact sheet: hovering a frame lifts the rest of that film
    const sheet = $(".sheet", panel);
    $$(".sh-cell", panel).forEach((cell) => {
      cell.addEventListener("mouseenter", () => {
        $$(".sh-cell", sheet).forEach((c) => c.classList.toggle("is-film", c.dataset.film === cell.dataset.film));
        tint(filmIn(panel, cell.dataset.film));
      });
      cell.addEventListener("click", () => open(filmIn(panel, cell.dataset.film), Number(cell.dataset.i)));
    });
    sheet.addEventListener("mouseleave", () => $$(".sh-cell", sheet).forEach((c) => c.classList.remove("is-film")));

    // Screening: cards tint the room as they come into view; arrows step one film
    const track = $(".sc-track", panel);
    const cards = $$(".sc-card", panel);
    cards.forEach((card) => $(".sc-btn", card).addEventListener("click", () => { if (!dragged) open(card, null); }));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting && view === "screen") tint(e.target); }), { root: track, threshold: 0.6 });
    cards.forEach((c) => io.observe(c));
    const stepBy = (d) => track.scrollBy({ left: d * (cards[0].offsetWidth + 14), behavior: reduceMotion ? "auto" : "smooth" });
    $(".sc-prev", panel).addEventListener("click", () => stepBy(-1));
    $(".sc-next", panel).addEventListener("click", () => stepBy(1));
    let dragged = false, startX = 0, startLeft = 0, down = false;
    track.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; dragged = false; startX = e.clientX; startLeft = track.scrollLeft; track.style.scrollSnapType = "none"; });
    window.addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - startX; if (Math.abs(dx) > 4) dragged = true; track.scrollLeft = startLeft - dx; });
    window.addEventListener("pointerup", () => { if (!down) return; down = false; track.style.scrollSnapType = ""; setTimeout(() => (dragged = false), 0); });
  });

  const activePanel = () => $(".panel:not([hidden])");
  const setView = (v) => {
    view = v;
    try { localStorage.setItem("cp-view", v); } catch (e) {}
    $$(".view").forEach((b) => { const on = b.dataset.view === v; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    $$(".panel").forEach((p) => {
      $(".v-index", p).hidden = v !== "index";
      $(".v-sheet", p).hidden = v !== "sheet";
      $(".v-screen", p).hidden = v !== "screen";
    });
    const p = activePanel();
    tint(v === "index" ? monitors.get(p).item : v === "screen" ? $(".sc-card", p) : null);
  };
  $$(".view").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => { const on = x === t; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", String(on)); });
    $$(".panel").forEach((p) => (p.hidden = p.dataset.set !== t.dataset.tab));
    setView(view);
  }));
  setView(view);

  /* ---------- Logo only once the big name has left the screen ---------- */
  const logo = $("#logo");
  new IntersectionObserver(([e]) => logo.classList.toggle("is-hidden", e.isIntersecting)).observe($(".name"));

  /* ---------- Quiet reveals ---------- */
  const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
  }), { threshold: 0.1 });
  $$(".work-bar, .about-line, .about-grid, .contact-grid").forEach((el) => { el.classList.add("rv"); obs.observe(el); });
})();
