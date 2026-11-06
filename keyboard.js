/* ==========================================================================
   On-screen kana keyboard
   - "flick": the 12-key layout used on Japanese phones. Tap a key to cycle
     through its row (か → き → く…) or flick left/up/right/down.
   - "grid": a gojūon chart for laptops/tablets — one click per character.
   Exposes window.KanaKeyboard.create({ mount, input, onEnter, canType }).
   ========================================================================== */
(() => {
  "use strict";

  const PREFS_KEY = "hiragana-dojo-keyboard-v1";
  const TAP_TIMEOUT = 1000; // multi-tap commits after this many ms
  const FLICK_DISTANCE = 18;
  const DIRS = ["center", "left", "up", "right", "down"];

  const toKatakana = text => text.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

  // Flick keys: [center, left, up, right, down]; `cycle` is the multi-tap order.
  const FLICK_KEYS = {
    a:  { flick: ["あ", "い", "う", "え", "お"], cycle: "あいうえおぁぃぅぇぉ" },
    ka: { flick: ["か", "き", "く", "け", "こ"] },
    sa: { flick: ["さ", "し", "す", "せ", "そ"] },
    ta: { flick: ["た", "ち", "つ", "て", "と"], cycle: "たちつてとっ" },
    na: { flick: ["な", "に", "ぬ", "ね", "の"] },
    ha: { flick: ["は", "ひ", "ふ", "へ", "ほ"] },
    ma: { flick: ["ま", "み", "む", "め", "も"] },
    ya: { flick: ["や", "", "ゆ", "", "よ"], cycle: "やゆよゃゅょ" },
    ra: { flick: ["ら", "り", "る", "れ", "ろ"] },
    wa: { flick: ["わ", "を", "ん", "ー", ""], cycle: "わをんゎー" },
    pu: { flick: ["、", "。", "？", "！", ""], cycle: "、。？！" }
  };

  // Flick layout: 5 columns × 4 rows, like a phone's Japanese keypad.
  const FLICK_LAYOUT = [
    { act: "next", label: "→", title: "Confirm character (for repeated letters like ああ)", area: "next" },
    { key: "a", area: "a" }, { key: "ka", area: "ka" }, { key: "sa", area: "sa" },
    { act: "backspace", label: "⌫", title: "Delete", area: "bs" },
    { act: "undo", label: "↶", title: "Step back through the last key", area: "undo" },
    { key: "ta", area: "ta" }, { key: "na", area: "na" }, { key: "ha", area: "ha" },
    { act: "clear", label: "Clear", title: "Clear answer", area: "clr" },
    { key: "ma", area: "ma" }, { key: "ya", area: "ya" }, { key: "ra", area: "ra" },
    { act: "enter", label: "⏎", title: "Check answer", area: "ent" },
    { act: "mod", label: "゛゜小", title: "Add ゛/゜ or make small", area: "mod" },
    { key: "wa", area: "wa" }, { key: "pu", area: "pu" }
  ];

  // Grid (gojūon chart) layout, columns あ か さ … わ ん; "" = empty cell.
  const GRID_CHART = [
    ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "ん"],
    ["い", "き", "し", "ち", "に", "ひ", "み", "",   "り", "",   ""],
    ["う", "く", "す", "つ", "ぬ", "ふ", "む", "ゆ", "る", "",   ""],
    ["え", "け", "せ", "て", "ね", "へ", "め", "",   "れ", "",   ""],
    ["お", "こ", "そ", "と", "の", "ほ", "も", "よ", "ろ", "を", ""]
  ];
  const GRID_SMALL = ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "っ", "ゎ", "ー"];

  // ---- Character transforms (゛ ゜ 小) -------------------------------------
  const DAKUTEN = {};
  const HANDAKUTEN = {};
  const SMALL = {};
  "かが きぎ くぐ けげ こご さざ しじ すず せぜ そぞ ただ ちぢ つづ てで とど はば ひび ふぶ へべ ほぼ うゔ"
    .split(" ").forEach(([a, b]) => { DAKUTEN[a] = b; });
  "はぱ ひぴ ふぷ へぺ ほぽ".split(" ").forEach(([a, b]) => { HANDAKUTEN[a] = b; });
  "あぁ いぃ うぅ えぇ おぉ やゃ ゆゅ よょ つっ わゎ".split(" ").forEach(([a, b]) => { SMALL[a] = b; });

  // Cycle used by the flick layout's "゛゜小" key: base → small → ゛ → ゜ → base.
  const MOD_CYCLE = new Map();
  const bases = new Set([...Object.keys(DAKUTEN), ...Object.keys(HANDAKUTEN), ...Object.keys(SMALL)]);
  bases.forEach(base => {
    const cycle = [base, SMALL[base], DAKUTEN[base], HANDAKUTEN[base]].filter(Boolean);
    cycle.forEach((ch, i) => MOD_CYCLE.set(ch, cycle[(i + 1) % cycle.length]));
  });

  const invert = map => Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a]));
  const UN_DAKUTEN = invert(DAKUTEN);
  const UN_HANDAKUTEN = invert(HANDAKUTEN);

  // Work in hiragana internally; convert in/out for katakana.
  const toHira = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  function transformChar(ch, kind) {
    const isKata = /[ァ-ヶ]/.test(ch);
    const h = toHira(ch);
    let out = null;
    if (kind === "mod") out = MOD_CYCLE.get(h);
    else if (kind === "dakuten") {
      // Toggle: か→が→か; ぱ→ば.
      out = DAKUTEN[h] || UN_DAKUTEN[h] || (UN_HANDAKUTEN[h] && DAKUTEN[UN_HANDAKUTEN[h]]);
    } else if (kind === "handakuten") {
      out = HANDAKUTEN[h] || UN_HANDAKUTEN[h] || (UN_DAKUTEN[h] && HANDAKUTEN[UN_DAKUTEN[h]]);
    }
    if (!out) return null;
    return isKata ? toKatakana(out) : out;
  }

  // ---- Prefs -------------------------------------------------------------
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; }
  }
  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) { /* ignore */ }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function create({ mount, input, onEnter, canType = () => true }) {
    const prefs = loadPrefs();
    let script = "hiragana";
    let visible = false;
    let tapState = null; // { keyId, idx, time }

    const conv = text => (script === "katakana" ? toKatakana(text) : text);
    const autoLayout = () =>
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 640) ? "flick" : "grid";
    const layout = () => prefs.layout || autoLayout();

    const root = el("div", "kb");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Japanese keyboard");
    root.hidden = true;
    mount.appendChild(root);

    // ---- Editing primitives (caret-aware) ----
    function caret() {
      const len = input.value.length;
      const start = input.selectionStart ?? len;
      const end = input.selectionEnd ?? len;
      return { start, end };
    }
    function commit(value, pos) {
      input.value = value;
      try { input.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function insert(text) {
      const { start, end } = caret();
      const v = input.value;
      commit(v.slice(0, start) + text + v.slice(end), start + text.length);
    }
    function replaceBeforeCaret(text) {
      const { start } = caret();
      if (start === 0) return insert(text);
      const v = input.value;
      commit(v.slice(0, start - 1) + text + v.slice(start), start - 1 + text.length);
    }
    function charBeforeCaret() {
      const { start } = caret();
      return start > 0 ? input.value[start - 1] : "";
    }
    function backspace() {
      const { start, end } = caret();
      const v = input.value;
      if (start !== end) return commit(v.slice(0, start) + v.slice(end), start);
      if (start === 0) return;
      commit(v.slice(0, start - 1) + v.slice(start), start - 1);
    }
    function modify(kind) {
      const out = transformChar(charBeforeCaret(), kind);
      if (out) replaceBeforeCaret(out);
    }

    function feedbackTap() {
      if (window.Sound) window.Sound.key();
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* ignore */ } }
    }

    function runAction(act) {
      if (act === "enter") { tapState = null; onEnter(); return; }
      if (!canType()) return;
      if (act === "backspace") backspace();
      else if (act === "clear") commit("", 0);
      else if (act === "next") { /* just ends the multi-tap cycle */ }
      else if (act === "mod" || act === "dakuten" || act === "handakuten") modify(act);
      else if (act === "undo" && tapState) {
        const cycle = conv(FLICK_KEYS[tapState.keyId].cycle || FLICK_KEYS[tapState.keyId].flick.join(""));
        if (tapState.idx > 0) {
          tapState.idx -= 1;
          tapState.time = Date.now();
          replaceBeforeCaret(cycle[tapState.idx]);
          return;
        }
      }
      tapState = null;
    }

    // Hold-to-repeat for backspace.
    function bindRepeat(button, fn) {
      let delay = null;
      let repeat = null;
      const stop = () => { clearTimeout(delay); clearInterval(repeat); delay = repeat = null; };
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        button.classList.add("is-pressed");
        feedbackTap();
        fn();
        delay = setTimeout(() => { repeat = setInterval(fn, 70); }, 420);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(type =>
        button.addEventListener(type, () => { button.classList.remove("is-pressed"); stop(); }));
    }

    function bindPress(button, fn) {
      button.addEventListener("pointerdown", event => {
        event.preventDefault(); // keep focus (and the caret) in the answer input
        button.classList.add("is-pressed");
      });
      ["pointerleave", "pointercancel"].forEach(type =>
        button.addEventListener(type, () => button.classList.remove("is-pressed")));
      button.addEventListener("pointerup", () => {
        if (!button.classList.contains("is-pressed")) return;
        button.classList.remove("is-pressed");
        feedbackTap();
        fn();
      });
      // Keyboard activation (Tab + Enter/Space) for accessibility.
      button.addEventListener("click", event => { if (event.detail === 0) fn(); });
    }

    function actionButton(spec, className) {
      const button = el("button", `kb-key kb-action ${className || ""}`.trim(), spec.label);
      button.type = "button";
      button.tabIndex = -1;
      button.title = spec.title || spec.label;
      button.setAttribute("aria-label", spec.title || spec.label);
      if (spec.act === "enter") button.classList.add("kb-enter");
      if (spec.act === "backspace") bindRepeat(button, () => runAction("backspace"));
      else bindPress(button, () => runAction(spec.act));
      return button;
    }

    // ---- Flick layout ----
    function flickKey(keyId) {
      const spec = FLICK_KEYS[keyId];
      const chars = spec.flick.map(conv);
      const cycle = conv(spec.cycle || spec.flick.join(""));
      const button = el("button", "kb-key kb-flick-key");
      button.type = "button";
      button.tabIndex = -1;
      button.setAttribute("aria-label", chars.filter(Boolean).join(" "));
      button.lang = "ja";
      const main = el("span", "kb-main", chars[0]);
      button.appendChild(main);
      // Faint hints of the flick directions around the main character.
      ["left", "up", "right", "down"].forEach((dir, i) => {
        if (chars[i + 1]) button.appendChild(el("span", `kb-hint kb-hint-${dir}`, chars[i + 1]));
      });
      const guide = el("span", "kb-guide");
      guide.setAttribute("aria-hidden", "true");
      const guideCells = {};
      DIRS.forEach((dir, i) => {
        const cell = el("span", `kb-guide-cell kb-guide-${dir}`, chars[i] || "");
        if (!chars[i]) cell.classList.add("is-empty");
        guideCells[dir] = cell;
        guide.appendChild(cell);
      });
      button.appendChild(guide);

      let start = null;
      let dir = "center";
      const setDir = next => {
        dir = next;
        DIRS.forEach(d => guideCells[d].classList.toggle("is-active", d === dir));
      };
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        try { button.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
        start = { x: event.clientX, y: event.clientY };
        setDir("center");
        button.classList.add("is-pressed", "show-guide");
        feedbackTap();
      });
      button.addEventListener("pointermove", event => {
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) < FLICK_DISTANCE) setDir("center");
        else if (Math.abs(dx) > Math.abs(dy)) setDir(dx < 0 ? "left" : "right");
        else setDir(dy < 0 ? "up" : "down");
      });
      const end = commitIt => {
        if (!start) return;
        start = null;
        button.classList.remove("is-pressed", "show-guide");
        if (!commitIt || !canType()) return;
        if (dir === "center") {
          const now = Date.now();
          if (tapState && tapState.keyId === keyId && now - tapState.time < TAP_TIMEOUT
              && charBeforeCaret() === cycle[tapState.idx]) {
            tapState.idx = (tapState.idx + 1) % cycle.length;
            tapState.time = now;
            replaceBeforeCaret(cycle[tapState.idx]);
          } else {
            tapState = { keyId, idx: 0, time: now };
            insert(cycle[0]);
          }
        } else {
          const ch = chars[DIRS.indexOf(dir)];
          tapState = null;
          if (ch) insert(ch);
        }
      };
      button.addEventListener("pointerup", () => end(true));
      button.addEventListener("pointercancel", () => end(false));
      button.addEventListener("click", event => {
        if (event.detail === 0 && canType()) { tapState = null; insert(chars[0]); }
      });
      return button;
    }

    function buildFlick(container) {
      const pad = el("div", "kb-flick");
      FLICK_LAYOUT.forEach(spec => {
        const node = spec.key ? flickKey(spec.key) : actionButton(spec);
        node.style.gridArea = spec.area;
        pad.appendChild(node);
      });
      container.appendChild(pad);
    }

    // ---- Grid layout ----
    function charButton(ch, extra) {
      const button = el("button", `kb-key kb-char ${extra || ""}`.trim(), conv(ch));
      button.type = "button";
      button.tabIndex = -1;
      button.lang = "ja";
      bindPress(button, () => { if (canType()) { tapState = null; insert(conv(ch)); } });
      return button;
    }

    function buildGrid(container) {
      const chart = el("div", "kb-grid");
      GRID_CHART.forEach(row => row.forEach(ch => {
        chart.appendChild(ch ? charButton(ch) : el("span", "kb-empty"));
      }));
      GRID_SMALL.forEach(ch => chart.appendChild(charButton(ch, "kb-small")));
      const actions = [
        { act: "dakuten", label: "゛", title: "Add dakuten (か → が)", cls: "kb-mod" },
        { act: "handakuten", label: "゜", title: "Add handakuten (は → ぱ)", cls: "kb-mod" },
        { act: "mod", label: "小", title: "Make small / cycle (つ → っ)", cls: "kb-mod" },
        { act: "clear", label: "Clear", title: "Clear answer", cls: "kb-span-2" },
        { act: "backspace", label: "⌫", title: "Delete", cls: "kb-span-2" },
        { act: "enter", label: "Check ⏎", title: "Check answer", cls: "kb-span-4" }
      ];
      actions.forEach(spec => chart.appendChild(actionButton(spec, spec.cls)));
      container.appendChild(chart);
    }

    // ---- Chrome (header bar) ----
    function render() {
      root.innerHTML = "";
      const current = layout();
      root.dataset.layout = current;
      // The flick keypad is pinned to the viewport; it must live outside any
      // transformed ancestor (page animations) or position:fixed breaks.
      const parent = current === "flick" ? document.body : mount;
      if (root.parentNode !== parent) parent.appendChild(root);
      root.dataset.script = script;
      root.classList.toggle("is-collapsed", !!prefs.collapsed);

      const bar = el("div", "kb-bar");
      const label = el("span", "kb-label");
      const badge = el("span", "kb-badge", script === "katakana" ? "カナ" : "かな");
      badge.lang = "ja";
      label.append(badge, document.createTextNode(script === "katakana" ? "Katakana" : "Hiragana"));
      const tools = el("div", "kb-tools");
      const layoutBtn = el("button", "kb-tool", current === "flick" ? "▦ Chart" : "▤ Flick");
      layoutBtn.type = "button";
      layoutBtn.title = current === "flick" ? "Switch to the full kana chart" : "Switch to the phone-style flick keypad";
      layoutBtn.addEventListener("pointerdown", e => e.preventDefault());
      layoutBtn.addEventListener("click", () => {
        prefs.layout = current === "flick" ? "grid" : "flick";
        savePrefs(prefs);
        render();
      });
      const hideBtn = el("button", "kb-tool", prefs.collapsed ? "⌨ Show" : "Hide");
      hideBtn.type = "button";
      hideBtn.title = prefs.collapsed
        ? "Show the on-screen kana keyboard"
        : "Hide it and use your device's own Japanese keyboard";
      hideBtn.addEventListener("click", () => {
        prefs.collapsed = !prefs.collapsed;
        savePrefs(prefs);
        render();
        syncInputMode(true);
      });
      if (!prefs.collapsed) tools.append(layoutBtn);
      tools.append(hideBtn);
      bar.append(label, tools);
      root.appendChild(bar);

      if (!prefs.collapsed) {
        const keys = el("div", "kb-keys");
        if (current === "flick") buildFlick(keys);
        else buildGrid(keys);
        root.appendChild(keys);
      }
      updateSpace();
    }

    // Stop the phone's own keyboard from opening while ours is visible.
    function syncInputMode(refocus) {
      const wanted = visible && !prefs.collapsed ? "none" : "text";
      if (input.inputMode === wanted) return;
      input.inputMode = wanted;
      if (refocus && document.activeElement === input) {
        input.blur();
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
      }
    }

    // Reserve room at the bottom of the page for the fixed flick keypad.
    function updateSpace() {
      const fixed = visible && root.dataset.layout === "flick";
      const height = fixed ? root.offsetHeight : 0;
      document.documentElement.style.setProperty("--kb-space", `${height}px`);
      document.body.classList.toggle("kb-open", visible && !prefs.collapsed);
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(updateSpace).observe(root);

    let lastAuto = autoLayout();
    window.addEventListener("resize", () => {
      const now = autoLayout();
      if (!prefs.layout && now !== lastAuto && visible) render();
      lastAuto = now;
    });

    return {
      show(nextScript) {
        const changed = !visible || nextScript !== script;
        script = nextScript;
        visible = true;
        tapState = null;
        root.hidden = false;
        if (changed || root.dataset.layout !== layout()) render();
        syncInputMode(true);
        updateSpace();
      },
      hide() {
        visible = false;
        tapState = null;
        root.hidden = true;
        syncInputMode(true);
        updateSpace();
      },
      resetTap() { tapState = null; }
    };
  }

  window.KanaKeyboard = { create, transformChar };
})();
