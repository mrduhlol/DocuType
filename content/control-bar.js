(function initializeControlBar(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});
  if (typeof namespace.ControlBar === "function") {
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
    stop: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.2" fill="currentColor"/>
      </svg>`,
  };

  const STATE_LABELS = Object.freeze({
    starting: "Starting…",
    running: "Typing",
    paused: "Paused",
    complete: "Complete",
    stopped: "Stopped",
    error: "Couldn't type",
  });

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

  function normalizeTotal(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.floor(numeric));
  }

  class ControlBar {
    constructor(options = {}) {
      if (typeof namespace.CONTROL_BAR_STYLES !== "string") {
        throw new Error("DocuType control bar styles are not loaded.");
      }

      this._total = normalizeTotal(options.total);
      this._wpm = Math.round(Number(options.wpm)) || 0;
      this._onPause = typeof options.onPause === "function" ? options.onPause : null;
      this._onResume = typeof options.onResume === "function" ? options.onResume : null;
      this._onSpeedChange = typeof options.onSpeedChange === "function" ? options.onSpeedChange : null;
      this._onStop = typeof options.onStop === "function" ? options.onStop : null;
      this._fixedTheme = normalizeTheme(options.theme);
      this._mediaQuery = null;
      this._state = "starting";
      this._destroyed = false;
      this._abort = new AbortController();

      this._build();
      this._applyTheme(this._fixedTheme || detectPageTheme());
      this._bindEvents();
      this.setSpeed(this._wpm);
      this.setState("starting");
      this.setProgress(0, this._total);
    }

    get element() {
      return this._host;
    }

    get state() {
      return this._state;
    }

    setState(state) {
      if (this._destroyed) {
        return;
      }

      const nextState = STATE_LABELS[state] ? state : "starting";
      this._state = nextState;
      this._panel.dataset.state = nextState;
      this._statusLabel.textContent = STATE_LABELS[nextState];

      const paused = nextState === "paused";
      const complete = nextState === "complete";
      const finished =
        complete || nextState === "stopped" || nextState === "error";

      this._pauseButton.disabled = finished;
      this._speedSelect.disabled = finished;
      this._pauseLabel.textContent = complete ? "Complete" : paused ? "Resume" : "Pause";
      this._pauseIcon.innerHTML = complete ? ICONS.check : paused ? ICONS.play : ICONS.pause;
      this._pauseButton.setAttribute(
        "aria-label",
        complete
          ? "Typing complete"
          : paused
            ? "Resume typing"
            : "Pause typing"
      );

      if (nextState !== "error") {
        this._error.hidden = true;
        this._error.textContent = "";
      }

      if (complete) {
        this.setProgress(this._total, this._total);
      }
    }

    setProgress(index, total) {
      if (this._destroyed) {
        return;
      }

      if (total !== undefined) {
        this._total = normalizeTotal(total);
      }

      const totalCount = this._total;
      const clampedIndex = Math.max(0, Math.min(totalCount, Number(index) || 0));
      const percent = totalCount > 0 ? Math.floor((clampedIndex / totalCount) * 100) : 0;
      const complete = totalCount > 0 && clampedIndex >= totalCount;

      this._progressFill.style.width = `${percent}%`;
      this._progressTrack.setAttribute("aria-valuenow", String(percent));
      this._progressTrack.setAttribute(
        "aria-valuetext",
        complete
          ? "Typing complete"
          : `Approximately ${percent} percent inserted into the document`
      );
      this._percent.textContent = complete ? "100%" : `≈ ${percent}%`;
      this._count.textContent = `${clampedIndex} / ${totalCount} characters`;
    }

    setSpeed(wpm) {
      if (this._destroyed) {
        return;
      }
      this._wpm = Math.round(Number(wpm)) || this._wpm;
      const supported = Array.from(this._speedSelect.options).some(
        (option) => option.value === String(this._wpm)
      );
      if (!supported && this._speedSelect.options.length > 0) {
        const currentOption = document.createElement("option");
        currentOption.value = String(this._wpm);
        currentOption.textContent = `${this._wpm} WPM`;
        this._speedSelect.insertBefore(currentOption, this._speedSelect.firstChild);
      }
      if (supported) {
        this._speedSelect.value = String(this._wpm);
      } else {
        this._speedSelect.value = String(this._wpm);
      }
    }

    setError(message) {
      if (this._destroyed) {
        return;
      }

      this.setState("error");
      this._error.textContent = String(message || "DocuType couldn't type into this document.");
      this._error.hidden = false;
    }

    destroy() {
      if (this._destroyed) {
        return;
      }

      this._destroyed = true;
      this._abort.abort();
      this._host.remove();
    }

    _build() {
      const host = document.createElement("div");
      host.id = "docutype-root";
      host.setAttribute("data-docutype", "control-bar");
      // Keep the host pinned even if Google Docs targets generic divs.
      host.style.position = "fixed";
      host.style.zIndex = "2147483647";
      host.style.display = "block";

      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>${namespace.CONTROL_BAR_STYLES}</style>
        <section
          class="dt-bar"
          data-theme="light"
          data-state="starting"
          role="region"
          aria-label="DocuType controls"
        >
          <div class="dt-top">
            <div class="dt-brand">
              <span class="dt-brand-mark" aria-hidden="true">${BRAND_MARK}</span>
              <span class="dt-brand-name">DocuType</span>
            </div>
            <div class="dt-status">
              <span class="dt-status-dot" aria-hidden="true"></span>
              <span class="dt-status-label" data-role="status" role="status" aria-live="polite">Starting…</span>
            </div>
          </div>

          <div class="dt-progress-row">
            <div
              class="dt-progress-track"
              role="progressbar"
              aria-label="Typing progress"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              aria-valuetext="Approximately 0 percent inserted into the document"
            >
              <span class="dt-progress-fill" data-role="progress-fill"></span>
            </div>
            <span class="dt-percent" data-role="percent">≈ 0%</span>
          </div>

          <div class="dt-bottom">
            <div class="dt-meta">
              <span class="dt-count" data-role="count">0 / ${this._total} characters</span>
              <label class="dt-speed-control">
                <span class="dt-speed-label">Speed</span>
                <select class="dt-speed-select" data-role="speed" aria-label="Typing speed">
                  <option value="30">30 WPM</option>
                  <option value="45">45 WPM</option>
                  <option value="65">65 WPM</option>
                </select>
              </label>
            </div>
            <div class="dt-controls">
              <button
                class="dt-button dt-button--primary"
                type="button"
                data-action="pause"
                aria-label="Pause typing"
              >
                <span data-role="pause-icon" aria-hidden="true">${ICONS.pause}</span>
                <span data-role="pause-label">Pause</span>
              </button>
              <button
                class="dt-button dt-button--quiet"
                type="button"
                data-action="stop"
                aria-label="Stop typing"
              >
                ${ICONS.stop}
                <span>Stop</span>
              </button>
            </div>
          </div>

          <p class="dt-error" data-role="error" role="alert" hidden></p>
        </section>
      `;

      this._host = host;
      this._shadow = shadow;
      this._panel = shadow.querySelector(".dt-bar");
      this._statusLabel = shadow.querySelector('[data-role="status"]');
      this._progressTrack = shadow.querySelector('[role="progressbar"]');
      this._progressFill = shadow.querySelector('[data-role="progress-fill"]');
      this._percent = shadow.querySelector('[data-role="percent"]');
      this._count = shadow.querySelector('[data-role="count"]');
      this._speedSelect = shadow.querySelector('[data-role="speed"]');
      this._pauseButton = shadow.querySelector('[data-action="pause"]');
      this._pauseIcon = shadow.querySelector('[data-role="pause-icon"]');
      this._pauseLabel = shadow.querySelector('[data-role="pause-label"]');
      this._stopButton = shadow.querySelector('[data-action="stop"]');
      this._error = shadow.querySelector('[data-role="error"]');

      (document.body || document.documentElement).appendChild(host);
    }

    _bindEvents() {
      const options = { signal: this._abort.signal };

      this._pauseButton.addEventListener(
        "click",
        () => {
          if (this._state === "paused") {
            if (this._onResume) {
              this._onResume();
            }
          } else if (this._state === "running" || this._state === "starting") {
            if (this._onPause) {
              this._onPause();
            }
          }
        },
        options
      );

      this._speedSelect.addEventListener(
        "change",
        () => {
          const wpm = Number(this._speedSelect.value);
          if (this._onSpeedChange) {
            this._onSpeedChange(wpm);
          }
          this.setSpeed(wpm);
        },
        options
      );

      this._stopButton.addEventListener(
        "click",
        () => {
          if (this._destroyed) {
            return;
          }

          const onStop = this._onStop;
          this.destroy();
          if (onStop) {
            onStop();
          }
        },
        options
      );

      // Keep Docs keyboard shortcuts and canvas focus handling out of the bar.
      const stopPropagation = (event) => event.stopPropagation();
      for (const type of ["keydown", "keyup", "pointerdown", "click"]) {
        this._panel.addEventListener(type, stopPropagation, options);
      }

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

    _applyTheme(theme) {
      this._panel.dataset.theme = theme === "dark" ? "dark" : "light";
    }
  }

  namespace.ControlBar = ControlBar;
})(typeof globalThis !== "undefined" ? globalThis : this);
