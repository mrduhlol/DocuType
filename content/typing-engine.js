(function initializeTypingEngine(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  const namespace = root.DocuType || (root.DocuType = {});
  namespace.TypingEngine = api.TypingEngine;
  namespace.computeCharDelay = api.computeCharDelay;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTypingEngineApi() {
  "use strict";

  const DEFAULT_WPM = 45;
  const MIN_WPM = 10;
  const MAX_WPM = 160;
  const INITIAL_DELAY_MS = 550;
  const RESUME_DELAY_MS = 320;
  const SENTENCE_PUNCTUATION = ".!?…";
  const CLAUSE_PUNCTUATION = ",;:";

  function normalizeWpm(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_WPM;
    }

    return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(numeric)));
  }

  /**
   * Returns the delay before the next character, based on the character that
   * was just revealed. The jitter, punctuation beats, and occasional thinking
   * pauses keep the reveal from sounding like a metronome.
   */
  function computeCharDelay(char, wpm, random = Math.random) {
    const base = 12000 / normalizeWpm(wpm);
    let delay = base * (0.7 + random() * 0.6);
    const pauseRoll = random();

    if (char === "\n") {
      delay += 260 + random() * 280;
    } else if (SENTENCE_PUNCTUATION.includes(char)) {
      delay += 220 + random() * 320;
    } else if (CLAUSE_PUNCTUATION.includes(char)) {
      delay += 130 + random() * 220;
    } else if (char === " " && random() < 0.08) {
      delay += 120 + random() * 240;
    }

    if (pauseRoll < 0.02) {
      delay += 450 + random() * 600;
    } else if (pauseRoll < 0.06) {
      delay += 100 + random() * 180;
    }

    return Math.max(20, Math.round(delay));
  }

  class TypingEngine {
    constructor(options = {}) {
      const {
        text,
        wpm,
        scheduler,
        random,
        initialDelayMs,
        resumeDelayMs,
        onReveal,
        onStateChange,
        onReset,
        onComplete,
      } = options;

      if (typeof text !== "string" || text.length === 0) {
        throw new TypeError("TypingEngine requires a non-empty passage.");
      }

      this._characters = Array.from(text);
      this._wpm = normalizeWpm(wpm);
      this._random = typeof random === "function" ? random : Math.random;
      this._setTimeout =
        scheduler && typeof scheduler.setTimeout === "function"
          ? scheduler.setTimeout
          : (callback, delay) => setTimeout(callback, delay);
      this._clearTimeout =
        scheduler && typeof scheduler.clearTimeout === "function"
          ? scheduler.clearTimeout
          : (timer) => clearTimeout(timer);
      this._initialDelayMs = Number.isFinite(initialDelayMs)
        ? Math.max(0, initialDelayMs)
        : INITIAL_DELAY_MS;
      this._resumeDelayMs = Number.isFinite(resumeDelayMs)
        ? Math.max(0, resumeDelayMs)
        : RESUME_DELAY_MS;

      this._onReveal = typeof onReveal === "function" ? onReveal : () => {};
      this._onStateChange = typeof onStateChange === "function" ? onStateChange : () => {};
      this._onReset = typeof onReset === "function" ? onReset : () => {};
      this._onComplete = typeof onComplete === "function" ? onComplete : () => {};

      this._state = "idle";
      this._index = 0;
      this._timer = null;
      this._destroyed = false;
    }

    get state() {
      return this._state;
    }

    get index() {
      return this._index;
    }

    get total() {
      return this._characters.length;
    }

    setWpm(value) {
      if (this._destroyed || this._state === "stopped" || this._state === "complete") {
        return false;
      }

      this._wpm = normalizeWpm(value);
      if (this._state === "running" && this._timer !== null) {
        this._clearTimer();
        const delay = this._index === 0
          ? this._initialDelayMs
          : computeCharDelay(this._characters[this._index - 1], this._wpm, this._random);
        this._schedule(delay);
      }
      return true;
    }

    start() {
      if (this._destroyed || this._state !== "idle") {
        return false;
      }

      this._setState("running");
      this._schedule(this._initialDelayMs);
      return true;
    }

    pause() {
      if (this._state !== "running") {
        return false;
      }

      this._clearTimer();
      this._setState("paused");
      return true;
    }

    resume() {
      if (this._state !== "paused") {
        return false;
      }

      this._setState("running");
      this._schedule(this._resumeDelayMs);
      return true;
    }

    restart() {
      if (this._destroyed || this._state === "stopped") {
        return false;
      }

      this._clearTimer();
      this._index = 0;
      this._onReset();
      this._setState("running");
      this._schedule(this._initialDelayMs);
      return true;
    }

    stop() {
      if (this._destroyed || this._state === "stopped") {
        return false;
      }

      this._clearTimer();
      this._setState("stopped");
      return true;
    }

    destroy() {
      if (this._destroyed) {
        return;
      }

      this._clearTimer();
      this._destroyed = true;
      if (this._state !== "stopped") {
        this._setState("stopped");
      }

      this._onReveal = () => {};
      this._onStateChange = () => {};
      this._onReset = () => {};
      this._onComplete = () => {};
    }

    _schedule(delay) {
      if (this._state !== "running" || this._timer !== null || this._destroyed) {
        return;
      }

      this._timer = this._setTimeout(() => {
        this._timer = null;
        this._tick();
      }, delay);
    }

    _tick() {
      if (this._state !== "running" || this._destroyed) {
        return;
      }

      const char = this._characters[this._index];
      this._index += 1;
      this._onReveal({
        char,
        index: this._index,
        total: this._characters.length,
      });

      if (this._index >= this._characters.length) {
        this._setState("complete");
        this._onComplete();
        return;
      }

      this._schedule(computeCharDelay(char, this._wpm, this._random));
    }

    _clearTimer() {
      if (this._timer === null) {
        return;
      }

      this._clearTimeout(this._timer);
      this._timer = null;
    }

    _setState(nextState) {
      if (this._state === nextState) {
        return;
      }

      const previousState = this._state;
      this._state = nextState;
      this._onStateChange(nextState, previousState);
    }
  }

  return { TypingEngine, computeCharDelay };
});
