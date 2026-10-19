(function initializePanel(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});
  if (typeof namespace.Panel === "function") {
    return;
  }

  const BRAND_MARK = `
    <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <rect width="128" height="128" rx="28" fill="#1B1D21"/>
      <rect x="28" y="39" width="44" height="9" rx="4.5" fill="#F8F2E8"/>
      <rect x="28" y="59" width="58" height="9" rx="4.5" fill="#F8F2E8"/>
      <rect x="28" y="79" width="34" height="9" rx="4.5" fill="#F8F2E8" opacity="0.62"/>
      <rect x="91" y="36" width="10" height="56" rx="5" fill="#FF7A4D"/>
    </svg>`;

  const ICONS = {
    pause: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M5.6 4.1v7.8M10.4 4.1v7.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`,
    play: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M5.4 3.9 11.5 8l-6.1 4.1V3.9Z" fill="currentColor"/>
      </svg>`,
    check: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="m3.8 8.3 2.6 2.6 5.8-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    restart: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M12.5 6.3A5.1 5.1 0 1 0 13 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M12.6 3.4v3.1H9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    stop: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.2" fill="currentColor"/>
      </svg>`,
    checkCircle: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" opacity="0.55"/>
        <path d="m5.4 8.2 1.7 1.7 3.5-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    lock: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <rect x="3.3" y="7" width="9.4" height="6.2" rx="1.6" stroke="currentColor" stroke-width="1.25"/>
        <path d="M5.4 7V5.5a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      </svg>`,
  };

  const STATE_LABELS = {
    idle: "Typing",
    running: "Typing",
    paused: "Paused",
    complete: "Complete",
    stopped: "Stopped",
  };

  function parseOpaqueColor(value) {
    if (typeof value !== "string") {
      return null;
    }

    const numbers = value.match(/[\d.]+/g);
    if (!numbers || numbers.length < 3) {
      return null;
    }

    const red = Number(numbers[0]);
    const green = Number(numbers[1]);
    const blue = Number(numbers[2]);
    const alpha = numbers.length >= 4 ? Number(numbers[3]) : 1;

    if ([red, green, blue].some((channel) => !Number.isFinite(channel))) {
      return null;
    }

    return { red, green, blue, alpha: Number.isFinite(alpha) ? alpha : 1 };
  }

  function detectPageTheme() {
    const candidates = [document.body, document.documentElement];

    for (const element of candidates) {
      if (!element) {
        continue;
      }

      const color = parseOpaqueColor(getComputedStyle(element).backgroundColor);
      if (!color || color.alpha < 0.5) {
        continue;
      }

      const luminance =
        (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;
      return luminance < 0.46 ? "dark" : "light";
    }

    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    return "light";
  }

  function normalizeTheme(value) {
    return value === "dark" || value === "light" ? value : null;
  }

  class Panel {
    constructor(options = {}) {
      const shared = namespace.shared;
      const TypingEngine = namespace.TypingEngine;

      if (!shared || typeof TypingEngine !== "function") {
        throw new Error("DocuType panel dependencies are not loaded.");
      }

      if (typeof namespace.PANEL_STYLES !== "string") {
        throw new Error("DocuType panel styles are not loaded.");
      }

      if (typeof options.text !== "string" || options.text.length === 0) {
        throw new TypeError("DocuType panel requires a non-empty passage.");
      }

      this._text = options.text;
      this._total = shared.countCharacters(options.text);
      this._wpm = shared.clampWpm(options.wpm);
      this._onClose = typeof options.onClose === "function" ? options.onClose : null;
      this._fixedTheme = normalizeTheme(options.theme);
      this._mediaQuery = null;
      this._engine = null;
      this._destroyed = false;
      this._abort = new AbortController();

      this._build();
      this._applyTheme(this._fixedTheme || detectPageTheme());
      this._bindEvents();
      this._renderProgress(0);

      this._engine = new TypingEngine({
        text: this._text,
        wpm: this._wpm,
        onReveal: (event) => this._handleReveal(event),
        onStateChange: (state) => this._handleStateChange(state),
        onReset: () => this._handleReset(),
        onComplete: () => this._handleComplete(),
      });

      this._engine.start();
    }

    get element() {
      return this._host;
    }

    getEngine() {
      return this._engine;
    }

    destroy() {
      if (this._destroyed) {
        return;
      }

      this._destroyed = true;
      this._abort.abort();

      if (this._engine) {
        this._engine.destroy();
      }

      this._host.remove();

      if (this._onClose) {
        this._onClose();
      }
    }

    _build() {
      const host = document.createElement("div");
      host.id = "docutype-root";
      host.setAttribute("data-docutype", "panel");
      // Keep the host pinned even if Google Docs targets generic divs.
      host.style.position = "fixed";
      host.style.zIndex = "2147483647";
      host.style.display = "block";

      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${namespace.PANEL_STYLES}</style>
        <section
          class="dt-panel"
          data-theme="light"
          data-state="running"
          role="region"
          aria-label="DocuType practice panel"
        >
          <header class="dt-header">
            <div class="dt-brand">
              <span class="dt-brand-mark" aria-hidden="true">${BRAND_MARK}</span>
              <span class="dt-brand-name" data-role="brand">DocuType</span>
            </div>
            <div class="dt-status">
              <span class="dt-status-dot" aria-hidden="true"></span>
              <span class="dt-status-label" data-role="status-label" role="status" aria-live="polite">Typing</span>
            </div>
          </header>

          <div class="dt-content">
            <div class="dt-passage-scroll" data-role="passage-scroll">
              <p class="dt-passage"><span class="dt-placeholder" data-role="placeholder">Get ready\u2026</span><span data-role="revealed"></span><span class="dt-caret" data-role="caret" aria-hidden="true"></span></p>
            </div>

            <p class="dt-complete-note" data-role="complete-note" hidden>
              ${ICONS.checkCircle}
              <span>Passage complete. Nicely done.</span>
            </p>

            <div class="dt-progress">
              <div
                class="dt-progress-track"
                role="progressbar"
                aria-label="Passage reveal progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="0"
                aria-valuetext="Approximately 0 percent revealed"
              >
                <span class="dt-progress-fill" data-role="progress-fill"></span>
              </div>
              <div class="dt-progress-meta" data-role="progress-meta">
                <span class="dt-percent" data-role="percent">\u2248 0%</span>
                <span class="dt-count" data-role="count">0 / ${this._total} characters</span>
              </div>
            </div>
          </div>

          <footer class="dt-footer">
            <div class="dt-controls">
              <button
                class="dt-button dt-button--primary"
                type="button"
                data-action="pause"
                aria-label="Pause session"
              >
                <span class="dt-button-icon" data-role="pause-icon" aria-hidden="true">${ICONS.pause}</span>
                <span data-role="pause-label">Pause</span>
              </button>
              <button
                class="dt-button"
                type="button"
                data-action="restart"
                aria-label="Restart session"
              >
                ${ICONS.restart}
                <span>Restart</span>
              </button>
              <button
                class="dt-button dt-button--quiet"
                type="button"
                data-action="stop"
                aria-label="Stop session"
              >
                ${ICONS.stop}
                <span>Stop</span>
              </button>
            </div>
            <p class="dt-note">
              ${ICONS.lock}
              <span class="dt-note-copy">
                <span class="dt-note-primary">You type it yourself. DocuType never edits the document.</span>
                <span class="dt-note-secondary">Progress is approximate and reflects the reveal, not your typing.</span>
              </span>
            </p>
          </footer>
        </section>
      `;

      this._host = host;
      this._shadow = shadow;
      this._panel = shadow.querySelector(".dt-panel");
      this._statusLabel = shadow.querySelector('[data-role="status-label"]');
      this._passageScroll = shadow.querySelector('[data-role="passage-scroll"]');
      this._revealed = shadow.querySelector('[data-role="revealed"]');
      this._placeholder = shadow.querySelector('[data-role="placeholder"]');
      this._completeNote = shadow.querySelector('[data-role="complete-note"]');
      this._progressTrack = shadow.querySelector('[role="progressbar"]');
      this._progressFill = shadow.querySelector('[data-role="progress-fill"]');
      this._percent = shadow.querySelector('[data-role="percent"]');
      this._count = shadow.querySelector('[data-role="count"]');
      this._pauseButton = shadow.querySelector('[data-action="pause"]');
      this._pauseIcon = shadow.querySelector('[data-role="pause-icon"]');
      this._pauseLabel = shadow.querySelector('[data-role="pause-label"]');
      this._restartButton = shadow.querySelector('[data-action="restart"]');
      this._stopButton = shadow.querySelector('[data-action="stop"]');

      (document.body || document.documentElement).appendChild(host);
    }

    _bindEvents() {
      const options = { signal: this._abort.signal };

      this._pauseButton.addEventListener(
        "click",
        () => {
          if (!this._engine) {
            return;
          }

          if (this._engine.state === "running") {
            this._engine.pause();
          } else if (this._engine.state === "paused") {
            this._engine.resume();
          }
        },
        options
      );

      this._restartButton.addEventListener(
        "click",
        () => {
          if (this._engine) {
            this._engine.restart();
          }
        },
        options
      );

      this._stopButton.addEventListener("click", () => this.destroy(), options);

      // Keep Docs keyboard shortcuts and canvas focus handling out of the panel.
      const stopPropagation = (event) => event.stopPropagation();
      this._panel.addEventListener("keydown", stopPropagation, options);
      this._panel.addEventListener("keyup", stopPropagation, options);
      this._panel.addEventListener("pointerdown", stopPropagation, options);

      if (!this._fixedTheme && typeof window.matchMedia === "function") {
        this._mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (typeof this._mediaQuery.addEventListener === "function") {
          this._mediaQuery.addEventListener(
            "change",
            () => this._applyTheme(detectPageTheme()),
            options
          );
        }
      }
    }

    _handleReveal({ char, index }) {
      if (this._placeholder && !this._placeholder.hidden) {
        this._placeholder.hidden = true;
      }

      this._revealed.appendChild(document.createTextNode(char));
      this._renderProgress(index);

      this._passageScroll.scrollTop = this._passageScroll.scrollHeight;
    }

    _handleStateChange(state) {
      this._panel.dataset.state = state;
      this._statusLabel.textContent = STATE_LABELS[state] || "Typing";

      const paused = state === "paused";
      const complete = state === "complete";
      const stopped = state === "stopped";

      this._pauseButton.disabled = complete || stopped;
      this._pauseLabel.textContent = complete ? "Complete" : paused ? "Resume" : "Pause";
      this._pauseIcon.innerHTML = complete ? ICONS.check : paused ? ICONS.play : ICONS.pause;
      this._pauseButton.setAttribute(
        "aria-label",
        complete ? "Session complete" : paused ? "Resume session" : "Pause session"
      );
    }

    _handleReset() {
      this._revealed.textContent = "";
      this._placeholder.hidden = false;
      this._completeNote.hidden = true;
      this._passageScroll.scrollTop = 0;
      this._renderProgress(0);
    }

    _handleComplete() {
      this._completeNote.hidden = false;
      this._renderProgress(this._total);
    }

    _renderProgress(index) {
      const total = this._total;
      const clampedIndex = Math.max(0, Math.min(total, index));
      const percent = total > 0 ? Math.floor((clampedIndex / total) * 100) : 0;
      const isComplete = total > 0 && clampedIndex >= total;

      this._progressFill.style.width = `${percent}%`;
      this._progressTrack.setAttribute("aria-valuenow", String(percent));
      this._progressTrack.setAttribute(
        "aria-valuetext",
        isComplete ? "Passage complete" : `Approximately ${percent} percent revealed`
      );
      this._percent.textContent = isComplete ? "100%" : `\u2248 ${percent}%`;
      this._count.textContent = `${clampedIndex} / ${total} characters`;
    }

    _applyTheme(theme) {
      this._panel.dataset.theme = theme === "dark" ? "dark" : "light";
    }
  }

  namespace.Panel = Panel;
})(typeof globalThis !== "undefined" ? globalThis : this);
