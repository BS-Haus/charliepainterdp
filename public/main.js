(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  const canDock = window.matchMedia("(min-width: 961px)");

  $("#year").textContent = new Date().getFullYear();

  const REELS = {
    narrative: { n: "01", label: "Narrative", title: "Narrative showreel", src: "/media/reel-narrative-v2.mp4", poster: "/media/reel-narrative-v2-poster.jpg", vimeo: "1149629056" },
    commercial: { n: "02", label: "Commercial", title: "Commercial showreel", src: "/media/reel-commercial-v2.mp4", poster: "/media/reel-commercial-v2-poster.jpg", vimeo: "1188991301" },
  };

  const player = $("#player");
  const video = $("#reel-video");
  const frames = $("#player-frames");
  const slotTop = $("#slot-top");
  const slotDock = $("#slot-dock");
  const tc = $("#tc");
  const index = $("#scale-index");
  const rows = $$(".row");

  let reel = "narrative";
  let docked = false;
  let active = null;   // the film the list is on (by scroll or hover)
  let showing = null;  // the film on the player, or null for the reel
  let frame = 0;
  let cycle = 0;

  /* ---------- The player travels from the monitor into the dock ---------- */
  const place = () => {
    const a = slotTop.getBoundingClientRect();
    let x = a.left, y = a.top, w = a.width, h = a.height, p = 0;
    if (canDock.matches) {
      const b = slotDock.getBoundingClientRect();
      // the move happens while the monitor's slot scrolls up out of view
      p = clamp((40 - a.top) / (a.height * 0.85), 0, 1);
      const e = reduceMotion ? (p >= 0.5 ? 1 : 0) : easeInOut(p);
      x = lerp(a.left, b.left, e); y = lerp(a.top, b.top, e);
      w = lerp(a.width, b.width, e); h = lerp(a.height, b.height, e);
    }
    player.style.width = `${w}px`;
    player.style.height = `${h}px`;
    player.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const nowDocked = p >= 1;
    if (nowDocked !== docked) {
      docked = nowDocked;
      document.body.classList.toggle("is-docked", docked);
      update();
    }
  };

  /* ---------- Reel or film: what the player is showing ---------- */
  const setIndex = (p) => (index.style.transform = `translateX(${clamp(p, 0, 1) * (index.parentElement.clientWidth - 2)}px)`);
  const tick = () => {
    const t = video.currentTime || 0;
    tc.textContent = `01:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
    if (video.duration) setIndex(t / video.duration);
    place(); // keeps the player locked to its slot through panel animations and layout shifts
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (reduceMotion) { video.removeAttribute("autoplay"); video.pause(); }

  const dockLabel = $("#dock-label"), dockCount = $("#dock-count"), dockTitle = $("#dock-title"), dockCredit = $("#dock-credit");
  const dockPlay = $("#dock-play"), dockFrames = $("#dock-frames");

  const showFrame = (i) => {
    const imgs = $$("img", frames);
    if (!imgs.length) return;
    frame = (i + imgs.length) % imgs.length;
    imgs.forEach((im, k) => im.classList.toggle("on", k === frame));
    $$(".shot", showing).forEach((s, k) => s.classList.toggle("is-on", k === frame));
    dockCount.textContent = `${pad(frame + 1)} / ${pad(imgs.length)}`;
  };
  const startCycle = () => {
    clearInterval(cycle);
    if (!reduceMotion && $$("img", frames).length > 1) cycle = setInterval(() => showFrame(frame + 1), 800);
  };

  const showReel = () => {
    showing = null;
    clearInterval(cycle);
    frames.innerHTML = "";
    $$(".shot.is-on").forEach((s) => s.classList.remove("is-on"));
    const r = REELS[reel];
    dockLabel.textContent = `Reel ${r.n} — ${r.label}`;
    dockCount.textContent = "2.39 : 1";
    dockTitle.textContent = r.title;
    dockCredit.textContent = "Scroll the list to step through the films.";
    dockPlay.textContent = "Watch with sound ↗";
    dockFrames.hidden = true;
    if (!reduceMotion) video.play().catch(() => {});
  };

  const showFilm = (row, at = null) => {
    if (row !== showing) {
      $$(".shot.is-on").forEach((s) => s.classList.remove("is-on"));
      showing = row;
      video.pause();
      frames.innerHTML = row.dataset.stills.split(",").map((s) => `<img src="/media/stills/${s}.jpg" alt="" decoding="async" />`).join("");
      dockLabel.textContent = `${row.dataset.n} — ${row.dataset.kind}`;
      dockTitle.textContent = row.dataset.title;
      dockCredit.textContent = row.dataset.credit;
      dockPlay.textContent = row.dataset.id ? "Play film ↗" : "View frames ↗";
      dockFrames.hidden = !row.dataset.id;
      showFrame(at ?? 0);
      if (at == null) startCycle();
    } else if (at != null) {
      clearInterval(cycle);
      showFrame(at);
    }
  };

  // Docked, the player follows the film you're on; up in the monitor, it plays the reel
  function update() {
    rows.forEach((r) => r.classList.toggle("is-on", docked && r === active));
    if (docked && active) showFilm(active);
    else showReel();
  }
  const setActive = (row) => { if (row !== active) { active = row; update(); } };

  const setReel = (key) => {
    if (key === reel) return;
    reel = key;
    video.poster = REELS[key].poster;
    video.src = REELS[key].src;
    if (!showing) showReel();
  };

  /* ---------- Films: scroll steps through them one by one; hover jumps straight to one ---------- */
  const centreObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting && !e.target.closest("[hidden]")) setActive(e.target);
  }), { rootMargin: "-48% 0px -48% 0px" });
  rows.forEach((row) => {
    centreObs.observe(row);
    if (canHover) {
      row.addEventListener("mouseenter", () => setActive(row));
      $$(".shot", row).forEach((s) => s.addEventListener("mouseenter", () => { setActive(row); if (docked) showFilm(row, Number(s.dataset.i)); }));
      row.addEventListener("mouseleave", () => { if (showing === row) startCycle(); });
    }
    $(".row-open", row).addEventListener("focus", () => setActive(row));
    row.addEventListener("click", (e) => {
      const shot = e.target.closest(".shot");
      openRow(row, shot ? Number(shot.dataset.i) : null);
    });
  });

  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => { const on = x === t; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", String(on)); });
    $$(".rows").forEach((l) => (l.hidden = l.dataset.set !== t.dataset.tab));
    setReel(t.dataset.tab);
    setActive($(`.rows[data-set="${t.dataset.tab}"] .row`));
  }));

  const playNow = () => (showing ? openRow(showing, showing.dataset.id ? null : frame) : openReel());
  player.addEventListener("click", playNow);
  player.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playNow(); } });
  dockPlay.addEventListener("click", playNow);
  dockFrames.addEventListener("click", () => showing && openRow(showing, frame));
  $("#reel-play").addEventListener("click", openReel);

  active = rows[0];
  place();
  update();

  /* ---------- Intro, then the grid draws itself in ---------- */
  const intro = $("#intro");
  const panels = $$(".panel");
  const revealObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
  }), { threshold: 0.08 });
  const startSuite = () => {
    document.body.classList.remove("is-intro");
    panels.forEach((p) => {
      if (p.getBoundingClientRect().top < window.innerHeight) p.classList.add("in");
      else { p.style.setProperty("--d", 0); revealObs.observe(p); }
    });
    place();
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
  let lbRow = null, lbFrames = [], idx = 0, lastFocus = null;

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
    stage.innerHTML = `<img src="/media/stills/${lbFrames[idx]}.jpg" alt="Frame ${idx + 1} from ${lbRow.dataset.title}" />`;
    lbCount.textContent = `Frame ${pad(idx + 1)} / ${pad(lbFrames.length)}`;
    prev.hidden = next.hidden = lbFrames.length < 2;
  };

  function openRow(row, at) {
    lastFocus = document.activeElement;
    lbRow = row;
    if (at == null && row.dataset.id) {
      playFilm(row.dataset, row.dataset.title);
    } else {
      lbFrames = row.dataset.stills.split(",");
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
    if (showing) startCycle();
    else if (!reduceMotion) video.play().catch(() => {});
    lastFocus?.focus();
  };

  const step = (d) => { idx = (idx + d + lbFrames.length) % lbFrames.length; showLbFrame(); };
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
