(function initializeControlBarStyles(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});
  if (typeof namespace.CONTROL_BAR_STYLES === "string") {
    return;
  }

  namespace.CONTROL_BAR_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: auto 20px 20px auto;
  z-index: 2147483647;
  display: block;
  width: min(344px, calc(100vw - 32px));
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

.dt-bar {
  --dt-surface: #fbf8f2;
  --dt-text: #1a1b1e;
  --dt-muted: #746f66;
  --dt-faint: #9b958b;
  --dt-line: #e5ded1;
  --dt-line-strong: #d7cfc0;
  --dt-accent: #e15b34;
  --dt-accent-soft: rgba(225, 91, 52, 0.1);
  --dt-primary-bg: #1a1b1e;
  --dt-primary-text: #fbf7f0;
  --dt-button-bg: rgba(255, 255, 255, 0.55);
  --dt-button-hover: #f3ede3;
  --dt-paused: #a66a1f;
  --dt-success: #2f7a55;
  --dt-danger: #b3452c;
  --dt-shadow:
    0 18px 42px -12px rgba(38, 30, 18, 0.3),
    0 3px 12px rgba(38, 30, 18, 0.08);

  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 12px 13px 11px;
  color: var(--dt-text);
  color-scheme: light;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), transparent 42%),
    var(--dt-surface);
  border: 1px solid var(--dt-line);
  border-radius: 15px;
  box-shadow: var(--dt-shadow);
  animation: dt-bar-in 180ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  font-size: 12px;
}

.dt-bar[data-theme="dark"] {
  --dt-surface: #1c1e22;
  --dt-text: #f3ede3;
  --dt-muted: #a7a197;
  --dt-faint: #7f7a72;
  --dt-line: #34373d;
  --dt-line-strong: #42454c;
  --dt-accent: #ff7a4d;
  --dt-accent-soft: rgba(255, 122, 77, 0.12);
  --dt-primary-bg: #f3ede3;
  --dt-primary-text: #1b1c1f;
  --dt-button-bg: rgba(255, 255, 255, 0.035);
  --dt-button-hover: #2a2d32;
  --dt-paused: #e2b567;
  --dt-success: #7cc9a1;
  --dt-danger: #ff9b82;
  --dt-shadow:
    0 20px 46px -12px rgba(0, 0, 0, 0.62),
    0 3px 14px rgba(0, 0, 0, 0.28);

  color-scheme: dark;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 42%),
    var(--dt-surface);
}

.dt-top,
.dt-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.dt-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.dt-brand-mark {
  display: block;
  flex: none;
  width: 22px;
  height: 22px;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.dt-brand-mark svg {
  display: block;
  width: 100%;
  height: 100%;
}

.dt-brand-name {
  overflow: hidden;
  color: var(--dt-text);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: -0.012em;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  padding: 4px 7px;
  color: var(--dt-muted);
  background: var(--dt-button-bg);
  border: 1px solid var(--dt-line);
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1;
  text-transform: uppercase;
}

.dt-status-dot {
  width: 5px;
  height: 5px;
  background: var(--dt-accent);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--dt-accent-soft);
  animation: dt-status-pulse 2.2s ease-in-out infinite;
}

.dt-bar[data-state="paused"] .dt-status-dot {
  background: var(--dt-paused);
  box-shadow: 0 0 0 3px rgba(166, 106, 31, 0.1);
  animation: none;
}

.dt-bar[data-state="complete"] .dt-status-dot {
  background: var(--dt-success);
  box-shadow: 0 0 0 3px rgba(47, 122, 85, 0.1);
  animation: none;
}

.dt-bar[data-state="error"] .dt-status-dot,
.dt-bar[data-state="stopped"] .dt-status-dot {
  background: var(--dt-danger);
  box-shadow: 0 0 0 3px var(--dt-accent-soft);
  animation: none;
}

.dt-progress-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.dt-progress-track {
  flex: 1;
  height: 4px;
  overflow: hidden;
  background: var(--dt-line);
  border-radius: 999px;
}

.dt-progress-fill {
  display: block;
  width: 0%;
  height: 100%;
  background: var(--dt-accent);
  border-radius: inherit;
  transition: width 180ms cubic-bezier(0.22, 0.8, 0.24, 1);
}

.dt-percent {
  flex: none;
  min-width: 38px;
  color: var(--dt-text);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: 0.005em;
  text-align: right;
}

.dt-meta {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
  color: var(--dt-muted);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.008em;
  line-height: 1.3;
}

.dt-count {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-speed-control {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  color: var(--dt-muted);
}

.dt-speed-label {
  color: var(--dt-faint);
}

.dt-speed-select {
  max-width: 66px;
  padding: 2px 3px;
  color: var(--dt-text);
  background: var(--dt-button-bg);
  border: 1px solid var(--dt-line);
  border-radius: 5px;
  font: inherit;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.dt-speed-select:focus-visible {
  outline: 2px solid var(--dt-accent);
  outline-offset: 2px;
}

.dt-speed-select:disabled {
  opacity: 0.65;
  cursor: default;
}

.dt-controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.dt-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 30px;
  padding: 0 9px;
  color: var(--dt-text);
  background: var(--dt-button-bg);
  border: 1px solid var(--dt-line);
  border-radius: 8px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: -0.005em;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 90ms ease;
}

.dt-button:hover {
  background: var(--dt-button-hover);
  border-color: var(--dt-line-strong);
}

.dt-button:active {
  transform: scale(0.985);
}

.dt-button:focus-visible {
  outline: 2px solid var(--dt-accent);
  outline-offset: 2px;
}

.dt-button:disabled {
  color: var(--dt-faint);
  cursor: default;
  opacity: 0.62;
  transform: none;
}

.dt-button--primary {
  color: var(--dt-primary-text);
  background: var(--dt-primary-bg);
  border-color: transparent;
}

.dt-button--primary:hover {
  color: var(--dt-primary-text);
  background: var(--dt-primary-bg);
  border-color: transparent;
  opacity: 0.9;
}

.dt-button--primary:disabled {
  color: var(--dt-primary-text);
  background: var(--dt-primary-bg);
  opacity: 0.45;
}

.dt-button--quiet {
  color: var(--dt-muted);
  background: transparent;
}

.dt-button--quiet:hover {
  color: var(--dt-danger);
  background: var(--dt-accent-soft);
  border-color: transparent;
}

.dt-button svg {
  flex: none;
  width: 12px;
  height: 12px;
}

.dt-error {
  margin: 0;
  padding: 7px 8px;
  color: var(--dt-danger);
  background: var(--dt-accent-soft);
  border-radius: 7px;
  font-size: 10px;
  letter-spacing: 0.002em;
  line-height: 1.4;
}

@keyframes dt-bar-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dt-status-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px var(--dt-accent-soft);
  }
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}

@media (max-width: 520px) {
  :host {
    inset: auto 12px 12px auto;
    width: calc(100vw - 24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dt-bar,
  .dt-status-dot {
    animation: none;
  }

  .dt-progress-fill,
  .dt-button {
    transition: none;
  }
}
`;
})(typeof globalThis !== "undefined" ? globalThis : this);
