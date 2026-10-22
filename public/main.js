(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;

  $("#year").textContent = new Date().getFullYear();

  const REELS = {
    narrative: { n: "01", label: "Narrative", title: "Narrative showreel", src: "/media/reel-narrative-v2.mp4", poster: "/media/reel-narrative-v2-poster.jpg", vimeo: "1149629056" },
    commercial: { n: "02", label: "Commercial", title: "Commercial showreel", src: "/media/reel-commercial-v2.mp4", poster: "/media/reel-commercial-v2-poster.jpg", vimeo: "1188991301" },
  };

  const monitor = $(".monitor");
  const video = $("#reel-video");
  const vf = $("#vf");
  const vfFrames = $("#vf-frames");
  const vfLabel = $("#vf-label");
  const tc = $("#tc");
  const index = $("#scale-index");
  const rows = $$(".row");
  const byN = Object.fromEntries(rows.map((r) => [r.dataset.n, r]));
  const clips = $$(".clip");
  const tl = $("#tl");
  const playhead = $("#playhead");

  let reel = "narrative";
  let film = null;      // the film on the program monitor, or null for the reel
  let source = null;    // the film loaded in the source panel
  let frame = 0;
  let cycle = 0;

  /* ---------- Program monitor: the reel, with timecode, scale and playhead ---------- */
  const setIndex = (p) => (index.style.transform = `translateX(${Math.max(0, Math.min(1, p)) * (index.parentElement.clientWidth - 1)}px)`);

  const placePlayhead = (p) => {
    const track = $(`.track[data-set="${reel}"] .clips`, tl);
    const t = tl.getBoundingClientRect(), r = track.getBoundingClientRect();
    playhead.style.transform = `translateX(${r.left - t.left + Math.max(0, Math.min(1, p)) * r.width}px)`;
  };

  const tick = () => {
    if (!film) {
      const t = video.currentTime || 0;
      tc.textContent = `01:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
      if (video.duration) { setIndex(t / video.duration); placePlayhead(t / video.duration); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (reduceMotion) { video.removeAttribute("autoplay"); video.pause(); }

  const showReel = () => {
    film = null;
    clearInterval(cycle);
    monitor.classList.remove("is-film");
    vfFrames.innerHTML = "";
    rows.forEach((r) => r.classList.remove("is-on"));
    clips.forEach((c) => c.classList.remove("is-on"));
    $$(".shot.is-on").forEach((s) => s.classList.remove("is-on"));
    vfLabel.textContent = `Reel ${REELS[reel].n} — ${REELS[reel].label}`;
    if (!reduceMotion) video.play().catch(() => {});
  };

  const setReel = (key) => {
    if (key === reel) return;
    reel = key;
    video.poster = REELS[key].poster;
    video.src = REELS[key].src;
    if (!film) showReel();
  };

  /* ---------- Source panel: the film you're on, frame by frame ---------- */
  const srcView = $("#src-view");
  const srcGrid = $("#src-grid");

  const loadSource = (row) => {
    if (row === source) return;
    source = row;
    const stills = row.dataset.stills.split(",");
    srcView.innerHTML = stills.map((s) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async" />`).join("");
    srcGrid.innerHTML = stills.map((s, k) => `<button data-i="${k}" aria-label="Frame ${k + 1}"><img src="/media/thumbs/${s}.jpg" alt="" decoding="async" /></button>`).join("");
    $$("button", srcGrid).forEach((b) => {
      const k = Number(b.dataset.i);
      b.addEventListener("mouseenter", () => { clearInterval(cycle); showFrame(k); });
      b.addEventListener("click", () => openRow(row, k));
    });
    $("#src-n").textContent = `${row.dataset.n} — ${row.dataset.kind}`;
    $("#src-title").textContent = row.dataset.title;
    $("#src-credit").textContent = row.dataset.credit;
    $("#src-play").textContent = row.dataset.id ? "Play film ↗" : "View frames ↗";
  };

  // One frame index drives the monitor, the source panel and the row's shots together
  const showFrame = (i) => {
    const n = source ? source.dataset.stills.split(",").length : 0;
    if (!n) return;
    frame = (i + n) % n;
    $$("img", vfFrames).forEach((im, k) => im.classList.toggle("on", k === frame));
    $$("img", srcView).forEach((im, k) => im.classList.toggle("on", k === frame));
    $$("button", srcGrid).forEach((b, k) => b.classList.toggle("is-on", k === frame));
    if (film) $$(".shot", film).forEach((s, k) => s.classList.toggle("is-on", k === frame));
    $("#src-count").textContent = `${pad(frame + 1)} / ${pad(n)}`;
    if (film) setIndex((frame + 1) / n);
  };

  const startCycle = () => {
    clearInterval(cycle);
    if (!reduceMotion && source && source.dataset.stills.split(",").length > 1) cycle = setInterval(() => showFrame(frame + 1), 750);
  };

  function showFilm(row, at = null) {
    if (row !== film) {
      film = row;
      video.pause();
      loadSource(row);
      rows.forEach((r) => r.classList.toggle("is-on", r === row));
      clips.forEach((c) => c.classList.toggle("is-on", c.dataset.n === row.dataset.n));
      vfFrames.innerHTML = row.dataset.stills.split(",").map((s) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async" />`).join("");
      monitor.classList.add("is-film");
      vfLabel.textContent = `${row.dataset.n} — ${row.dataset.title}`;
      showFrame(at ?? 0);
      if (at == null) startCycle();
    } else if (at != null) {
      clearInterval(cycle);
      showFrame(at);
    }
  }

  // Leaving the films (and not heading into the source panel) hands the monitor back to the reel
  let revert = 0;
  const later = () => { clearTimeout(revert); revert = setTimeout(showReel, 260); };
  const stay = () => clearTimeout(revert);

  rows.forEach((row) => {
    if (canHover) {
      row.addEventListener("mouseenter", () => { stay(); showFilm(row); });
      $$(".shot", row).forEach((s) => s.addEventListener("mouseenter", () => showFilm(row, Number(s.dataset.i))));
      row.addEventListener("mouseleave", () => { if (film === row) startCycle(); });
    }
    $(".row-open", row).addEventListener("focus", () => showFilm(row));
    row.addEventListener("click", (e) => {
      const shot = e.target.closest(".shot");
      // Touch: the first tap puts the film up, the next opens it
      if (!canHover && film !== row) return showFilm(row, shot ? Number(shot.dataset.i) : null);
      openRow(row, shot ? Number(shot.dataset.i) : null);
    });
  });

  clips.forEach((c) => {
    const row = byN[c.dataset.n];
    c.addEventListener("mouseenter", () => { stay(); showFilm(row); });
    c.addEventListener("focus", () => showFilm(row));
    c.addEventListener("click", () => openRow(row, null));
  });

  $$(".rows, .clips").forEach((el) => el.addEventListener("mouseleave", later));
  $(".source").addEventListener("mouseenter", stay);
  $(".source").addEventListener("mouseleave", () => { if (film) later(); });

  srcView.addEventListener("click", () => source && openRow(source, frame));
  $("#src-play").addEventListener("click", () => source && openRow(source, source.dataset.id ? null : frame));
  const playMonitor = () => (film ? openRow(film, film.dataset.id ? null : frame) : openReel());
  vf.addEventListener("click", playMonitor);
  vf.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playMonitor(); } });
  $("#vf-play").addEventListener("click", playMonitor);

  /* ---------- Bin tabs: switch the list, and the reel with it ---------- */
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => { const on = x === t; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", String(on)); });
    $$(".rows").forEach((l) => (l.hidden = l.dataset.set !== t.dataset.tab));
    setReel(t.dataset.tab);
  }));

  loadSource(rows[0]);
  showFrame(0);
  showReel();

  /* ---------- Intro, then the panels draw themselves in ---------- */
  const intro = $("#intro");
  const panels = $$(".panel");
  const revealObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
  }), { threshold: 0.08 });
  const startSuite = () => {
    document.body.classList.remove("is-intro");
    // the first screen arrives in sequence; the rest as you scroll to them
    panels.forEach((p) => {
      if (p.getBoundingClientRect().top < window.innerHeight) p.classList.add("in");
      else { p.style.setProperty("--d", 0); revealObs.observe(p); }
    });
  };

  let seen = false;
  try { seen = sessionStorage.getItem("cp-intro") === "1"; } catch (e) {}
  if (reduceMotion || seen) {
    intro.hidden = true;
    startSuite();
  } else {
    const count = $("#intro-count"), bar = $("#intro-bar");
    requestAnimationFrame(() => intro.classList.add("go"));
    const t0 = performance.now(), DURATION = 1500;
    const run = (now) => {
      const p = Math.min(1, (now - t0) / DURATION);
      const e = 1 - Math.pow(1 - p, 3);
      count.textContent = pad(Math.round(e * 100));
      bar.style.transform = `scaleX(${e})`;
      if (p < 1) return requestAnimationFrame(run);
      setTimeout(() => {
        intro.classList.add("out");
        startSuite();
        setTimeout(() => (intro.hidden = true), 1000);
        try { sessionStorage.setItem("cp-intro", "1"); } catch (e) {}
      }, 250);
    };
    requestAnimationFrame(run);
  }

  /* ---------- Viewer: films and frames, full screen ---------- */
  const lb = $("#lb");
  const stage = $("#lb-stage");
  const lbTitle = $("#lb-title");
  const lbCount = $("#lb-count");
  const prev = $("#lb-prev");
  const next = $("#lb-next");
  const filmBtn = $("#lb-film");
  let lbRow = null, frames = [], idx = 0, lastFocus = null;

  const embed = ({ provider, id, hash }) =>
    provider === "youtube"
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Film"></iframe>`
      : `<iframe src="https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Film"></iframe>`;

  const show = () => {
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    video.pause();
    clearInterval(cycle);
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("#lb-close").focus();
  };

  const playFilm = (data, label) => {
    stage.innerHTML = `<div class="film">${embed(data)}</div>`;
    lbTitle.textContent = label;
    lbCount.textContent = "";
    prev.hidden = next.hidden = filmBtn.hidden = true;
  };

  const showLbFrame = () => {
    stage.innerHTML = `<img src="/media/stills/${frames[idx]}.jpg" alt="Frame ${idx + 1} from ${lbRow.dataset.title}" />`;
    lbCount.textContent = `Frame ${pad(idx + 1)} / ${pad(frames.length)}`;
    prev.hidden = next.hidden = frames.length < 2;
  };

  function openRow(row, at) {
    lastFocus = document.activeElement;
    lbRow = row;
    if (at == null && row.dataset.id) {
      playFilm(row.dataset, row.dataset.title);
    } else {
      frames = row.dataset.stills.split(",");
      idx = at || 0;
      lbTitle.textContent = row.dataset.title;
      filmBtn.hidden = !row.dataset.id;
      showLbFrame();
    }
    show();
  }

  function openReel() {
    lastFocus = document.activeElement;
    lbRow = null;
    playFilm({ provider: "vimeo", id: REELS[reel].vimeo }, REELS[reel].title);
    show();
  }

  const close = () => {
    lb.classList.remove("is-open");
    lb.hidden = true;
    stage.innerHTML = "";
    document.body.style.overflow = "";
    if (film) startCycle();
    else if (!reduceMotion) video.play().catch(() => {});
    lastFocus?.focus();
  };

  const step = (d) => { idx = (idx + d + frames.length) % frames.length; showLbFrame(); };
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  filmBtn.addEventListener("click", () => playFilm(lbRow.dataset, lbRow.dataset.title));
  $("#lb-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && !next.hidden) step(1);
    if (e.key === "ArrowLeft" && !prev.hidden) step(-1);
  });
})();
