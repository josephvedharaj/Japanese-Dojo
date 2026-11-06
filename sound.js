/* ==========================================================================
   Sound — every effect is synthesized live with Web Audio oscillators.
   No audio files, nothing downloaded.
   Exposes window.Sound: tap, select, key, start, correct, correctSoft,
   wrong, reveal, back, complete, isMuted, setMuted.
   ========================================================================== */
(() => {
  "use strict";

  const MUTE_KEY = "hiragana-dojo-sound-v1";
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "off"; } catch (_) { /* ignore */ }

  let ctx = null;
  let master = null; // dry bus → compressor → speakers
  let fx = null;     // echo bus for bells & sparkles

  // Browsers only allow audio after a user gesture, so build the graph lazily.
  function audio() {
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      compressor.connect(ctx.destination);

      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(compressor);

      // A short feedback delay gives chimes a little "room".
      fx = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.13;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 3200;
      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      fx.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(wet);
      wet.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  ["pointerdown", "keydown", "touchstart"].forEach(type =>
    window.addEventListener(type, () => { if (!muted) audio(); }, { once: true, passive: true }));

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  /**
   * One enveloped oscillator voice.
   * freq: Hz · type: wave · at: start offset (s) · dur: length (s)
   * gain: peak level · glide: end frequency · echo: send to the fx bus
   */
  function voice({ freq, type = "sine", at = 0, dur = 0.2, gain = 0.2, attack = 0.008, glide, detune = 0, echo = false, filter }) {
    const ac = audio();
    if (!ac || muted) return;
    const t = ac.currentTime + 0.01 + at;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.8);
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(env);
    env.connect(master);
    if (echo) env.connect(fx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A bell-ish note: sine body + quiet octave shimmer.
  function bell(note, at = 0, { dur = 0.45, gain = 0.18, echo = true } = {}) {
    voice({ freq: midi(note), type: "sine", at, dur, gain, echo });
    voice({ freq: midi(note + 12), type: "triangle", at, dur: dur * 0.6, gain: gain * 0.25, echo });
  }

  // Bright random high notes from a pentatonic scale.
  function sparkle(count, at = 0) {
    const scale = [84, 86, 88, 91, 93, 96, 98, 100];
    for (let i = 0; i < count; i++) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      voice({ freq: midi(note), type: "sine", at: at + i * 0.055, dur: 0.18, gain: 0.05, echo: true });
    }
  }

  // Each correct answer in a row climbs the pentatonic scale.
  const STREAK_STEPS = [0, 2, 4, 7, 9, 12, 14, 16];

  const Sound = {
    // UI: tab/mode switches, theme toggle
    tap() {
      voice({ freq: 880, type: "sine", dur: 0.05, gain: 0.06, attack: 0.003 });
    },

    // Selecting / deselecting characters: a little up or down blip.
    select(on) {
      voice(on
        ? { freq: 620, glide: 930, type: "sine", dur: 0.09, gain: 0.08, attack: 0.004 }
        : { freq: 620, glide: 420, type: "sine", dur: 0.08, gain: 0.06, attack: 0.004 });
    },

    // On-screen keyboard key press: a soft, slightly varied click.
    key() {
      voice({ freq: 1250 + Math.random() * 180, type: "triangle", dur: 0.035, gain: 0.045, attack: 0.002, filter: 4000 });
    },

    // Starting a session: quick upward swoosh into a chime.
    start() {
      voice({ freq: 280, glide: 980, type: "sine", dur: 0.18, gain: 0.08, attack: 0.02 });
      bell(84, 0.14, { dur: 0.35, gain: 0.12 });
    },

    // Correct on the first try; pitch climbs with the streak.
    correct(streak = 1) {
      const step = STREAK_STEPS[Math.min(streak - 1, STREAK_STEPS.length - 1)];
      const base = 76 + step; // E5 upward
      bell(base, 0, { dur: 0.3, gain: 0.16 });
      bell(base + 7, 0.075, { dur: 0.5, gain: 0.16 });
      if (streak > 0 && streak % 5 === 0) sparkle(6, 0.15); // milestone flourish
    },

    // Correct after a miss: a single gentle note.
    correctSoft() {
      bell(76, 0, { dur: 0.4, gain: 0.12 });
    },

    // Wrong: a soft low "bwoop" — noticeable, never harsh.
    wrong() {
      voice({ freq: midi(57), glide: midi(52), type: "triangle", dur: 0.22, gain: 0.16, filter: 1200 });
      voice({ freq: midi(53), glide: midi(48), type: "triangle", at: 0.1, dur: 0.26, gain: 0.13, filter: 1000 });
    },

    // Showing the answer: neutral falling pair.
    reveal() {
      bell(72, 0, { dur: 0.3, gain: 0.1 });
      bell(67, 0.1, { dur: 0.4, gain: 0.1 });
    },

    // Leaving practice.
    back() {
      voice({ freq: 700, glide: 380, type: "sine", dur: 0.12, gain: 0.07 });
    },

    // Session finished: the better the score, the bigger the tune.
    complete(percent) {
      if (percent === 100) {
        // Fanfare: C–E–G–C arpeggio, a held major chord, then sparkles.
        [72, 76, 79, 84].forEach((n, i) => bell(n, i * 0.09, { dur: 0.35, gain: 0.15 }));
        [72, 76, 79, 84].forEach(n => {
          voice({ freq: midi(n), type: "triangle", at: 0.4, dur: 1.3, gain: 0.07, attack: 0.03, echo: true });
          voice({ freq: midi(n), type: "sine", at: 0.4, dur: 1.3, gain: 0.05, detune: 7, attack: 0.03 });
        });
        sparkle(12, 0.45);
      } else if (percent >= 80) {
        [72, 76, 79].forEach((n, i) => bell(n, i * 0.1, { dur: 0.4, gain: 0.14 }));
        [72, 76, 79].forEach(n =>
          voice({ freq: midi(n), type: "triangle", at: 0.32, dur: 0.9, gain: 0.06, attack: 0.03, echo: true }));
        sparkle(4, 0.4);
      } else if (percent >= 50) {
        [67, 72, 76].forEach((n, i) => bell(n, i * 0.11, { dur: 0.45, gain: 0.12 }));
      } else {
        // Encouraging, not sad: a soft rising pair.
        bell(64, 0, { dur: 0.45, gain: 0.11 });
        bell(67, 0.14, { dur: 0.6, gain: 0.11 });
      }
    },

    isMuted: () => muted,

    setMuted(value) {
      muted = value;
      try { localStorage.setItem(MUTE_KEY, muted ? "off" : "on"); } catch (_) { /* ignore */ }
      if (!muted) {
        audio();
        bell(79, 0, { dur: 0.25, gain: 0.12 }); // confirm sound is on
      }
    }
  };

  window.Sound = Sound;
})();
