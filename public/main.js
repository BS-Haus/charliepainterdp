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

  $$(".job").forEach((li) => {
    li.addEventListener("click", (e) => {
      const f = e.target.closest(".frame");
      open(li, f ? Number(f.dataset.i) : null);
    });
  });

  $("#reel-sound").addEventListener("click", () => {
    lastFocus = document.activeElement;
    job = null;
    openFilm({ provider: "vimeo", id: REELS[current].vimeo }, REELS[current].caption);
    show();
  });

  /* ---------- Quiet reveals ---------- */
  const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
  }), { threshold: 0.1 });
  $$(".archive-head, .job, .more li, .about-line, .about-grid, .contact-grid").forEach((el) => { el.classList.add("rv"); obs.observe(el); });
})();
