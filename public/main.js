(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const portraitPhone = window.matchMedia("(max-width: 760px) and (orientation: portrait)");

  $("#year").textContent = new Date().getFullYear();

  const roll = $("#work");
  const stage = $("#stage");
  const stageIn = $("#stage-in");
  const video = $("#reel-video");
  const framesEl = $("#stage-frames");
  const steps = $$(".step");
  const bars = $$("[data-step]"); // the phone bars and the index entries
  const sticky = $("#roll-sticky");
  const idxList = $(".idx-list");
  const stN = $("#st-n"), stKind = $("#st-kind"), stTitle = $("#st-title"), stCredit = $("#st-credit"), stPlay = $("#st-play"), stFrame = $("#st-frame");
  const films = steps.filter((s) => s.dataset.type === "film").length;
  const topNow = $("#top-now"), topProgress = $("#top-progress");
  let section = "work";
  const readout = () => {
    if (section !== "work") { topNow.innerHTML = `<b>${section === "about" ? "About" : "Contact"}</b>`; return; }
    const s = steps[cur];
    if (!s) return;
    if (s.dataset.type === "reel") topNow.innerHTML = `<span class="rec"></span><b>${s.dataset.title}</b>`;
    else topNow.innerHTML = `<span>${s.dataset.n} / ${pad(films)}</span><b>${s.dataset.title}</b><span>Frame ${pad(curFrame + 1)}</span>`;
  };

  /* ---------- The roll: where you are in the scroll picks the reel or film, and the frame within it ---------- */
  let cur = -1, curFrame = -1;
  const preloaded = new Set();
  const preload = (step) => {
    if (!step || step.dataset.type !== "film" || preloaded.has(step)) return;
    preloaded.add(step);
    step.dataset.stills.split(",").forEach((s) => { const im = new Image(); im.src = `/media/stills/${s}.jpg`; });
  };

  const render = (i, f) => {
    const s = steps[i];
    if (i !== cur) {
      cur = i;
      curFrame = -1;
      bars.forEach((b) => b.classList.toggle("is-on", Number(b.dataset.step) === i));
      // keep the lit index entry in view without moving the page
      const lit = $(`.idx-item[data-step="${i}"]`);
      if (lit && idxList.clientHeight) {
        const top = lit.offsetTop - idxList.offsetTop, bottom = top + lit.offsetHeight;
        if (top < idxList.scrollTop || bottom > idxList.scrollTop + idxList.clientHeight) idxList.scrollTop = top - idxList.clientHeight / 2;
      }
      stTitle.textContent = s.dataset.title;
      stCredit.textContent = s.dataset.credit;
      if (s.dataset.type === "reel") {
        stageIn.classList.remove("is-film");
        framesEl.innerHTML = "";
        if (video.dataset.src !== s.dataset.src) {
          video.dataset.src = s.dataset.src;
          video.poster = s.dataset.poster;
          video.src = s.dataset.src;
        }
        if (!reduceMotion) video.play().catch(() => {});
        stN.textContent = s.dataset.group === "narrative" ? "Reel 01" : "Reel 02";
        stKind.textContent = s.dataset.group === "narrative" ? "Narrative" : "Commercial";
        stPlay.textContent = "Watch with sound ↗";
        stFrame.textContent = "";
      } else {
        video.pause();
        stageIn.classList.add("is-film");
        framesEl.innerHTML = s.dataset.stills.split(",").map((st) => `<img src="/media/stills/${st}.jpg" alt="" decoding="async" />`).join("");
        stN.textContent = `${s.dataset.n} / ${pad(films)}`;
        stKind.textContent = s.dataset.kind;
        stPlay.textContent = s.dataset.id ? "Play film ↗" : "View frames ↗";
      }
      preload(steps[i + 1]);
      preload(steps[i - 1]);
    }
    if (s.dataset.type === "film" && f !== curFrame) {
      curFrame = f;
      const imgs = $$("img", framesEl);
      imgs.forEach((im, k) => im.classList.toggle("on", k === f));
      stFrame.textContent = `Frame ${pad(f + 1)} / ${pad(imgs.length)}`;
    }
    readout();
  };

  const stepHeight = () => steps[0].offsetHeight;
  const stickyTop = () => parseFloat(getComputedStyle(sticky).top) || 0;
  const onScroll = () => {
    const into = stickyTop() - roll.getBoundingClientRect().top;
    const pos = clamp(into / stepHeight(), 0, steps.length - 0.0001);
    const i = Math.floor(pos);
    const s = steps[i];
    const n = s.dataset.type === "film" ? s.dataset.stills.split(",").length : 1;
    // frames turn over as you scroll through a film, like a roll running through the gate
    render(i, Math.min(n - 1, Math.floor((pos - i) * n)));
    const max = document.documentElement.scrollHeight - window.innerHeight;
    topProgress.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
  };
  let queued = false;
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; onScroll(); }); } }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // Bars jump straight to a film
  bars.forEach((b) => b.addEventListener("click", () => {
    const top = window.scrollY + roll.getBoundingClientRect().top - stickyTop() + Number(b.dataset.step) * stepHeight() + 2;
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  }));

  // The reel pauses once you've scrolled past the roll
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) video.pause();
    else if (!reduceMotion && steps[cur]?.dataset.type === "reel") video.play().catch(() => {});
  }).observe(roll);

  stPlay.addEventListener("click", () => {
    const s = steps[cur];
    if (s.dataset.type === "reel" || s.dataset.id) openFilm(s);
    else openFrames(s, Math.max(0, curFrame));
  });

  /* ---------- Nav: the section you're in is lit, and the readout follows it ---------- */
  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href")));
  const navObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    section = e.target.id;
    navLinks.forEach((a, k) => a.classList.toggle("is-on", sections[k] === e.target));
    readout();
  }), { rootMargin: "-50% 0px -49% 0px" });
  sections.forEach((el) => el && navObs.observe(el));

  /* ---------- Phones: sideways by default, so the work fills the screen; an upright crop if preferred ---------- */
  const turn = $("#turn");
  const toggle = $("#view-toggle");
  stage.append(turn, toggle); // keep these upright even when the picture is turned
  let pref = null;
  try { pref = sessionStorage.getItem("cp-view"); } catch (e) {}
  const applyView = () => {
    const rotated = portraitPhone.matches && pref !== "upright";
    stage.classList.toggle("is-rotated", rotated);
    toggle.textContent = rotated ? "Upright view" : "Sideways view";
  };
  toggle.addEventListener("click", () => {
    pref = stage.classList.contains("is-rotated") ? "upright" : "sideways";
    try { sessionStorage.setItem("cp-view", pref); } catch (e) {}
    applyView();
  });
  portraitPhone.addEventListener?.("change", applyView);
  applyView();
  // a brief nudge the first time the roll is on screen sideways
  let nudged = false;
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || nudged || !stage.classList.contains("is-rotated")) return;
    nudged = true;
    turn.classList.add("show");
    setTimeout(() => turn.classList.remove("show"), 2600);
  }, { threshold: 0.6 }).observe(stage);

  /* ---------- Intro: the clips flick through a small frame, which opens out into the stage ---------- */
  const intro = $("#intro");
  const frame = $("#intro-frame");
  const panels = $$(".panel");
  const revealObs = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); }
  }), { threshold: 0.08 });
  panels.forEach((p) => revealObs.observe(p));

  const finish = (expand) => {
    if (expand && !stage.classList.contains("is-rotated")) {
      const r = frame.getBoundingClientRect(), s = stageIn.getBoundingClientRect();
      stageIn.style.transition = "none";
      stageIn.style.clipPath = `inset(${r.top - s.top}px ${s.right - r.right}px ${s.bottom - r.bottom}px ${r.left - s.left}px)`;
      stageIn.getBoundingClientRect();
      stageIn.style.transition = "";
      requestAnimationFrame(() => requestAnimationFrame(() => (stageIn.style.clipPath = "inset(0px 0px 0px 0px)")));
    }
    intro.classList.add("out");
    document.body.classList.remove("is-intro");
    setTimeout(() => (intro.hidden = true), 600);
    if (!reduceMotion) video.play().catch(() => {});
    try { sessionStorage.setItem("cp-intro", "1"); } catch (e) {}
  };

  let seen = false;
  try { seen = sessionStorage.getItem("cp-intro") === "1"; } catch (e) {}
  if (reduceMotion || seen) {
    intro.hidden = true;
    document.body.classList.remove("is-intro");
  } else {
    // one frame from every film, then a second pass for pace
    const pool = steps.filter((s) => s.dataset.type === "film").flatMap((s) => s.dataset.stills.split(",").slice(0, 2));
    const order = pool.filter((_, k) => k % 2 === 0).concat(pool.filter((_, k) => k % 2 === 1)).slice(0, 24);
    frame.innerHTML = order.map((s) => `<img src="/media/thumbs/${s}.jpg" alt="" />`).join("");
    const imgs = $$("img", frame), count = $("#intro-count");
    const FLICKS = imgs.length;
    let k = 0;
    const flick = () => {
      imgs.forEach((im, j) => im.classList.toggle("on", j === k % imgs.length));
      count.textContent = pad(Math.round(((k + 1) / FLICKS) * 100));
      k++;
      if (k < FLICKS) setTimeout(flick, k < 3 ? 160 : k > FLICKS - 4 ? 160 : 75);
      else {
        // land on the reel's first frame so the frame opens straight into the stage
        imgs.forEach((im) => im.classList.remove("on"));
        frame.style.background = `#000 url(${steps[0].dataset.poster}) center / cover`;
        setTimeout(() => finish(true), 220);
      }
    };
    Promise.all(imgs.slice(0, 6).map((im) => im.decode().catch(() => {}))).then(() => setTimeout(flick, 200));
  }

  /* ---------- Viewer: films and frames, full screen ---------- */
  const lb = $("#lb");
  const lbStage = $("#lb-stage");
  const lbTitle = $("#lb-title");
  const lbCount = $("#lb-count");
  const prev = $("#lb-prev");
  const next = $("#lb-next");
  const filmBtn = $("#lb-film");
  let lbStep = null, lbFrames = [], idx = 0, lastFocus = null;

  const embed = ({ provider, id, hash }) =>
    provider === "youtube"
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="Film"></iframe>`
      : `<iframe src="https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}autoplay=1&title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Film"></iframe>`;

  const show = () => {
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    video.pause();
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("#lb-close").focus();
  };

  const playIn = (s) => {
    lbStage.innerHTML = `<div class="film">${embed(s.dataset)}</div>`;
    lbTitle.textContent = s.dataset.title;
    lbCount.textContent = "";
    prev.hidden = next.hidden = filmBtn.hidden = true;
  };

  const showLbFrame = () => {
    lbStage.innerHTML = `<img src="/media/stills/${lbFrames[idx]}.jpg" alt="Frame ${idx + 1} from ${lbStep.dataset.title}" />`;
    lbCount.textContent = `Frame ${pad(idx + 1)} / ${pad(lbFrames.length)}`;
    prev.hidden = next.hidden = lbFrames.length < 2;
  };

  function openFilm(s) {
    lastFocus = document.activeElement;
    lbStep = s;
    playIn(s);
    show();
  }

  function openFrames(s, at) {
    lastFocus = document.activeElement;
    lbStep = s;
    lbFrames = s.dataset.stills.split(",");
    idx = at || 0;
    lbTitle.textContent = s.dataset.title;
    filmBtn.hidden = !s.dataset.id;
    showLbFrame();
    show();
  }

  const close = () => {
    lb.classList.remove("is-open");
    lb.hidden = true;
    lbStage.innerHTML = "";
    document.body.style.overflow = "";
    if (!reduceMotion && steps[cur]?.dataset.type === "reel") video.play().catch(() => {});
    lastFocus?.focus();
  };

  const step = (d) => { idx = (idx + d + lbFrames.length) % lbFrames.length; showLbFrame(); };
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  filmBtn.addEventListener("click", () => playIn(lbStep));
  $("#lb-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && !next.hidden) step(1);
    if (e.key === "ArrowLeft" && !prev.hidden) step(-1);
  });
})();
