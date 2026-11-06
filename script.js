(() => {
  "use strict";

  const STORAGE_KEYS = {
    selection: "hiragana-dojo-selection-v2",
    modes: "hiragana-dojo-modes-v2",
    theme: "hiragana-dojo-theme-v2",
    tab: "hiragana-dojo-tab-v2"
  };

  // ---- Character data ----------------------------------------------------
  // Each group is one row of the kana chart. `kind` decides its section.
  // Hiragana is the source of truth; katakana is derived (Unicode offset 0x60).
  const row = (kind, ...letters) => ({ kind, letters });
  const hiraganaGroups = [
    row("basic", ["あ","a"],["い","i"],["う","u"],["え","e"],["お","o"]),
    row("basic", ["か","ka"],["き","ki"],["く","ku"],["け","ke"],["こ","ko"]),
    row("basic", ["さ","sa"],["し","shi"],["す","su"],["せ","se"],["そ","so"]),
    row("basic", ["た","ta"],["ち","chi"],["つ","tsu"],["て","te"],["と","to"]),
    row("basic", ["な","na"],["に","ni"],["ぬ","nu"],["ね","ne"],["の","no"]),
    row("basic", ["は","ha"],["ひ","hi"],["ふ","fu"],["へ","he"],["ほ","ho"]),
    row("basic", ["ま","ma"],["み","mi"],["む","mu"],["め","me"],["も","mo"]),
    row("basic", ["や","ya"],["ゆ","yu"],["よ","yo"]),
    row("basic", ["ら","ra"],["り","ri"],["る","ru"],["れ","re"],["ろ","ro"]),
    row("basic", ["わ","wa"],["を","wo"]),
    row("basic", ["ん","n"]),
    row("dakuten", ["が","ga"],["ぎ","gi"],["ぐ","gu"],["げ","ge"],["ご","go"]),
    row("dakuten", ["ざ","za"],["じ","ji"],["ず","zu"],["ぜ","ze"],["ぞ","zo"]),
    row("dakuten", ["だ","da"],["ぢ","ji"],["づ","zu"],["で","de"],["ど","do"]),
    row("dakuten", ["ば","ba"],["び","bi"],["ぶ","bu"],["べ","be"],["ぼ","bo"]),
    row("dakuten", ["ぱ","pa"],["ぴ","pi"],["ぷ","pu"],["ぺ","pe"],["ぽ","po"]),
    row("combo", ["きゃ","kya"],["きゅ","kyu"],["きょ","kyo"]),
    row("combo", ["しゃ","sha"],["しゅ","shu"],["しょ","sho"]),
    row("combo", ["ちゃ","cha"],["ちゅ","chu"],["ちょ","cho"]),
    row("combo", ["にゃ","nya"],["にゅ","nyu"],["にょ","nyo"]),
    row("combo", ["ひゃ","hya"],["ひゅ","hyu"],["ひょ","hyo"]),
    row("combo", ["みゃ","mya"],["みゅ","myu"],["みょ","myo"]),
    row("combo", ["りゃ","rya"],["りゅ","ryu"],["りょ","ryo"]),
    row("combo", ["ぎゃ","gya"],["ぎゅ","gyu"],["ぎょ","gyo"]),
    row("combo", ["じゃ","ja"],["じゅ","ju"],["じょ","jo"]),
    row("combo", ["びゃ","bya"],["びゅ","byu"],["びょ","byo"]),
    row("combo", ["ぴゃ","pya"],["ぴゅ","pyu"],["ぴょ","pyo"])
  ];

  const toKatakana = text => text.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const toHiragana = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  const katakanaGroups = hiraganaGroups.map(group => ({
    ...group,
    letters: group.letters.map(([kana, romaji]) => [toKatakana(kana), romaji])
  }));
  katakanaGroups.push(row("extended",
    ["ファ","fa"],["フィ","fi"],["フェ","fe"],["フォ","fo"],["ヴ","vu"],
    ["ティ","ti"],["ディ","di"],["トゥ","tu"],["ドゥ","du"],["チェ","che"],
    ["シェ","she"],["ジェ","je"],["ウィ","wi"],["ウェ","we"],["ウォ","wo"]
  ));

  const SCRIPTS = {
    hiragana: { label: "Hiragana", native: "ひらがな", groups: hiraganaGroups },
    katakana: { label: "Katakana", native: "カタカナ", groups: katakanaGroups }
  };
  const SCRIPT_ORDER = ["hiragana", "katakana"];

  // Sections of the chart. `flat` sections are a simple grid (no a·i·u·e·o columns).
  const SECTIONS = [
    { kind: "basic", title: "Basic" },
    { kind: "dakuten", title: "Dakuten", note: "゛゜" },
    { kind: "combo", title: "Combinations", columns: "auo" },
    { kind: "extended", title: "Extended", note: "foreign sounds", flat: true }
  ];

  const allLetters = SCRIPT_ORDER.flatMap(script =>
    SCRIPTS[script].groups.flatMap(group =>
      group.letters.map(([kana, romaji]) => ({ kana, romaji, script, kind: group.kind }))
    )
  );
  const byKana = new Map(allLetters.map(item => [item.kana, item]));
  const lettersOf = script => allLetters.filter(item => item.script === script).map(item => item.kana);

  // Chart column from the romaji's final vowel; ん goes in the first column.
  const columnOf = (romaji, columns) => Math.max(0, columns.indexOf(romaji.slice(-1)));

  // Alternative romanizations accepted when reading.
  const ROMAJI_ALIASES = {
    shi: ["si"], chi: ["ti"], tsu: ["tu"], fu: ["hu"], ji: ["zi"], n: ["nn"],
    sha: ["sya"], shu: ["syu"], sho: ["syo"],
    cha: ["tya", "cya"], chu: ["tyu", "cyu"], cho: ["tyo", "cyo"],
    ja: ["jya", "zya"], ju: ["jyu", "zyu"], jo: ["jyo", "zyo"],
    she: ["sye"], je: ["jye", "zye"], che: ["tye", "cye"]
  };
  const KANA_ALIASES = { "ぢ": ["di"], "づ": ["du"], "を": ["o"] };

  // Sound effects (sound.js). The stub keeps the app working without Web Audio.
  const noop = () => {};
  const sfx = window.Sound || {
    tap: noop, select: noop, key: noop, start: noop, correct: noop, correctSoft: noop,
    wrong: noop, reveal: noop, back: noop, complete: noop, isMuted: () => true, setMuted: noop
  };

  // ---- DOM ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const kanaGroups = $("kanaGroups");
  const homePage = $("homePage");
  const startBar = $("startBar");
  const practiceButton = $("practiceButton");
  const quizPanel = $("quizPanel");
  const questionCard = document.querySelector(".question-card");
  const answerForm = $("answerForm");
  const answerInput = $("answerInput");
  const feedback = $("feedback");
  const revealButton = $("revealButton");
  const nextButton = $("nextButton");
  const completion = $("completion");
  const tabButtons = [...document.querySelectorAll(".script-tab")];
  const modeButtons = [...document.querySelectorAll(".mode-button")];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- State -------------------------------------------------------------
  let selectedKanas = new Set(lettersOf("hiragana").filter(k => byKana.get(k).kind === "basic"));
  let activeScript = "hiragana";
  let mode = "both";
  let questions = [];
  let lastQuestionPool = [];
  let missedQuestions = [];
  let questionIndex = 0;
  let correctCount = 0;
  let streak = 0; // first-try correct answers in a row
  let answeredCurrent = false;
  let missedCurrent = false;
  let advanceTimer = null;
  let rowControls = [];
  let sectionControls = [];

  const kanaKeyboard = window.KanaKeyboard.create({
    mount: $("kanaKeyboard"),
    input: answerInput,
    canType: () => !answeredCurrent,
    onEnter: () => checkAnswer()
  });

  // ---- Storage -----------------------------------------------------------
  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* ignore */ }
  }
  function loadJSON(key, fallback) {
    try {
      const raw = safeGet(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  }

  function loadPreferences() {
    const savedSelection = loadJSON(STORAGE_KEYS.selection, null);
    if (Array.isArray(savedSelection)) {
      selectedKanas = new Set(savedSelection.filter(kana => byKana.has(kana)));
    }
    const savedModes = loadJSON(STORAGE_KEYS.modes, null);
    if (savedModes && typeof savedModes === "object") {
      const read = savedModes.read !== false;
      const write = savedModes.write !== false;
      mode = read && write ? "both" : write ? "write" : "read";
    }
    const savedTab = safeGet(STORAGE_KEYS.tab);
    if (savedTab && SCRIPTS[savedTab]) activeScript = savedTab;
  }

  const persistSelection = () => safeSet(STORAGE_KEYS.selection, JSON.stringify([...selectedKanas]));
  const persistMode = () => safeSet(STORAGE_KEYS.modes, JSON.stringify({
    read: mode !== "write",
    write: mode !== "read"
  }));

  // ---- Selection ---------------------------------------------------------
  const countSelected = kanas => kanas.filter(kana => selectedKanas.has(kana)).length;
  const selectedIn = script => countSelected(lettersOf(script));

  function setMany(kanas, on) {
    sfx.select(on);
    kanas.forEach(kana => on ? selectedKanas.add(kana) : selectedKanas.delete(kana));
    persistSelection();
    refreshSelection();
  }

  function kanaTile([kana, romaji]) {
    const tile = el("button", "kana-tile");
    tile.type = "button";
    tile.dataset.kana = kana;
    tile.setAttribute("aria-label", `${kana} ${romaji}`);
    const character = el("span", "kana-character", kana);
    character.lang = "ja";
    tile.append(character, el("span", "kana-romaji", romaji));
    tile.addEventListener("click", () => setMany([kana], !selectedKanas.has(kana)));
    return tile;
  }

  function renderLetters() {
    kanaGroups.innerHTML = "";
    kanaGroups.setAttribute("aria-labelledby", `tab-${activeScript}`);
    homePage.dataset.script = activeScript;
    rowControls = [];
    sectionControls = [];

    SECTIONS.forEach(sectionSpec => {
      const groups = SCRIPTS[activeScript].groups.filter(group => group.kind === sectionSpec.kind);
      if (!groups.length) return;
      const kanas = groups.flatMap(group => group.letters.map(([kana]) => kana));

      const section = el("section", "kana-section");
      const head = el("div", "section-head");
      const title = el("h2", "section-title", sectionSpec.title);
      if (sectionSpec.note) {
        const note = el("span", "section-note", sectionSpec.note);
        note.lang = "ja";
        title.append(" ", note);
      }
      const count = el("span", "section-count");
      const toggle = el("button", "text-button section-toggle");
      toggle.type = "button";
      toggle.addEventListener("click", () => setMany(kanas, countSelected(kanas) !== kanas.length));
      head.append(title, count, toggle);
      sectionControls.push({ count, toggle, kanas, title: sectionSpec.title });

      const body = el("div", sectionSpec.flat ? "kana-flat" : "kana-chart");
      groups.forEach(group => {
        if (sectionSpec.flat) {
          group.letters.forEach(letter => body.appendChild(kanaTile(letter)));
          return;
        }
        const rowKanas = group.letters.map(([kana]) => kana);
        const columns = sectionSpec.columns || "aiueo";
        const rowEl = el("div", `kana-row cols-${columns.length}`);
        const rowToggle = el("button", "row-toggle", group.letters[0][0]);
        rowToggle.type = "button";
        rowToggle.lang = "ja";
        rowToggle.title = "Select the whole row";
        rowToggle.addEventListener("click", () =>
          setMany(rowKanas, countSelected(rowKanas) !== rowKanas.length));
        rowControls.push({ el: rowToggle, kanas: rowKanas });
        rowEl.appendChild(rowToggle);
        const cells = new Array(columns.length).fill(null);
        group.letters.forEach(letter => { cells[columnOf(letter[1], columns)] = letter; });
        cells.forEach(letter => rowEl.appendChild(letter ? kanaTile(letter) : el("span", "kana-gap")));
        body.appendChild(rowEl);
      });

      section.append(head, body);
      kanaGroups.appendChild(section);
    });
    refreshSelection();
  }

  // Update every selection indicator in place (no re-render, keeps focus).
  function refreshSelection() {
    kanaGroups.querySelectorAll(".kana-tile").forEach(tile => {
      tile.setAttribute("aria-pressed", String(selectedKanas.has(tile.dataset.kana)));
    });
    rowControls.forEach(({ el: button, kanas }) => {
      const n = countSelected(kanas);
      button.classList.toggle("is-full", n === kanas.length);
      button.classList.toggle("is-partial", n > 0 && n < kanas.length);
      button.setAttribute("aria-label", `${n === kanas.length ? "Clear" : "Select"} row ${kanas[0]}`);
    });
    sectionControls.forEach(({ count, toggle, kanas, title }) => {
      const n = countSelected(kanas);
      count.textContent = `${n}/${kanas.length}`;
      toggle.textContent = n === kanas.length ? "Clear" : "Select all";
      toggle.setAttribute("aria-label", `${toggle.textContent} ${title}`);
    });

    const scriptLetters = lettersOf(activeScript);
    const inScript = countSelected(scriptLetters);
    $("selectionSummary").textContent = `${inScript} of ${scriptLetters.length} selected`;
    $("selectAll").disabled = inScript === scriptLetters.length;
    $("selectNone").disabled = inScript === 0;
    SCRIPT_ORDER.forEach(script => {
      const n = selectedIn(script);
      const badge = $(`tabCount-${script}`);
      badge.textContent = String(n);
      badge.hidden = n === 0;
    });

    const total = selectedKanas.size;
    practiceButton.disabled = total === 0;
    practiceButton.textContent = total === 0 ? "Select characters" : `Start · ${total}`;
  }

  function setActiveScript(script, { focus = false } = {}) {
    if (!SCRIPTS[script]) return;
    activeScript = script;
    safeSet(STORAGE_KEYS.tab, script);
    tabButtons.forEach(button => {
      const isActive = button.dataset.script === script;
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) button.focus();
    });
    renderLetters();
  }

  function setMode(next) {
    mode = next;
    persistMode();
    modeButtons.forEach(button => {
      const on = button.dataset.mode === mode;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    });
  }

  // ---- Routing -----------------------------------------------------------
  function navigate(route) {
    if (location.hash !== route) location.hash = route;
    else renderRoute();
  }

  function renderRoute() {
    const onPractice = location.hash === "#/practice" && questions.length > 0;
    if (location.hash === "#/practice" && !onPractice) {
      location.hash = "#/";
      return;
    }
    homePage.hidden = onPractice;
    startBar.hidden = onPractice;
    quizPanel.hidden = !onPractice;
    document.body.classList.toggle("is-practicing", onPractice);
    (onPractice ? quizPanel : homePage).classList.remove("page-enter");
    void quizPanel.offsetWidth;
    (onPractice ? quizPanel : homePage).classList.add("page-enter");
    window.scrollTo({ top: 0, behavior: "auto" });
    if (!onPractice) kanaKeyboard.hide();
    if (onPractice && completion.hidden) focusAnswerInput();
  }

  // ---- Session -----------------------------------------------------------
  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildQuestions() {
    const result = [];
    allLetters.filter(item => selectedKanas.has(item.kana)).forEach(item => {
      if (mode !== "write") result.push({ type: "read", ...item });
      if (mode !== "read") result.push({ type: "write", ...item });
    });
    return result;
  }

  function startSession(pool) {
    if (!pool.length) return;
    clearAdvanceTimer();
    lastQuestionPool = pool;
    questions = shuffle(pool);
    missedQuestions = [];
    questionIndex = 0;
    correctCount = 0;
    streak = 0;
    sfx.start();
    completion.hidden = true;
    questionCard.hidden = false;
    navigate("#/practice");
    renderQuestion();
  }

  function startPractice() {
    if (selectedKanas.size === 0) return;
    startSession(buildQuestions());
  }

  function setFeedback(text, kind) {
    feedback.textContent = text;
    feedback.className = `feedback${kind ? ` is-${kind}` : ""}`;
    feedback.lang = kind === "reveal" ? "ja" : "en";
  }

  function renderQuestion() {
    clearAdvanceTimer();
    if (questionIndex >= questions.length) {
      showCompletion();
      return;
    }
    const question = questions[questionIndex];
    const script = SCRIPTS[question.script];
    const isRead = question.type === "read";
    answeredCurrent = false;
    missedCurrent = false;

    const typeLabel = $("questionType");
    typeLabel.textContent = isRead ? "Type the romaji" : `Write in ${script.label.toLowerCase()}`;
    typeLabel.dataset.script = question.script;
    quizPanel.dataset.script = question.script;

    const display = $("questionDisplay");
    display.textContent = isRead ? question.kana : question.romaji;
    display.lang = isRead ? "ja" : "en";
    display.classList.toggle("is-romaji", !isRead);
    display.classList.remove("animate-in");
    void display.offsetWidth;
    display.classList.add("animate-in");

    answerInput.value = "";
    answerInput.className = "answer-input";
    answerInput.lang = isRead ? "en" : "ja";
    answerInput.placeholder = isRead ? "romaji" : script.native;
    if (isRead) kanaKeyboard.hide();
    else kanaKeyboard.show(question.script);
    quizPanel.classList.toggle("is-writing", !isRead);

    // The Check button never disappears (no layout jump); it just changes state.
    answerForm.classList.remove("is-correct", "is-done");
    setFeedback("");
    revealButton.hidden = false;
    nextButton.hidden = true;

    $("progressLabel").textContent = `${questionIndex + 1}/${questions.length}`;
    $("progressBar").style.width = `${(questionIndex / questions.length) * 100}%`;
    focusAnswerInput();
  }

  // ---- Answer checking ---------------------------------------------------
  const normalizeRomaji = value => value.trim().toLowerCase().replace(/[\s'’-]+/g, "");
  // NFKC folds half-width katakana (ｶ) into full width (カ).
  const normalizeKana = value => value.trim().replace(/\s+/g, "").normalize("NFKC");

  function acceptedRomaji(question) {
    const accepted = new Set([question.romaji]);
    (ROMAJI_ALIASES[question.romaji] || []).forEach(alias => accepted.add(alias));
    (KANA_ALIASES[toHiragana(question.kana)] || []).forEach(alias => accepted.add(alias));
    return accepted;
  }

  // Writing also accepts a same-script kana with the same romaji (じ/ぢ, ず/づ).
  function answerIsCorrect(actual, question) {
    if (question.type === "read") return acceptedRomaji(question).has(normalizeRomaji(actual));
    const typed = normalizeKana(actual);
    if (typed === question.kana) return true;
    const match = byKana.get(typed);
    return !!match && match.script === question.script && match.romaji === question.romaji;
  }

  function wrongScriptHint(actual, question) {
    if (question.type !== "write") return null;
    const typed = normalizeKana(actual);
    const other = question.script === "hiragana" ? toHiragana(typed) : toKatakana(typed);
    return other !== typed && answerIsCorrect(other, question)
      ? `Right sound — but use ${SCRIPTS[question.script].label.toLowerCase()}`
      : null;
  }

  function markMissed(question) {
    if (missedCurrent) return;
    missedCurrent = true;
    missedQuestions.push(question);
  }

  function handleResult(isCorrect) {
    const question = questions[questionIndex];
    if (isCorrect) {
      answeredCurrent = true;
      answerInput.className = "answer-input is-correct";
      answerForm.classList.add("is-correct"); // turns Check into an animated ✓
      revealButton.hidden = true;
      if (missedCurrent) {
        sfx.correctSoft();
        setFeedback("Got it 👍", "correct");
      } else {
        correctCount++;
        streak++;
        sfx.correct(streak);
        setFeedback(streak >= 3 ? `${streak} in a row 🔥` : "Correct!", "correct");
      }
      scheduleAutoAdvance();
    } else {
      markMissed(question);
      streak = 0;
      sfx.wrong();
      answerInput.className = "answer-input";
      void answerInput.offsetWidth; // restart the shake animation
      answerInput.className = "answer-input is-wrong";
      setFeedback(wrongScriptHint(answerInput.value, question) || "Not quite — try again", "wrong");
      answerInput.focus();
      answerInput.select();
    }
  }

  function checkAnswer(event) {
    if (event) event.preventDefault();
    if (answeredCurrent) {
      // Enter after a correct answer or a reveal moves on.
      if (questionIndex < questions.length) nextQuestion();
      return;
    }
    if (!answerInput.value.trim()) return;
    handleResult(answerIsCorrect(answerInput.value, questions[questionIndex]));
  }

  function tryAutoCheck() {
    if (answeredCurrent || questionIndex >= questions.length) return;
    if (answerInput.classList.contains("is-wrong")) answerInput.className = "answer-input";
    if (answerIsCorrect(answerInput.value, questions[questionIndex])) handleResult(true);
  }

  function revealAnswer() {
    const question = questions[questionIndex];
    markMissed(question);
    streak = 0;
    sfx.reveal();
    answeredCurrent = true;
    answerInput.className = "answer-input";
    answerForm.classList.add("is-done");
    revealButton.hidden = true;
    setFeedback(question.type === "read"
      ? `${question.kana} = ${question.romaji}`
      : `${question.romaji} = ${question.kana}`, "reveal");
    nextButton.hidden = false;
    nextButton.focus({ preventScroll: true });
  }

  function scheduleAutoAdvance() {
    clearAdvanceTimer();
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      nextQuestion();
    }, 650);
  }

  function clearAdvanceTimer() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function nextQuestion() {
    clearAdvanceTimer();
    questionIndex++;
    renderQuestion();
  }

  // Keep the input focused and visible (above mobile keyboards, or with the
  // whole inline chart keyboard in view on laptops).
  function focusAnswerInput() {
    const alreadyFocused = document.activeElement === answerInput;
    const doScroll = () => {
      const inlineKb = document.querySelector(".kb-mount > .kb:not([hidden])");
      (inlineKb || answerInput).scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    };
    if (alreadyFocused) {
      requestAnimationFrame(doScroll);
    } else {
      requestAnimationFrame(() => answerInput.focus({ preventScroll: true }));
      setTimeout(doScroll, 350);
    }
  }

  // ---- Completion --------------------------------------------------------
  function renderMissed() {
    const list = $("missedList");
    list.innerHTML = "";
    const unique = new Map();
    missedQuestions.forEach(q => unique.set(q.kana, q));
    unique.forEach(q => {
      const chip = el("span", "missed-chip");
      chip.dataset.script = q.script;
      const kana = el("strong", null, q.kana);
      kana.lang = "ja";
      chip.append(kana, el("small", null, q.romaji));
      list.appendChild(chip);
    });
    $("missedReview").hidden = unique.size === 0;
    const hasMissed = missedQuestions.length > 0;
    $("practiceMissed").hidden = !hasMissed;
    const again = $("practiceAgain");
    again.classList.toggle("button-primary", !hasMissed);
    again.classList.toggle("button-quiet", hasMissed);
  }

  function showCompletion() {
    const total = questions.length;
    const percent = total ? Math.round(correctCount / total * 100) : 0;
    questionCard.hidden = true;
    kanaKeyboard.hide();
    quizPanel.classList.remove("is-writing");
    completion.hidden = false;
    $("progressLabel").textContent = `${total}/${total}`;
    $("progressBar").style.width = "100%";

    const score = $("completionScore");
    score.textContent = `${correctCount}/${total}`;
    score.classList.toggle("is-perfect", percent === 100);
    $("completionTitle").textContent =
      percent === 100 ? "Perfect! 完璧" :
      percent >= 80 ? "Great job! お疲れさま" :
      percent >= 50 ? "Nice work — keep going" :
      "Good start — practice makes perfect";
    $("completionSummary").textContent = `${percent}% right on the first try`;
    renderMissed();
    completion.classList.remove("page-enter");
    void completion.offsetWidth;
    completion.classList.add("page-enter");
    launchConfetti(percent === 100 ? 100 : percent >= 80 ? 40 : 0);
    sfx.complete(percent);
    ($("practiceMissed").hidden ? $("practiceAgain") : $("practiceMissed")).focus();
  }

  function launchConfetti(count) {
    const holder = $("confetti");
    holder.innerHTML = "";
    if (!count || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#6354e8", "#16845b", "#e85d6f", "#f2b53c", "#4aa3f0", "#e8743c"];
    for (let i = 0; i < count; i++) {
      const piece = el("span", "confetti-piece");
      const size = 6 + Math.random() * 6;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${size}px`;
      piece.style.height = `${Math.random() > 0.5 ? size : size * 1.6}px`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.animationDuration = `${1.4 + Math.random()}s`;
      piece.style.setProperty("--x", `${Math.random() * 140 - 70}px`);
      piece.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
      holder.appendChild(piece);
    }
    setTimeout(() => { holder.innerHTML = ""; }, 3000);
  }

  function exitPractice() {
    clearAdvanceTimer();
    sfx.back();
    kanaKeyboard.hide();
    navigate("#/");
    questionCard.hidden = false;
    completion.hidden = true;
  }

  // ---- Sound (mute button; effects are synthesized in sound.js) ----------
  function renderSoundToggle() {
    const off = sfx.isMuted();
    $("soundIcon").innerHTML = off ? ICONS.soundOff : ICONS.soundOn;
    $("soundToggle").setAttribute("aria-label", off ? "Turn sound on" : "Turn sound off");
    $("soundToggle").setAttribute("aria-pressed", String(!off));
  }

  // ---- Theme -------------------------------------------------------------
  const ICONS = {
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    soundOn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  };
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    safeSet(STORAGE_KEYS.theme, theme);
    const isDark = theme === "dark";
    $("themeIcon").innerHTML = isDark ? ICONS.sun : ICONS.moon;
    $("themeToggle").setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? "#11131b" : "#f6f7fb";
  }

  // ---- Init --------------------------------------------------------------
  setTheme(safeGet(STORAGE_KEYS.theme) || document.documentElement.dataset.theme || "light");
  loadPreferences();
  setMode(mode);
  setActiveScript(activeScript);
  if (location.hash !== "#/") location.hash = "#/";
  renderRoute();
  window.addEventListener("hashchange", renderRoute);

  // Arrow-key navigation for a group of buttons (tabs, mode switch).
  function arrowNav(buttons, activate) {
    buttons.forEach((button, index) => {
      button.addEventListener("keydown", event => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const target = buttons[(index + step + buttons.length) % buttons.length];
        activate(target);
        target.focus();
      });
    });
  }

  const switchTab = button => { if (button.dataset.script !== activeScript) sfx.tap(); setActiveScript(button.dataset.script); };
  const switchMode = button => { if (button.dataset.mode !== mode) sfx.tap(); setMode(button.dataset.mode); };
  tabButtons.forEach(button => button.addEventListener("click", () => switchTab(button)));
  arrowNav(tabButtons, switchTab);
  modeButtons.forEach(button => button.addEventListener("click", () => switchMode(button)));
  arrowNav(modeButtons, switchMode);

  $("selectAll").addEventListener("click", () => setMany(lettersOf(activeScript), true));
  $("selectNone").addEventListener("click", () => setMany(lettersOf(activeScript), false));

  practiceButton.addEventListener("click", startPractice);
  answerForm.addEventListener("submit", checkAnswer);

  // Auto-check as soon as the answer is right. Many mobile keyboards report
  // isComposing=true even for plain romaji, so use a short delayed fallback.
  let autoCheckTimer = null;
  answerInput.addEventListener("input", event => {
    if (!event.isComposing) {
      tryAutoCheck();
    } else {
      clearTimeout(autoCheckTimer);
      autoCheckTimer = setTimeout(tryAutoCheck, 120);
    }
  });
  answerInput.addEventListener("compositionend", () => {
    clearTimeout(autoCheckTimer);
    tryAutoCheck();
  });

  revealButton.addEventListener("click", revealAnswer);
  nextButton.addEventListener("click", nextQuestion);
  $("exitPractice").addEventListener("click", exitPractice);
  $("practiceAgain").addEventListener("click", () => startSession(lastQuestionPool));
  $("practiceMissed").addEventListener("click", () => startSession([...missedQuestions]));
  $("backToSelection").addEventListener("click", exitPractice);
  $("soundToggle").addEventListener("click", () => {
    sfx.setMuted(!sfx.isMuted());
    renderSoundToggle();
  });
  renderSoundToggle();
  $("themeToggle").addEventListener("click", () => {
    sfx.tap();
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  // Keyboard shortcuts: Esc leaves practice; Enter starts / repeats.
  document.addEventListener("keydown", event => {
    const onPractice = location.hash === "#/practice";
    if (event.key === "Escape" && onPractice) {
      exitPractice();
      return;
    }
    if (event.key !== "Enter") return;
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(active.tagName)) return;
    if (onPractice && !completion.hidden) {
      event.preventDefault();
      startSession(lastQuestionPool);
    } else if (!onPractice) {
      event.preventDefault();
      startPractice();
    }
  });
})();
