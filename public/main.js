(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  $$(".year").forEach((y) => { y.textContent = new Date().getFullYear(); });

  /* ======================================================================
     THE GATE — one viewer; the whole roll runs through beneath it
     ====================================================================== */
  const gate = $("#work");
  const roll = $("#roll");
  const strip = $("#strip");
  const runs = $$(".run", strip);
  const frame = $("#frame");
  const reel = $("#reel");
  const vN = $("#v-n"), vKind = $("#v-kind"), vCount = $("#v-count"), vTitle = $("#v-title"), vCredit = $("#v-credit"), vPlay = $("#v-play");
  const map = $("#map"), mapHead = $("#map-head"), segs = $$(".seg");
  const cLbl = $("#c-lbl"), cNow = $("#c-now"), cOf = $("#c-of");
  const films = runs.filter((r) => r.dataset.type === "film").length;

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

  // Two stills take turns: the new one is decoded behind, then dissolves in over the old in a few frames,
  // so a fast pull never lands on a half-loaded picture. During the intro they cut instead.
  const stills = [$("#still"), $("#still-b")];
  let front = 0, stillToken = 0;
  const setStill = (src, cut) => {
    const a = stills[front];
    if (a.dataset.src === src) return;
    const token = ++stillToken;
    if (cut) { a.src = a.dataset.src = src; return; }
    const b = stills[1 - front];
    b.src = b.dataset.src = src;
    b.decode().catch(() => {}).then(() => {
      if (token !== stillToken) return;
      a.classList.replace("is-front", "is-back");
      b.classList.remove("is-back");
      b.classList.add("is-front");
      front = 1 - front;
      setTimeout(() => token === stillToken && a.classList.remove("is-back"), 180);
    });
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
      for (let d = -2; d <= 2; d++) preload(c.run + d);
      cLbl.textContent = r.dataset.type === "reel" ? "Reel" : "Film";
      cNow.textContent = r.dataset.n;
      cOf.textContent = r.dataset.type === "reel" ? "" : `/ ${pad(films)}`;
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
      setStill($$(".cell img", r)[c.f].src.replace("/thumbs/", "/stills/"));
      vCount.textContent = `Frame ${pad(c.f + 1)} / ${pad(n)}`;
    }
    placeHead();
  };

  // The playhead on the map: inside the lit segment, as far along as the frame you're on
  function placeHead() {
    if (cur < 0) return;
    const c = cells[cur], seg = segs[c.run], n = $$(".cell", runs[c.run]).length;
    const m = map.getBoundingClientRect(), r = seg.getBoundingClientRect();
    mapHead.style.left = `${r.left - m.left + ((c.f + 0.5) / n) * r.width}px`;
  }

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
    }
    tc();
    requestAnimationFrame(loop);
  };

  const nudge = (to) => {
    target = clamp(to, minPos(), maxPos());
    lastInput = performance.now();
    settled = false;
  };

  // Wheel/trackpad over the gate pulls the roll; at either end the page scrolls as normal
  gate.addEventListener("wheel", (e) => {
    if (window.scrollY > 4 || !cells.length) return;
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
      if (drag.axis === "x") { try { drag.el.setPointerCapture(drag.id); } catch (err) {} roll.classList.add("is-dragging"); }
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
  // Click or drag along the map to scrub: where you are along a segment is how far into that film you go
  const scrubTo = (x) => {
    const seg = segs.find((s) => x <= s.getBoundingClientRect().right + 1.5) || segs[segs.length - 1];
    const r = seg.getBoundingClientRect(), run = Number(seg.dataset.item), n = $$(".cell", runs[run]).length;
    nudge(cells[firstOf(run) + clamp(Math.floor(((x - r.left) / r.width) * n), 0, n - 1)].x);
  };
  let scrubbing = null;
  map.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || !cells.length) return;
    scrubbing = e.pointerId;
    try { map.setPointerCapture(e.pointerId); } catch (err) {}
    scrubTo(e.clientX);
  });
  map.addEventListener("pointermove", (e) => { if (scrubbing === e.pointerId) scrubTo(e.clientX); });
  ["pointerup", "pointercancel"].forEach((t) => map.addEventListener(t, () => { scrubbing = null; }));

  // Arrow keys step a frame; with shift, a film — and light up the matching key
  document.addEventListener("keydown", (e) => {
    if (!$("#lb").hidden || cur < 0 || !["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    if (window.scrollY > gate.offsetHeight / 2) return;
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
    placeHead();
  });

  /* ---------- Intro: frames flicker through the gate like a projector threading up, then the roll slides in ---------- */
  const startGate = () => {
    measure();
    pos = target = cells[0].x;
    show(0);
    requestAnimationFrame(loop);
  };

  /* ---------- Power-on: the header flicks on label by label; the screen opens from a slit while the clips
     flick through it; then the corners come up, the keys run a lamp test, the map fills and the roll threads in ---------- */
  const body = document.body;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let seen = false;
  try { seen = sessionStorage.getItem("cp-intro") === "1"; } catch (e) {}
  if (!seen && !reduceMotion) body.classList.add("go-top");
  if (reduceMotion || seen) {
    body.classList.remove("is-intro");
    startGate();
  } else {
    const firsts = runs.filter((r) => r.dataset.type === "film").map((r) => $(".cell img", r).src.replace("/thumbs/", "/stills/"));
    frame.classList.add("is-film");
    setStill(firsts[0], true);
    const decoded = Promise.all(firsts.slice(0, 4).map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); }));
    let k = 1;
    const flick = () => {
      setStill(firsts[k % firsts.length], true);
      k++;
      if (k < firsts.length + 3) return setTimeout(flick, k < 4 ? 150 : 85);
      body.classList.remove("is-intro", "go-slit", "go-open");
      body.classList.add("go-deck");
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
    decoded.then(() => wait(250)).then(() => {
      body.classList.add("go-slit");          // a sliver of picture across the middle
      return wait(520);
    }).then(() => {
      body.classList.add("go-open");          // the shutter opens to the full frame
      flick();
    });
  }

  /* ---------- Into the page: the sheet slides up over the gate and the gate fades to black; once it's
     fully covered the reel stops, and starts again when you come back up ---------- */
  let covered = false;
  const cover = () => {
    const c = clamp(window.scrollY / (gate.offsetHeight || 1), 0, 1);
    gate.style.setProperty("--cover", c.toFixed(3));
    if ((c > 0.98) === covered) return;
    covered = c > 0.98;
    if (covered) reel.pause();
    else if (!reduceMotion && cur >= 0 && runs[cells[cur].run].dataset.type === "reel" && $("#lb").hidden) reel.play().catch(() => {});
  };
  window.addEventListener("scroll", cover, { passive: true });
  cover();

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

  /* ---------- Rows of the sheet are always there; the first time each arrives it flickers on, like a frame ---------- */
  if (!reduceMotion) {
    const rowObs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-lit"); rowObs.unobserve(e.target); }
    }), { threshold: 0.2 });
    $$(".row").forEach((r) => rowObs.observe(r));
  }

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

  const framesOf = (run) => $$(".cell img", run).map((im) => im.src.replace("/thumbs/", "/stills/"));

  const openLb = () => {
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    reel.pause();
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
