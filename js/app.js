/* ============================================================
   Keen web — interactions
   - Pixel eye renderer (5x5 grid, app-faithful poses + eyelash fix)
   - Hero product mock cycle (agents → terminal → diff → approval → completion)
   - FAQ accordion, scroll reveal, smooth scroll
   ============================================================ */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------
     1. Pixel Eye
     Poses share the app's 5x5 grid. The "attention" pose splays
     the top lashes outward (middle dot stays at col 2; outer two
     drift to col 0 and col 4) so they read as lashes, per brief.
  -------------------------------------------------------- */
  const POSES = {
    // Eye family
    open:      [[1,0],[2,0],[3,0],[0,1],[2,1],[4,1],[1,2],[2,2],[3,2]],
    left:      [[1,0],[2,0],[3,0],[0,1],[1,1],[4,1],[1,2],[2,2],[3,2]],
    right:     [[1,0],[2,0],[3,0],[0,1],[3,1],[4,1],[1,2],[2,2],[3,2]],
    blink:     [[0,1],[1,1],[2,1],[3,1],[4,1]],
    closed:    [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2]],
    // eyelash fix: top lashes splay to col 0 and col 4, middle stays.
    // Body fills rows 1-3 (same place as the open/scan eyes' centered body)
    // so the eyeball stays put while lashes extend upward.
    attention: [[0,0],[2,0],[4,0],[1,1],[2,1],[3,1],[0,2],[2,2],[4,2],[1,3],[2,3],[3,3]],
    // fast blink: keep top lashes + lower lid line only, same row span (0-3)
    attentionBlink: [[0,0],[2,0],[4,0],[0,3],[1,3],[2,3],[3,3],[4,3]],
    // App marks (from Keen/Utilities/DesignSystem.swift)
    pulse:    [[0,2],[1,2],[2,0],[2,1],[2,2],[3,2],[3,3],[3,4],[4,2]],
    alert:    [[2,0],[2,1],[2,2],[2,4]],
    x:        [[1,1],[3,1],[2,2],[1,3],[3,3]],
    check:    [[1,3],[2,4],[3,3],[4,2]],
    build:    [[0,0],[1,0],[0,1],[1,1],[2,1],[1,2],[2,2]],
    research: [[0,0],[1,0],[2,0],[3,0],[1,1],[2,1],[1,2],[2,2],[0,3],[3,3]],
    // Footer mark: eye frame WITHOUT the center pupil dot
    frame:    [[1,0],[2,0],[3,0],[0,1],[4,1],[1,2],[2,2],[3,2]],
    // Audience: single centered node
    node:     [[2,2]],
  };

  const VISUAL_TO_POSE = {
    open: "open", attention: "attention", working: "open", review: "open",
    left: "left", right: "right", blink: "blink", closed: "closed",
  };

  function buildEye(el) {
    // Create 25 cells once
    const cells = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "eye__cell";
        cell.dataset.c = c + "," + r;
        el.appendChild(cell);
        cells.push(cell);
      }
    }
    el._cells = cells;
    paintEye(el, el.dataset.pose || "open");
  }

  function paintEye(el, pose) {
    const points = POSES[pose] || POSES.open;
    // Center the pose's content within the 5x5 grid (matches the app's
    // PixelMark content-bounds centering) so the eye body stays put while
    // lashes/eyelids extend from the same anchor.
    const cs = points.map(p => p[0]), rs = points.map(p => p[1]);
    const minC = Math.min(...cs), maxC = Math.max(...cs);
    const minR = Math.min(...rs), maxR = Math.max(...rs);
    const offC = Math.floor((5 - (maxC - minC + 1)) / 2) - minC;
    const offR = Math.floor((5 - (maxR - minR + 1)) / 2) - minR;
    const set = new Set(points.map(([c, r]) => (c + offC) + "," + (r + offR)));
    el._cells.forEach(cell => {
      const on = set.has(cell.dataset.c);
      cell.style.opacity = on ? "1" : "0";
    });
    el.dataset.pose = pose;
  }

  /* Eye animation cycle. Variable cadence so it feels alive.
   * Respects a `data-locked-pose` set externally (e.g. the hero mock
   * locks the nav eye to "attention" during the approval beat). */
  function eyeLoop(el, opts = {}) {
    if (reduceMotion) { paintEye(el, "open"); return; }
    let cancelled = false;
    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    async function run() {
      while (!cancelled) {
        // Locked pose (e.g. attention during approval) — fast blink with splayed lashes
        if (el.dataset.lockedPose === "attention") {
          paintEye(el, "attention");
          await wait(640);
          paintEye(el, "attentionBlink");
          await wait(160);
          continue;
        }
        if (el.dataset.lockedPose) {
          paintEye(el, el.dataset.lockedPose);
          await wait(400);
          continue;
        }
        // long hold open
        paintEye(el, "open");
        await wait(2200 + Math.random() * 1400);
        if (cancelled) return;
        // blink
        paintEye(el, "blink");
        await wait(140);
        paintEye(el, "open");
        await wait(180);
        // sometimes scan
        if (Math.random() < 0.55) {
          paintEye(el, "left");
          await wait(560);
          paintEye(el, "open");
          await wait(220);
          paintEye(el, "right");
          await wait(560);
          paintEye(el, "open");
          await wait(420);
        }
        if (cancelled) return;
        // occasional double-blink
        if (Math.random() < 0.25) {
          paintEye(el, "blink"); await wait(120);
          paintEye(el, "open"); await wait(120);
          paintEye(el, "blink"); await wait(120);
          paintEye(el, "open"); await wait(200);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }

  /* --------------------------------------------------------
     2. Hero product scene cycle
     Sequence: terminal → diff → approval → completion
     The compact island widget updates its agent + state per step.
  -------------------------------------------------------- */
  const STEPS = ["terminal", "diff", "approval", "completion"];
  const STEP_MS = 6000;
  const STEP_INFO = {
    terminal:   { agent: "OpenCode", state: "working",   label: "Working" },
    diff:       { agent: "Codex",    state: "attention", label: "Needs permission" },
    approval:   { agent: "Codex",    state: "attention", label: "Needs permission" },
    completion: { agent: "Claude",   state: "review",    label: "Ready for review" },
  };

  function initMock(mockOrSelector) {
    const mock = typeof mockOrSelector === "string"
      ? document.querySelector(mockOrSelector)
      : mockOrSelector || document.querySelector("[data-mock]");
    if (!mock || mock._keenInit) return;
    mock._keenInit = true;
    const stages = mock.querySelectorAll(".mock__stage");
    const steps = mock.querySelectorAll(".mock__step");
    const islandAgent = mock.querySelector("[data-island-agent]");
    const islandState = mock.querySelector("[data-island-state]");
    const islandDot   = mock.querySelector("[data-island-dot]");
    let i = 0;

    function gotoStep(n) {
      const step = STEPS[n];
      const info = STEP_INFO[step];
      stages.forEach(s => s.classList.toggle("is-active", s.dataset.step === step));
      steps.forEach((el, idx) => {
        el.classList.toggle("is-active", idx === n);
        el.classList.toggle("is-done", idx < n);
      });
      if (islandAgent) islandAgent.textContent = info.agent;
      if (islandState) {
        islandState.textContent = info.label;
        islandState.dataset.state = info.state;
      }
      if (islandDot) islandDot.dataset.state = info.state;
      if (step === "terminal") runTerminalTyping(mock);
      if (step === "diff") runDiffReveal(mock);
    }

    function tick() {
      if (reduceMotion) return;
      gotoStep(i);
      i = (i + 1) % STEPS.length;
    }
    tick();
    if (!reduceMotion) {
      mock._keenTimer = setInterval(tick, STEP_MS);
    } else {
      // under reduced motion, just show the first stage statically
      stages.forEach(s => s.classList.toggle("is-active", s.dataset.step === STEPS[0]));
    }
  }
  // alias used in boot() for additional scenes
  const initDemo = initMock;

  /* Terminal typing — reveals lines progressively */
  function runTerminalTyping(mock) {
    const term = mock.querySelector('[data-step="terminal"] .term');
    if (!term || term.dataset.done === "1") return;
    // Lines are pre-rendered; we reveal them in sequence using a small per-line delay
    const lines = term.querySelectorAll(".term__line");
    lines.forEach(l => { l.style.opacity = "0"; l.style.transform = "translateY(2px)"; });
    lines.forEach((l, idx) => {
      setTimeout(() => {
        l.style.transition = "opacity .25s ease-out, transform .25s ease-out";
        l.style.opacity = "1";
        l.style.transform = "none";
      }, 200 + idx * 520);
    });
    term.dataset.done = "1";
  }

  /* Diff reveal */
  function runDiffReveal(mock) {
    const diff = mock.querySelector('[data-step="diff"] .diff');
    if (!diff) return;
    const lines = diff.querySelectorAll(".diff__ln");
    lines.forEach((l, idx) => {
      l.style.opacity = "0";
      setTimeout(() => {
        l.style.transition = "opacity .2s ease-out";
        l.style.opacity = "1";
      }, 200 + idx * 90);
    });
  }

  /* --------------------------------------------------------
     2b. Hero app panel — cycles the real Keen app states
         Monitoring (session list) → Attention (approve) → Completion
  -------------------------------------------------------- */
  // Beats: the dropdown cycles monitor → question → done while terminals
  // pop up behind it with depth (1 → 2 → 3 windows), then collapse and repeat.
  const TERM_KEYS = ["front", "g1", "g2"];
  const DESK = [
    { view: "monitor", terms: ["front"],               count: "1 active" },
    { view: "monitor", terms: ["front", "g1"],         count: "2 active" },
    { view: "ask",     terms: ["front", "g1", "g2"],   count: "1 needs you" },
    { view: "done",    terms: ["front", "g1", "g2"],   count: "ready" },
  ];
  const DESK_MS = 3000;

  function initDesk() {
    const desk = document.querySelector("[data-desk]");
    if (!desk || desk._keenInit) return;
    desk._keenInit = true;
    const stage = desk.querySelector(".desk__stage");
    const views = desk.querySelectorAll(".dview");
    const terms = {};
    TERM_KEYS.forEach(k => { terms[k] = desk.querySelector('[data-term="' + k + '"]'); });
    const count = desk.querySelector("[data-drop-count]");
    const cursor = desk.querySelector("[data-cursor]");
    const askOpt = desk.querySelector('.dview[data-dview="ask"] .ask__opt');
    const parkEl = desk.querySelector(".twin--front .twin__input");
    let clickT;

    function moveCursor(el) {
      if (!cursor || !el || !stage) return;
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = (r.left - s.left) + Math.min(30, r.width * 0.16);
      const y = (r.top - s.top) + r.height * 0.5 - 2;
      cursor.style.transform = "translate(" + x + "px," + y + "px)";
      cursor.classList.add("is-in");
    }

    function apply(n) {
      const step = DESK[n];
      views.forEach(v => v.classList.toggle("is-active", v.dataset.dview === step.view));
      TERM_KEYS.forEach(k => terms[k] && terms[k].classList.toggle("is-in", step.terms.includes(k)));
      if (count) count.textContent = step.count;

      clearTimeout(clickT);
      if (step.view === "ask") {
        moveCursor(askOpt);                         // glide the pointer up to the option…
        clickT = setTimeout(() => {                 // …then "click" it
          cursor && cursor.classList.add("is-click");
          askOpt && askOpt.classList.add("ask__opt--hot");
        }, 820);
      } else {
        cursor && cursor.classList.remove("is-click");
        askOpt && askOpt.classList.remove("ask__opt--hot");
        moveCursor(parkEl);                         // rest over the working terminal
      }
    }

    if (reduceMotion) {
      apply(0);
      TERM_KEYS.forEach(k => terms[k] && terms[k].classList.add("is-in"));
      return;
    }
    let i = 0;
    apply(0);
    setTimeout(() => moveCursor(parkEl), 450);      // let the pointer fade in after load
    setInterval(() => { i = (i + 1) % DESK.length; apply(i); }, DESK_MS);
  }

  /* --------------------------------------------------------
     3. FAQ accordion
  -------------------------------------------------------- */
  function initFaq() {
    document.querySelectorAll(".faq__item").forEach(item => {
      const q = item.querySelector(".faq__q");
      const a = item.querySelector(".faq__a");
      if (!q || !a) return;
      q.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        // close others (uncomment for single-open)
        // document.querySelectorAll(".faq__item.is-open").forEach(o => { o.classList.remove("is-open"); o.querySelector(".faq__a").style.maxHeight = null; });
        if (isOpen) {
          item.classList.remove("is-open");
          a.style.maxHeight = null;
        } else {
          item.classList.add("is-open");
          a.style.maxHeight = a.scrollHeight + "px";
        }
      });
    });
  }

  /* --------------------------------------------------------
     4. Scroll reveal
  -------------------------------------------------------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach(el => io.observe(el));
  }

  /* --------------------------------------------------------
     5. Smooth scroll for nav anchors
  -------------------------------------------------------- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length <= 1) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 56;
        window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* Pillar eye behaviors — three columns, each with its own cadence:
   *   "blink"     → open eye that blinks periodically
   *   "scan"      → open eye that looks left → center → right
   *   "attentive" → lashed attention eye that blinks fast, body anchored
   *                 in the same place as the others (lashes extend upward)
   */
  function pillarLoop(el, mode) {
    if (reduceMotion) { paintEye(el, mode === "attentive" ? "attention" : "open"); return; }
    let cancelled = false;
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    async function run() {
      while (!cancelled) {
        if (mode === "blink") {
          paintEye(el, "open"); await wait(1800 + Math.random() * 1200);
          paintEye(el, "blink"); await wait(140);
        } else if (mode === "scan") {
          paintEye(el, "open"); await wait(900);
          paintEye(el, "left"); await wait(620);
          paintEye(el, "open"); await wait(260);
          paintEye(el, "right"); await wait(620);
          paintEye(el, "open"); await wait(900);
        } else if (mode === "attentive") {
          paintEye(el, "attention"); await wait(640);
          paintEye(el, "attentionBlink"); await wait(160);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }

  /* --------------------------------------------------------
     6. Boot
  -------------------------------------------------------- */
  function boot() {
    document.querySelectorAll(".eye").forEach(el => {
      buildEye(el);
      if (el.dataset.animate === "always") eyeLoop(el);
      if (el.dataset.pillar === "blink")     pillarLoop(el, "blink");
      if (el.dataset.pillar === "scan")      pillarLoop(el, "scan");
      if (el.dataset.pillar === "attentive") pillarLoop(el, "attentive");
    });
    initDesk();
    document.querySelectorAll("[data-mock]").forEach(initDemo); // additional scenes (transformation)
    initFaq();
    initReveal();
    initSmoothScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
