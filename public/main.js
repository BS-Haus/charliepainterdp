(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const portrait = window.matchMedia("(max-width: 760px) and (orientation: portrait)");

  $("#year").textContent = new Date().getFullYear();

  const topProgress = $("#top-progress");

  /* ======================================================================
     THE GATE — one viewer; the whole roll runs through beneath it
     ====================================================================== */
  const gate = $("#work");
  const roll = $("#roll");
  const strip = $("#strip");
  const runs = $$(".run", strip);
  const frame = $("#frame");
  const still = $("#still");
  const reel = $("#reel");
  const vN = $("#v-n"), vKind = $("#v-kind"), vCount = $("#v-count"), vTitle = $("#v-title"), vCredit = $("#v-credit"), vPlay = $("#v-play");
  const hint = $("#roll-hint");
  const segs = $$(".seg"), counter = $("#c-now");

  // Every frame on the roll, with where its centre sits along the strip
  let cells = [];
  const measure = () => {
    const base = strip.getBoundingClientRect().left - (parseFloat(strip.dataset.x) || 0);
    cells = $$(".cell", strip).map((c) => {
      const r = c.getBoundingClientRect();
      return { el: c, run: Number(c.closest(".run").dataset.item), f: Number(c.dataset.f), x: r.left - base + r.width / 2 };
    });
  };

  let pos = 0, target = 0, cur = -1, lastInput = 0, settled = true;
  const minPos = () => cells[0].x;
  const maxPos = () => cells[cells.length - 1].x;
  const nearest = (p) => {
    let best = 0;
    for (let k = 1; k < cells.length; k++) if (Math.abs(cells[k].x - p) < Math.abs(cells[best].x - p)) best = k;
    return best;
  };
  const place = (p) => {
    const x = roll.clientWidth / 2 - p;
    strip.dataset.x = x;
    strip.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  // The viewer: a reel plays its video (seeking to the frame you're on); a film shows its still
  const preloaded = new Set();
  const preload = (k) => {
    const r = runs[k];
    if (!r || preloaded.has(k)) return;
    preloaded.add(k);
    $$(".cell img", r).forEach((im) => { const i = new Image(); i.src = im.src.replace("/thumbs/", "/stills/"); });
  };

  const show = (k) => {
    const c = cells[k];
    const r = runs[c.run];
    const prevRun = cur >= 0 ? cells[cur].run : -1;
    cur = k;
    cells.forEach((cc, j) => cc.el.classList.toggle("is-on", j === k));
    if (c.run !== prevRun) {
      runs.forEach((rr, j) => rr.classList.toggle("is-on", j === c.run));
      segs.forEach((s, j) => s.classList.toggle("is-on", j === c.run));
      vN.textContent = r.dataset.n;
      vKind.textContent = r.dataset.kind;
      vTitle.textContent = r.dataset.title;
      vCredit.textContent = r.dataset.credit;
      vPlay.textContent = r.dataset.type === "reel" ? "Watch with sound ↗" : r.dataset.id ? "Play film ↗" : "View frames ↗";
      preload(c.run); preload(c.run + 1); preload(c.run - 1);
    }
    const n = $$(".cell", r).length;
    if (r.dataset.type === "reel") {
      frame.classList.remove("is-film");
      if (reel.dataset.src !== r.dataset.src) { reel.dataset.src = r.dataset.src; reel.poster = r.dataset.poster; reel.src = r.dataset.src; }
      const seek = () => { if (reel.duration) reel.currentTime = ((c.f + 0.5) / n) * reel.duration; };
      reel.readyState >= 1 ? seek() : reel.addEventListener("loadedmetadata", seek, { once: true });
      if (!reduceMotion) reel.play().catch(() => {});
    } else {
      frame.classList.add("is-film");
      reel.pause();
      still.src = $$(".cell img", r)[c.f].src.replace("/thumbs/", "/stills/");
      vCount.textContent = `Frame ${pad(c.f + 1)} / ${pad(n)}`;
    }
    counter.textContent = String(k + 1).padStart(3, "0");
  };

  // Reels show running timecode in the top-right corner
  const tc = () => {
    if (cur >= 0 && runs[cells[cur].run].dataset.type === "reel") {
      const t = reel.currentTime || 0;
      vCount.textContent = `TC 01:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
    }
  };

  // One loop eases the roll toward its target, snaps it onto a frame when you let go, and keeps the viewer in step
  const loop = () => {
    if (cells.length) {
      if (!settled && !drag && performance.now() - lastInput > 160) { target = cells[nearest(target)].x; settled = true; }
      pos += (target - pos) * (reduceMotion ? 1 : 0.2);
      if (Math.abs(target - pos) < 0.3) pos = target;
      place(pos);
      const k = nearest(pos);
      if (k !== cur) show(k);
      if (!portrait.matches && window.scrollY <= 4) topProgress.style.transform = `scaleX(${(pos - minPos()) / (maxPos() - minPos() || 1)})`;
    }
    tc();
    requestAnimationFrame(loop);
  };

  const nudge = (to) => {
    target = clamp(to, minPos(), maxPos());
    lastInput = performance.now();
    settled = false;
    hint.classList.add("is-gone");
  };

  // Wheel/trackpad over the gate pulls the roll; at either end the page scrolls as normal
  gate.addEventListener("wheel", (e) => {
    if (portrait.matches || window.scrollY > 4 || !cells.length) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if ((d > 0 && target >= maxPos() - 0.5) || (d < 0 && target <= minPos() + 0.5)) return;
    e.preventDefault();
    nudge(target + d * (e.deltaMode === 1 ? 40 : 1.15));
  }, { passive: false });

  // Drag the roll (or swipe the big frame); a tap on a frame of the roll goes straight to it
  let drag = null, draggedAt = 0;
  const startDrag = (e) => {
    if (e.button > 0 || e.target.closest("button") || !cells.length) return;
    drag = { x: e.clientX, y: e.clientY, from: target, moved: false, axis: null, id: e.pointerId, el: e.currentTarget };
  };
  const moveDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.axis && Math.hypot(dx, dy) > 6) {
      drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.axis === "x") { drag.el.setPointerCapture?.(drag.id); roll.classList.add("is-dragging"); }
    }
    if (drag.axis === "x") {
      drag.moved = true;
      // on the roll, the film follows your hand; on the big frame, swiping left moves forward
      nudge(drag.from - dx * (drag.el === roll ? 1 : 2.2));
    }
  };
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    roll.classList.remove("is-dragging");
    if (drag.moved) draggedAt = performance.now();
    else if (drag.el === roll && !drag.axis) {
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cell");
      const k = cell ? cells.findIndex((c) => c.el === cell) : -1;
      if (k >= 0) nudge(cells[k].x);
    }
    drag = null;
  };
  [roll, $("#viewer")].forEach((el) => {
    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("pointermove", moveDrag);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  });
  // A plain click on the picture plays it; the end of a swipe doesn't
  $("#viewer").addEventListener("click", (e) => {
    if (e.target.closest("button") || performance.now() - draggedAt < 350 || cur < 0) return;
    playCurrent();
  });

  // The deck: step a frame or a film, or jump anywhere on the map
  const firstOf = (run) => cells.findIndex((c) => c.run === run);
  const stepFrame = (dir) => nudge(cells[clamp(nearest(target) + dir, 0, cells.length - 1)].x);
  const stepFilm = (dir) => {
    const k = nearest(target), start = firstOf(cells[k].run);
    if (dir < 0 && k > start) return nudge(cells[start].x);
    nudge(cells[firstOf(clamp(cells[k].run + dir, 0, runs.length - 1))].x);
  };
  const press = (key) => { key.classList.add("is-hit"); setTimeout(() => key.classList.remove("is-hit"), 140); };
  $$(".key").forEach((key) => key.addEventListener("click", () => {
    if (!cells.length) return;
    const s = key.dataset.step;
    s.endsWith("film") ? stepFilm(s.startsWith("-") ? -1 : 1) : stepFrame(Number(s));
  }));
  segs.forEach((s) => s.addEventListener("click", () => cells.length && nudge(cells[firstOf(Number(s.dataset.item))].x)));

  // Arrow keys step a frame; with shift, a film — and light up the matching key
  document.addEventListener("keydown", (e) => {
    if (!$("#lb").hidden || portrait.matches || cur < 0 || !["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    if (gate.getBoundingClientRect().bottom < 100) return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    e.shiftKey ? stepFilm(dir) : stepFrame(dir);
    press($(`.key[data-step="${dir < 0 ? "-" : ""}${e.shiftKey ? "film" : 1}"]`));
  });

  function playCurrent() {
    const r = runs[cells[cur].run];
    if (r.dataset.type === "reel" || r.dataset.id) openFilm(r);
    else openFrames(r, cells[cur].f);
  }
  vPlay.addEventListener("click", playCurrent);

  window.addEventListener("resize", () => {
    if (!cells.length) return;
    const keep = cur >= 0 ? cur : 0;
    measure();
    pos = target = cells[keep].x;
  });

  /* ---------- Intro: frames flicker through the gate like a projector threading up, then the roll slides in ---------- */
  const startGate = () => {
    measure();
    pos = target = cells[0].x;
    show(0);
    requestAnimationFrame(loop);
  };

  let seen = false;
  try { seen = sessionStorage.getItem("cp-intro") === "1"; } catch (e) {}
  if (portrait.matches || reduceMotion || seen) {
    document.body.classList.remove("is-intro");
    startGate();
  } else {
    const firsts = runs.filter((r) => r.dataset.type === "film").map((r) => $(".cell img", r).src.replace("/thumbs/", "/stills/"));
    frame.classList.add("is-film");
    let k = 0;
    const flick = () => {
      still.src = firsts[k % firsts.length];
      k++;
      if (k < firsts.length + 4) return setTimeout(flick, k < 3 ? 160 : 85);
      document.body.classList.remove("is-intro");
      startGate();
      // thread the roll in from the right
      const x = parseFloat(strip.dataset.x);
      strip.style.transition = "none";
      strip.style.transform = `translate3d(${x + roll.clientWidth}px, 0, 0)`;
      strip.getBoundingClientRect();
      strip.style.transition = "";
      strip.classList.add("is-threading");
      setTimeout(() => strip.classList.remove("is-threading"), 1400);
      try { sessionStorage.setItem("cp-intro", "1"); } catch (e) {}
    };
    Promise.all(firsts.slice(0, 4).map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); })).then(flick);
  }

  /* ======================================================================
     PORTRAIT PHONES — the feed
     ====================================================================== */
  const feedItems = $$(".feed-item");
  const feedObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = $("video", e.target);
    if (e.isIntersecting) {
      if (v) { if (!v.src) v.src = v.dataset.src; if (!reduceMotion) v.play().catch(() => {}); }
      if (portrait.matches) topProgress.style.transform = `scaleX(${(feedItems.indexOf(e.target) + 1) / feedItems.length})`;
    } else if (v) v.pause();
  }), { threshold: 0.6 });
  feedItems.forEach((it) => {
    feedObs.observe(it);
    const fs = $(".feed-frames", it), count = $(".feed-count", it);
    if (fs && count) fs.addEventListener("scroll", () => {
      count.textContent = `${pad(Math.round(fs.scrollLeft / fs.clientWidth) + 1)} / ${pad(fs.children.length)}`;
    }, { passive: true });
    $(".feed-play", it).addEventListener("click", () => {
      if (it.dataset.type === "reel" || it.dataset.id) openFilm(it);
      else openFrames(it, fs ? Math.round(fs.scrollLeft / fs.clientWidth) : 0);
    });
  });

  /* ---------- Header: which section you're in ---------- */
  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));
  // a section is lit from the moment it crosses the middle of the screen (and contact, once you hit the bottom)
  const lights = () => {
    let on = 0;
    sections.forEach((el, k) => { if (el && el.getBoundingClientRect().top < innerHeight / 2) on = k; });
    if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) on = sections.length - 1;
    navLinks.forEach((a, k) => a.classList.toggle("is-on", k === on));
  };
  window.addEventListener("scroll", lights, { passive: true });
  lights();
  if (!portrait.matches) window.addEventListener("scroll", () => {
    if (window.scrollY > 4) topProgress.style.transform = `scaleX(${clamp(window.scrollY / (document.documentElement.scrollHeight - innerHeight), 0, 1)})`;
  }, { passive: true });

  /* ---------- Rows of the sheet fade in as they arrive ---------- */
  const revealObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
  }), { threshold: 0.08 });
  $$(".row").forEach((p) => revealObs.observe(p));

  /* ======================================================================
     VIEWER — films and frames, full screen
     ====================================================================== */
  const lb = $("#lb");
  const lbStage = $("#lb-stage");
  const lbTitle = $("#lb-title");
  const lbCount = $("#lb-count");
  const prev = $("#lb-prev");
  const next = $("#lb-next");
  const filmBtn = $("#lb-film");
  let lbItem = null, lbFrames = [], idx = 0, lastFocus = null;

  const embed = ({ provider, id, hash }) =>
    provider === "youtube"
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Film"></iframe>`
      : `<iframe src="https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Film"></iframe>`;

  const framesOf = (it) => (it.classList.contains("run") ? $$(".cell img", it) : $$(".feed-frames img", it)).map((im) => im.src.replace("/thumbs/", "/stills/"));

  const openLb = () => {
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    reel.pause();
    $$(".feed video").forEach((v) => v.pause());
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("#lb-close").focus();
  };
  const playIn = (it) => {
    lbStage.innerHTML = `<div class="film">${embed(it.dataset)}</div>`;
    lbTitle.textContent = it.dataset.title;
    lbCount.textContent = "";
    prev.hidden = next.hidden = filmBtn.hidden = true;
  };
  const showLbFrame = () => {
    lbStage.innerHTML = `<img src="${lbFrames[idx]}" alt="Frame ${idx + 1} from ${lbItem.dataset.title}" />`;
    lbCount.textContent = `Frame ${pad(idx + 1)} / ${pad(lbFrames.length)}`;
    prev.hidden = next.hidden = lbFrames.length < 2;
  };
  function openFilm(it) { lastFocus = document.activeElement; lbItem = it; playIn(it); openLb(); }
  function openFrames(it, at) {
    lastFocus = document.activeElement;
    lbItem = it;
    lbFrames = framesOf(it);
    idx = at || 0;
    lbTitle.textContent = it.dataset.title;
    filmBtn.hidden = !it.dataset.id;
    showLbFrame();
    openLb();
  }
  const close = () => {
    lb.classList.remove("is-open");
    lb.hidden = true;
    lbStage.innerHTML = "";
    document.body.style.overflow = "";
    if (!reduceMotion && cur >= 0 && runs[cells[cur].run].dataset.type === "reel") reel.play().catch(() => {});
    lastFocus?.focus();
  };
  const step = (d) => { idx = (idx + d + lbFrames.length) % lbFrames.length; showLbFrame(); };
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  filmBtn.addEventListener("click", () => playIn(lbItem));
  $("#lb-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && !next.hidden) step(1);
    if (e.key === "ArrowLeft" && !prev.hidden) step(-1);
  });
})();
