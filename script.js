(() => {
  "use strict";

  const STORAGE_KEYS = {
    selection: "hiragana-dojo-selection-v2",
    modes: "hiragana-dojo-modes-v2",
    theme: "hiragana-dojo-theme-v2"
  };

  const groups = [
    { name: "Vowels", note: "あ行", letters: [["あ","a"],["い","i"],["う","u"],["え","e"],["お","o"]] },
    { name: "K row", note: "か行", letters: [["か","ka"],["き","ki"],["く","ku"],["け","ke"],["こ","ko"]] },
    { name: "S row", note: "さ行", letters: [["さ","sa"],["し","shi"],["す","su"],["せ","se"],["そ","so"]] },
    { name: "T row", note: "た行", letters: [["た","ta"],["ち","chi"],["つ","tsu"],["て","te"],["と","to"]] },
    { name: "N row", note: "な行", letters: [["な","na"],["に","ni"],["ぬ","nu"],["ね","ne"],["の","no"]] },
    { name: "H row", note: "は行", letters: [["は","ha"],["ひ","hi"],["ふ","fu"],["へ","he"],["ほ","ho"]] },
    { name: "M row", note: "ま行", letters: [["ま","ma"],["み","mi"],["む","mu"],["め","me"],["も","mo"]] },
    { name: "Y row", note: "や行", letters: [["や","ya"],["ゆ","yu"],["よ","yo"]] },
    { name: "R row", note: "ら行", letters: [["ら","ra"],["り","ri"],["る","ru"],["れ","re"],["ろ","ro"]] },
    { name: "W row & N", note: "わ行", letters: [["わ","wa"],["を","wo"],["ん","n"]] }
  ];
  const allLetters = groups.flatMap(group => group.letters.map(([kana, romaji]) => ({ kana, romaji })));
  const byKana = new Map(allLetters.map(item => [item.kana, item]));

  const $ = id => document.getElementById(id);
  const kanaGroups = $("kanaGroups");
  const selectAll = $("selectAll");
  const selectedCount = $("selectedCount");
  const practiceButton = $("practiceButton");
  const setupMessage = $("setupMessage");
  const modeRead = $("modeRead");
  const modeWrite = $("modeWrite");
  const quizPanel = $("quizPanel");
  const answerForm = $("answerForm");
  const answerInput = $("answerInput");
  const feedback = $("feedback");
  const wrongActions = $("wrongActions");
  const nextButton = $("nextButton");
  const completion = $("completion");
  const homePage = $("homePage");

  let selectedKanas = new Set(allLetters.map(item => item.kana));
  let questions = [];
  let questionIndex = 0;
  let correctCount = 0;
  let answeredCurrent = false;

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
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
      const valid = savedSelection.filter(kana => byKana.has(kana));
      selectedKanas = new Set(valid);
    }
    const savedModes = loadJSON(STORAGE_KEYS.modes, null);
    if (savedModes && typeof savedModes === "object") {
      modeRead.checked = savedModes.read !== false;
      modeWrite.checked = savedModes.write !== false;
    }
    // Avoid a state where both practice modes are off.
    if (!modeRead.checked && !modeWrite.checked) modeRead.checked = true;
  }

  function persistSelection() {
    safeSet(STORAGE_KEYS.selection, JSON.stringify([...selectedKanas]));
  }
  function persistModes() {
    safeSet(STORAGE_KEYS.modes, JSON.stringify({ read: modeRead.checked, write: modeWrite.checked }));
  }

  function renderLetters() {
    kanaGroups.innerHTML = "";
    groups.forEach((group, groupIndex) => {
      const section = document.createElement("section");
      section.className = "kana-group";
      const heading = document.createElement("div");
      heading.className = "group-heading";
      const title = document.createElement("h3");
      title.textContent = group.name;
      const note = document.createElement("span");
      note.textContent = group.note;
      // Per-row checkbox to select the entire row at once (placed after the heading).
      const rowLabel = document.createElement("label");
      rowLabel.className = "row-check";
      const rowCheckbox = document.createElement("input");
      rowCheckbox.type = "checkbox";
      rowCheckbox.className = "row-checkbox";
      rowCheckbox.setAttribute("aria-label", `Select all in ${group.name}`);
      rowLabel.append(rowCheckbox);
      const groupKanas = group.letters.map(([kana]) => kana);
      const rowSelectedCount = groupKanas.filter(kana => selectedKanas.has(kana)).length;
      rowCheckbox.checked = rowSelectedCount === groupKanas.length;
      rowCheckbox.indeterminate = rowSelectedCount > 0 && rowSelectedCount < groupKanas.length;
      rowCheckbox.addEventListener("change", () => {
        groupKanas.forEach(kana => {
          if (rowCheckbox.checked) selectedKanas.add(kana);
          else selectedKanas.delete(kana);
        });
        persistSelection();
        // Refresh just this row's tiles + the row checkbox state.
        grid.querySelectorAll(".kana-checkbox").forEach(cb => {
          cb.checked = selectedKanas.has(cb.value);
          cb.closest(".kana-tile").classList.toggle("is-selected", cb.checked);
        });
        const count = groupKanas.filter(kana => selectedKanas.has(kana)).length;
        rowCheckbox.checked = count === groupKanas.length;
        rowCheckbox.indeterminate = count > 0 && count < groupKanas.length;
        updateSelectionSummary();
      });
      heading.append(title, note, rowLabel);
      const grid = document.createElement("div");
      grid.className = "kana-grid";
      group.letters.forEach(([kana, romaji]) => {
        const label = document.createElement("label");
        label.className = "kana-tile";
        label.dataset.kana = kana;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "kana-checkbox";
        checkbox.value = kana;
        checkbox.checked = selectedKanas.has(kana);
        checkbox.setAttribute("aria-label", `Select ${kana}, ${romaji}`);
        const character = document.createElement("span");
        character.className = "kana-character";
        character.textContent = kana;
        const pronunciation = document.createElement("span");
        pronunciation.className = "kana-romaji";
        pronunciation.textContent = romaji;
        label.append(checkbox, character, pronunciation);
        label.classList.toggle("is-selected", checkbox.checked);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selectedKanas.add(kana);
          else selectedKanas.delete(kana);
          persistSelection();
          label.classList.toggle("is-selected", checkbox.checked);
          // Keep the row checkbox in sync with its tiles.
          const count = groupKanas.filter(k => selectedKanas.has(k)).length;
          rowCheckbox.checked = count === groupKanas.length;
          rowCheckbox.indeterminate = count > 0 && count < groupKanas.length;
          updateSelectionSummary();
        });
        label.addEventListener("click", event => {
          if (event.target === label || event.target === character || event.target === pronunciation) {
            // Let the native label behavior toggle the checkbox.
          }
        });
        grid.appendChild(label);
      });
      section.append(heading, grid);
      kanaGroups.appendChild(section);
    });
    updateSelectionSummary();
  }

  function updateSelectionSummary() {
    selectedCount.textContent = String(selectedKanas.size);
    selectAll.checked = selectedKanas.size === allLetters.length;
    selectAll.indeterminate = selectedKanas.size > 0 && selectedKanas.size < allLetters.length;
    const ctaCount = $("ctaCount");
    if (ctaCount) ctaCount.textContent = String(selectedKanas.size);
    practiceButton.querySelector("span:first-child").textContent =
      selectedKanas.size === allLetters.length ? "Practice Hiragana" : "Practice selected";
  }

  function setSelection(kanaList) {
    selectedKanas = new Set(kanaList);
    persistSelection();
    renderLetters();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildQuestions() {
    // Build from the current in-memory selection, never from an asynchronous/localStorage read.
    const chosen = allLetters.filter(item => selectedKanas.has(item.kana));
    const useRead = modeRead.checked;
    const useWrite = modeWrite.checked;
    const result = [];
    chosen.forEach(item => {
      if (useRead) result.push({ type: "read", ...item });
      if (useWrite) result.push({ type: "write", ...item });
    });
    return shuffle(result);
  }

  // ---- Page routing (home <-> practice) via hash ----
  function navigate(route) {
    if (location.hash !== route) location.hash = route;
    else renderRoute();
  }

  function replayAnimation(el) {
    el.classList.remove("page-enter");
    void el.offsetWidth; // force reflow to restart the animation
    el.classList.add("page-enter");
  }

  function renderRoute() {
    const onPractice = location.hash === "#/practice";
    homePage.hidden = onPractice;
    quizPanel.hidden = !onPractice;
    replayAnimation(onPractice ? quizPanel : homePage);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function startPractice() {
    setupMessage.textContent = "";
    persistSelection();
    persistModes();
    if (selectedKanas.size === 0) {
      setupMessage.textContent = "Select at least one hiragana character to begin.";
      return;
    }
    if (!modeRead.checked && !modeWrite.checked) {
      setupMessage.textContent = "Choose at least one practice direction.";
      return;
    }
    questions = buildQuestions();
    questionIndex = 0;
    correctCount = 0;
    $("completion").hidden = true;
    $("questionType").hidden = false;
    document.querySelector(".question-card").hidden = false;
    navigate("#/practice");
    renderQuestion();
  }

  function renderQuestion() {
    if (questionIndex >= questions.length) {
      showCompletion();
      return;
    }
    const question = questions[questionIndex];
    answeredCurrent = false;
    $("questionType").textContent = question.type === "read" ? "JAPANESE → PRONUNCIATION" : "PRONUNCIATION → JAPANESE";
    $("questionPrompt").textContent = question.type === "read" ? "What is the pronunciation?" : "Which hiragana character matches?";
    $("questionDisplay").textContent = question.type === "read" ? question.kana : question.romaji;
    $("questionHint").textContent = question.type === "read" ? "Type the romaji pronunciation" : "Type the Japanese hiragana character";
    answerInput.value = "";
    answerInput.placeholder = question.type === "read" ? "" : "";
    answerInput.disabled = false;
    $("checkButton").hidden = false;
    feedback.hidden = true;
    wrongActions.hidden = true;
    nextButton.hidden = true;
    $("progressLabel").textContent = `Question ${questionIndex + 1} of ${questions.length}`;
    const percent = Math.round((questionIndex / questions.length) * 100);
    $("progressPercent").textContent = `${percent}%`;
    $("progressBar").style.width = `${percent}%`;
    const display = $("questionDisplay");
    display.classList.remove("animate-in");
    void display.offsetWidth;
    display.classList.add("animate-in");
    requestAnimationFrame(() => answerInput.focus({ preventScroll: true }));
  }

  function normalizeAnswer(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "");
  }

  function checkAnswer(event) {
    event.preventDefault();
    if (answeredCurrent) return;
    const question = questions[questionIndex];
    const expected = question.type === "read" ? question.romaji : question.kana;
    const actual = answerInput.value.trim();
    const isCorrect = question.type === "read"
      ? normalizeAnswer(actual) === normalizeAnswer(expected)
      : actual.normalize("NFC") === expected;
    if (isCorrect) {
      answeredCurrent = true;
      correctCount++;
      answerInput.disabled = true;
      $("checkButton").hidden = true;
      feedback.className = "feedback correct";
      feedback.textContent = "Correct! 正解 🎉";
      feedback.hidden = false;
      wrongActions.hidden = true;
      nextButton.hidden = false;
      nextButton.focus();
    } else {
      feedback.className = "feedback incorrect";
      feedback.textContent = "Not quite — try again, or reveal the answer to continue.";
      feedback.hidden = false;
      wrongActions.hidden = false;
      answerInput.focus();
      answerInput.select();
    }
  }

  function retryQuestion() {
    feedback.hidden = true;
    wrongActions.hidden = true;
    answerInput.value = "";
    answerInput.focus();
  }

  function revealAnswer() {
    const question = questions[questionIndex];
    const expected = question.type === "read" ? question.romaji : question.kana;
    answeredCurrent = true;
    answerInput.disabled = true;
    $("checkButton").hidden = true;
    feedback.className = "feedback incorrect";
    feedback.textContent = `Answer: ${expected}`;
    feedback.hidden = false;
    wrongActions.hidden = true;
    nextButton.hidden = false;
    nextButton.textContent = questionIndex === questions.length - 1 ? "Finish session →" : "Continue →";
    nextButton.focus();
  }

  function nextQuestion() {
    questionIndex++;
    if (questionIndex < questions.length) nextButton.textContent = "Next question →";
    renderQuestion();
  }

  function showCompletion() {
    document.querySelector(".question-card").hidden = true;
    completion.hidden = false;
    $("progressLabel").textContent = `Completed ${questions.length} questions`;
    $("progressPercent").textContent = "100%";
    $("progressBar").style.width = "100%";
    const percent = questions.length ? Math.round(correctCount / questions.length * 100) : 0;
    $("completionSummary").textContent = `You answered ${correctCount} of ${questions.length} questions correctly on the first try (${percent}%).`;
    replayAnimation(completion);
    launchConfetti();
    $("practiceAgain").focus();
  }

  // Simple, dependency-free confetti burst for the completion screen.
  function launchConfetti() {
    const holder = $("confetti");
    if (!holder) return;
    holder.innerHTML = "";
    const colors = ["#6157e8", "#16845b", "#c43d52", "#f2b53c", "#4aa3f0"];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4) + "s";
      piece.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
      piece.style.setProperty("--x", (Math.random() * 120 - 60) + "px");
      piece.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      holder.appendChild(piece);
    }
    setTimeout(() => { holder.innerHTML = ""; }, 3200);
  }

  function exitPractice() {
    navigate("#/");
    setupMessage.textContent = "";
    $("questionType").hidden = false;
    document.querySelector(".question-card").hidden = false;
    completion.hidden = true;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    safeSet(STORAGE_KEYS.theme, theme);
    const isDark = theme === "dark";
    $("themeIcon").textContent = isDark ? "☀" : "☾";
    $("themeLabel").textContent = isDark ? "Light theme" : "Dark theme";
    $("themeToggle").setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? "#11131b" : "#f6f7fb";
  }

  // Initialize theme first; the head script sets it early to avoid a flash.
  setTheme(safeGet(STORAGE_KEYS.theme) || document.documentElement.dataset.theme || "light");
  loadPreferences();
  renderLetters();

  // Route on load and on back/forward navigation.
  if (location.hash !== "#/practice" && location.hash !== "#/") location.hash = "#/";
  renderRoute();
  window.addEventListener("hashchange", renderRoute);

  selectAll.addEventListener("change", () => {
    setSelection(selectAll.checked ? allLetters.map(item => item.kana) : []);
  });
  $("selectNone").addEventListener("click", () => setSelection([]));
  modeRead.addEventListener("change", () => {
    if (!modeRead.checked && !modeWrite.checked) {
      setupMessage.textContent = "Choose at least one practice direction.";
      modeRead.checked = true;
      return;
    }
    setupMessage.textContent = "";
    persistModes();
  });
  modeWrite.addEventListener("change", () => {
    if (!modeRead.checked && !modeWrite.checked) {
      setupMessage.textContent = "Choose at least one practice direction.";
      modeWrite.checked = true;
      return;
    }
    setupMessage.textContent = "";
    persistModes();
  });
  practiceButton.addEventListener("click", startPractice);
  answerForm.addEventListener("submit", checkAnswer);
  $("retryButton").addEventListener("click", retryQuestion);
  $("revealButton").addEventListener("click", revealAnswer);
  nextButton.addEventListener("click", nextQuestion);
  $("exitPractice").addEventListener("click", exitPractice);
  $("practiceAgain").addEventListener("click", startPractice);
  $("backToSelection").addEventListener("click", exitPractice);

  $("themeToggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  // ---- Keyboard shortcuts ----
  document.addEventListener("keydown", event => {
    // Esc on the practice page goes back to the selection.
    if (event.key === "Escape" && location.hash === "#/practice") {
      exitPractice();
      return;
    }
    if (event.key !== "Enter") return;
    // Ignore Enter while typing or while a button/link has focus (it activates natively).
    const active = document.activeElement;
    const interactive = active && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(active.tagName);
    if (active === answerInput || interactive) return;
    // Enter on the completion screen replays the same selected set.
    if (!completion.hidden && location.hash === "#/practice") {
      event.preventDefault();
      startPractice();
      return;
    }
    // Enter on the home page starts a session with the current selection.
    if (location.hash !== "#/practice") {
      event.preventDefault();
      startPractice();
    }
  });
})();