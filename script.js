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
    { name: "W row & N", note: "わ行", letters: [["わ","wa"],["を","wo"],["ん","n"]] },
    { name: "G row (dakuten)", note: "ガ行", letters: [["が","ga"],["ぎ","gi"],["ぐ","gu"],["げ","ge"],["ご","go"]] },
    { name: "Z row (dakuten)", note: "ザ行", letters: [["ざ","za"],["じ","ji"],["ず","zu"],["ぜ","ze"],["ぞ","zo"]] },
    { name: "D row (dakuten)", note: "ダ行", letters: [["だ","da"],["ぢ","ji"],["づ","zu"],["で","de"],["ど","do"]] },
    { name: "B row (dakuten)", note: "バ行", letters: [["ば","ba"],["び","bi"],["ぶ","bu"],["べ","be"],["ぼ","bo"]] },
    { name: "P row (handakuten)", note: "パ行", letters: [["ぱ","pa"],["ぴ","pi"],["ぷ","pu"],["ぺ","pe"],["ぽ","po"]] },
    { name: "K yōon", note: "きゃ行", letters: [["きゃ","kya"],["きゅ","kyu"],["きょ","kyo"]] },
    { name: "S yōon", note: "しゃ行", letters: [["しゃ","sha"],["しゅ","shu"],["しょ","sho"]] },
    { name: "T yōon", note: "ちゃ行", letters: [["ちゃ","cha"],["ちゅ","chu"],["ちょ","cho"]] },
    { name: "N yōon", note: "にゃ行", letters: [["にゃ","nya"],["にゅ","nyu"],["にょ","nyo"]] },
    { name: "H yōon", note: "ひゃ行", letters: [["ひゃ","hya"],["ひゅ","hyu"],["ひょ","hyo"]] },
    { name: "M yōon", note: "みゃ行", letters: [["みゃ","mya"],["みゅ","myu"],["みょ","myo"]] },
    { name: "R yōon", note: "りゃ行", letters: [["りゃ","rya"],["りゅ","ryu"],["りょ","ryo"]] },
    { name: "G yōon", note: "ぎゃ行", letters: [["ぎゃ","gya"],["ぎゅ","gyu"],["ぎょ","gyo"]] },
    { name: "J yōon", note: "じゃ行", letters: [["じゃ","ja"],["じゅ","ju"],["じょ","jo"]] },
    { name: "B yōon", note: "びゃ行", letters: [["びゃ","bya"],["びゅ","byu"],["びょ","byo"]] },
    { name: "P yōon", note: "ぴゃ行", letters: [["ぴゃ","pya"],["ぴゅ","pyu"],["ぴょ","pyo"]] }
  ];
  const allLetters = groups.flatMap(group => group.letters.map(([kana, romaji]) => ({ kana, romaji })));
  const byKana = new Map(allLetters.map(item => [item.kana, item]));

  // Base letters (original 46) vs the newly added combination/dakuten letters (58).
  const baseGroupNames = new Set([
    "Vowels","K row","S row","T row","N row","H row","M row","Y row","R row","W row & N"
  ]);
  const baseLetters = new Set(
    groups.filter(g => baseGroupNames.has(g.name)).flatMap(g => g.letters.map(([k]) => k))
  );
  const comboLetters = new Set(
    groups.filter(g => !baseGroupNames.has(g.name)).flatMap(g => g.letters.map(([k]) => k))
  );

  const $ = id => document.getElementById(id);
  const kanaGroups = $("kanaGroups");
  const selectAll = $("selectAll");
  const selectBase = $("selectBase");
  const selectCombo = $("selectCombo");
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
  let advanceTimer = null;

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
    // Scroll-reveal for kana groups
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
      kanaGroups.querySelectorAll(".kana-group").forEach(group => {
        group.classList.add("reveal-on-scroll");
        observer.observe(group);
      });
    }
    updateSelectionSummary();
  }

  function updateSelectionSummary() {
    const total = allLetters.length;
    selectedCount.textContent = String(selectedKanas.size);
    selectAll.checked = selectedKanas.size === total;
    selectAll.indeterminate = selectedKanas.size > 0 && selectedKanas.size < total;

    const baseSelected = [...baseLetters].every(k => selectedKanas.has(k));
    const baseAny = [...baseLetters].some(k => selectedKanas.has(k));
    selectBase.checked = baseSelected;
    selectBase.indeterminate = baseAny && !baseSelected;

    const comboSelected = [...comboLetters].every(k => selectedKanas.has(k));
    const comboAny = [...comboLetters].some(k => selectedKanas.has(k));
    selectCombo.checked = comboSelected;
    selectCombo.indeterminate = comboAny && !comboSelected;

    const ctaCount = $("ctaCount");
    if (ctaCount) ctaCount.textContent = `${selectedKanas.size}/${total} characters selected`;
    practiceButton.querySelector("span:first-child").textContent =
      selectedKanas.size === total ? "Practice Hiragana" : "Practice selected";
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
    // Scroll-to-top runs after the synchronous focus in renderQuestion(),
    // so re-focus and scroll the answer input into view here to keep it
    // visible on the practice page (especially on mobile keyboards).
    if (onPractice) focusAnswerInput();
  }

  function startPractice() {
    clearAdvanceTimer();
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
    clearAdvanceTimer();
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
    focusAnswerInput();
  }

  function normalizeAnswer(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "");
  }

  // Returns true when the typed answer matches the expected answer.
  // For write mode we also accept a kana that shares the romaji, so the
  // ji/zu pairs (じ・ぢ and ず・づ) are treated as correct either way.
  function answerIsCorrect(actual, question) {
    const trimmed = actual.trim();
    if (question.type === "read") {
      return normalizeAnswer(trimmed) === normalizeAnswer(question.romaji);
    }
    const nfc = trimmed.normalize("NFC");
    const expected = byKana.get(question.kana);
    const typed = byKana.get(nfc);
    return nfc === question.kana || (!!typed && !!expected && typed.romaji === expected.romaji);
  }

  // Show the result of an answer and (when correct) schedule the auto-advance.
  function handleResult(isCorrect) {
    const question = questions[questionIndex];
    if (isCorrect) {
      answeredCurrent = true;
      correctCount++;
      // Don't set disabled or readOnly — that dismisses the mobile keyboard.
      // The answeredCurrent flag already blocks further input processing.
      answerInput.classList.add("correct-flash");
      setTimeout(() => answerInput.classList.remove("correct-flash"), 600);
      $("checkButton").hidden = true;
      feedback.className = "feedback correct";
      feedback.textContent = "Correct! 正解 🎉";
      feedback.hidden = false;
      wrongActions.hidden = true;
      nextButton.hidden = false;
      // Keep focus on answerInput — keeps the mobile keyboard alive
      scheduleAutoAdvance();
    } else {
      feedback.className = "feedback incorrect";
      feedback.textContent = "Not quite — try again, or reveal the answer to continue.";
      feedback.hidden = false;
      wrongActions.hidden = false;
      answerInput.focus();
      answerInput.select();
    }
  }

  function checkAnswer(event) {
    if (event) event.preventDefault();
    if (answeredCurrent) return;
    const value = answerInput.value.trim();
    if (!value) return;
    if (answerIsCorrect(value, questions[questionIndex])) {
      handleResult(true);
    } else {
      handleResult(false);
    }
  }

  // Auto-advance to the next question after a short delay so the learner can
  // see the "Correct!" feedback before the card changes.
  function scheduleAutoAdvance() {
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      nextQuestion();
    }, 700);
  }

  function clearAdvanceTimer() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  // Move focus to the answer input so the learner can keep typing without
  // reaching for the mouse/trackpad, and scroll it into view so it stays
  // visible above the on-screen keyboard on mobile. `preventScroll: true`
  // avoids an immediate jarring scroll; the deferred `scrollIntoView` runs
  // after the keyboard has had a moment to open and resize the viewport.
  function focusAnswerInput() {
    // If the input already has focus, don't re-call focus() — that can
    // cause the mobile keyboard to flicker (dismiss then reopen).
    const alreadyFocused = document.activeElement === answerInput;

    const doFocus = () => answerInput.focus({ preventScroll: true });
    const doScroll = () =>
      answerInput.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });

    if (alreadyFocused) {
      // Keyboard is already open — scroll immediately.
      requestAnimationFrame(doScroll);
    } else {
      // Focus first, then wait for the mobile keyboard to open and resize the
      // viewport before scrolling, otherwise the scroll target is wrong.
      requestAnimationFrame(doFocus);
      setTimeout(doScroll, 350);
    }
  }

  // Check the answer as soon as it is typed correctly — no "Check answer"
  // click required. Skips IME composition events so Japanese input works.
  function tryAutoCheck() {
    if (answeredCurrent) return;
    if (answerIsCorrect(answerInput.value, questions[questionIndex])) {
      handleResult(true);
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
    const total = questions.length;
    const isPerfect = total > 0 && correctCount === total;
    document.querySelector(".question-card").hidden = true;
    completion.hidden = false;
    $("progressLabel").textContent = `Completed ${total} questions`;
    $("progressPercent").textContent = "100%";
    $("progressBar").style.width = "100%";
    const percent = total ? Math.round(correctCount / total * 100) : 0;
    $("completionScore").textContent = `${correctCount} / ${total}`;
    $("completionScore").className = `completion-score${isPerfect ? " perfect" : ""}`;
    $("completionBadge").textContent = isPerfect ? "PERFECT SCORE! 👑" : "";
    $("completionSummary").textContent = `You answered ${correctCount} of ${total} questions correctly on the first try (${percent}%).`;
    const mark = document.querySelector(".completion-mark");
    if (isPerfect) mark.classList.add("perfect");
    else mark.classList.remove("perfect");
    replayAnimation(completion);
    // Add stagger animations
    const staggerEls = completion.querySelectorAll(".completion-mark, .completion-badge, .completion-score, .eyebrow, h2, .muted, .completion-hint, .completion-actions");
    staggerEls.forEach((el, i) => {
      el.classList.remove("stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5");
      el.classList.add(`stagger-${Math.min(i + 1, 5)}`);
    });
    launchConfetti(isPerfect ? 120 : 40);
    $("practiceAgain").focus();
  }

  function launchConfetti(count = 40) {
    const holder = $("confetti");
    if (!holder) return;
    holder.innerHTML = "";
    const colors = ["#6354e8", "#16845b", "#e85d6f", "#f2b53c", "#4aa3f0", "#ffd700", "#ff69b4", "#26c6a0"];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      const isCircle = Math.random() > 0.5;
      const w = 6 + Math.random() * 6;
      const h = isCircle ? w : 8 + Math.random() * 8;
      piece.style.left = Math.random() * 100 + "%";
      piece.style.width = w + "px";
      piece.style.height = h + "px";
      piece.style.borderRadius = isCircle ? "50%" : "2px";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.5) + "s";
      piece.style.animationDuration = (1.4 + Math.random() * 1.0) + "s";
      piece.style.setProperty("--x", (Math.random() * 140 - 70) + "px");
      piece.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      piece.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
      piece.style.willChange = "transform";
      holder.appendChild(piece);
    }
    setTimeout(() => { holder.innerHTML = ""; }, 3000);
  }

  function exitPractice() {
    clearAdvanceTimer();
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
    const icon = $("themeIcon");
    icon.textContent = isDark ? "☀" : "☾";
    icon.classList.remove("theme-icon-rotate");
    void icon.offsetWidth;
    icon.classList.add("theme-icon-rotate");
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
  selectBase.addEventListener("change", () => {
    if (selectBase.checked) {
      baseLetters.forEach(kana => selectedKanas.add(kana));
    } else {
      baseLetters.forEach(kana => selectedKanas.delete(kana));
    }
    persistSelection();
    renderLetters();
  });
  selectCombo.addEventListener("change", () => {
    if (selectCombo.checked) {
      comboLetters.forEach(kana => selectedKanas.add(kana));
    } else {
      comboLetters.forEach(kana => selectedKanas.delete(kana));
    }
    persistSelection();
    renderLetters();
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
  // Auto-check: advance to the next question as soon as the answer is right.
  // Many mobile keyboards (Gboard, Samsung) set isComposing=true even for
  // plain Latin romaji because of autocomplete/swipe, so we add a short
  // delayed fallback to catch those cases without interfering with real IME
  // composition (e.g., Japanese kana input).
  let autoCheckTimer = null;
  answerInput.addEventListener("input", (event) => {
    if (!event.isComposing) {
      tryAutoCheck();
    } else {
      // Delayed fallback for mobile keyboards that stay in composing mode
      clearTimeout(autoCheckTimer);
      autoCheckTimer = setTimeout(tryAutoCheck, 120);
    }
  });
  answerInput.addEventListener("compositionend", () => {
    clearTimeout(autoCheckTimer);
    tryAutoCheck();
  });
  answerInput.addEventListener("compositionupdate", () => {
    clearTimeout(autoCheckTimer);
    autoCheckTimer = setTimeout(tryAutoCheck, 120);
  });
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