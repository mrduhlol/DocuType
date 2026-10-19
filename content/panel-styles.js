(function initializePanelStyles(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});
  if (typeof namespace.PANEL_STYLES === "string") {
    return;
  }

  namespace.PANEL_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: auto 24px 24px auto;
  z-index: 2147483647;
  display: block;
  width: min(400px, calc(100vw - 32px));
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

.dt-panel {
  --dt-surface: #fbf8f2;
  --dt-surface-raised: #fffdf9;
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
  --dt-chip-bg: rgba(255, 255, 255, 0.62);
  --dt-paused: #a66a1f;
  --dt-success: #2f7a55;
  --dt-danger: #b3452c;
  --dt-shadow:
    0 24px 60px -12px rgba(38, 30, 18, 0.32),
    0 4px 16px rgba(38, 30, 18, 0.08);
  --dt-ease: cubic-bezier(0.22, 0.8, 0.24, 1);

  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  color: var(--dt-text);
  color-scheme: light;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent 36%),
    var(--dt-surface);
  border: 1px solid var(--dt-line);
  border-radius: 18px;
  box-shadow: var(--dt-shadow);
  animation: dt-panel-in 240ms var(--dt-ease) both;
}

.dt-panel[data-theme="dark"] {
  --dt-surface: #1c1e22;
  --dt-surface-raised: #23252a;
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
  --dt-chip-bg: rgba(255, 255, 255, 0.04);
  --dt-paused: #e2b567;
  --dt-success: #7cc9a1;
  --dt-danger: #ff9b82;
  --dt-shadow:
    0 28px 70px -12px rgba(0, 0, 0, 0.65),
    0 4px 18px rgba(0, 0, 0, 0.3);

  color-scheme: dark;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 36%),
    var(--dt-surface);
}

.dt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 16px 10px;
}

.dt-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dt-brand-mark {
  display: block;
  flex: none;
  width: 24px;
  height: 24px;
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
  font-size: 13.5px;
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
  gap: 6px;
  min-height: 24px;
  padding: 4px 8px;
  color: var(--dt-muted);
  background: var(--dt-chip-bg);
  border: 1px solid var(--dt-line);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1;
  text-transform: uppercase;
}

.dt-status-dot {
  width: 6px;
  height: 6px;
  background: var(--dt-accent);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--dt-accent-soft);
  animation: dt-status-pulse 2.2s ease-in-out infinite;
}

.dt-panel[data-state="paused"] .dt-status-dot {
  background: var(--dt-paused);
  box-shadow: 0 0 0 3px rgba(166, 106, 31, 0.1);
  animation: none;
}

.dt-panel[data-state="complete"] .dt-status-dot {
  background: var(--dt-success);
  box-shadow: 0 0 0 3px rgba(47, 122, 85, 0.1);
  animation: none;
}

.dt-status-label {
  padding-top: 0.5px;
}

.dt-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 6px 18px 16px;
}

.dt-passage-scroll {
  min-height: 132px;
  max-height: 208px;
  padding: 9px 3px 5px 1px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--dt-line-strong) transparent;
  scrollbar-width: thin;
}

.dt-passage-scroll::-webkit-scrollbar {
  width: 8px;
}

.dt-passage-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.dt-passage-scroll::-webkit-scrollbar-thumb {
  background: var(--dt-line-strong);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.dt-passage {
  margin: 0;
  color: var(--dt-text);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
  font-size: 17.5px;
  font-weight: 400;
  letter-spacing: 0.002em;
  line-height: 1.68;
  overflow-wrap: anywhere;
  text-align: start;
  white-space: pre-wrap;
}

.dt-placeholder {
  color: var(--dt-muted);
  font-style: italic;
}

.dt-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.13em;
  background: var(--dt-accent);
  border-radius: 2px;
  animation: dt-caret-blink 1.08s steps(1, end) infinite;
}

.dt-panel[data-state="paused"] .dt-caret {
  opacity: 0.5;
  animation: none;
}

.dt-panel[data-state="complete"] .dt-caret {
  display: none;
}

.dt-complete-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 2px;
  color: var(--dt-success);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.dt-complete-note svg {
  flex: none;
  width: 14px;
  height: 14px;
}

.dt-progress {
  padding-top: 8px;
}

.dt-progress-track {
  width: 100%;
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
  transition: width 180ms var(--dt-ease);
}

.dt-progress-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 7px;
  color: var(--dt-muted);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.008em;
  line-height: 1.35;
}

.dt-percent {
  color: var(--dt-text);
  font-weight: 650;
}

.dt-count {
  color: var(--dt-faint);
  text-align: right;
}

.dt-footer {
  padding: 13px 16px 14px;
  background: rgba(255, 255, 255, 0.28);
  border-top: 1px solid var(--dt-line);
}

.dt-panel[data-theme="dark"] .dt-footer {
  background: rgba(255, 255, 255, 0.014);
}

.dt-controls {
  display: grid;
  grid-template-columns: 1.28fr 1fr 0.82fr;
  gap: 7px;
}

.dt-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 38px;
  padding: 0 10px;
  color: var(--dt-text);
  background: var(--dt-button-bg);
  border: 1px solid var(--dt-line);
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
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
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
}

.dt-button--primary:hover {
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

.dt-button-icon,
.dt-button svg {
  flex: none;
  width: 14px;
  height: 14px;
}

.dt-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 9px 1px 0;
  color: var(--dt-muted);
  font-size: 10.2px;
  letter-spacing: 0.002em;
  line-height: 1.45;
}

.dt-note svg {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 1px;
  opacity: 0.72;
}

.dt-note-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dt-note-primary {
  color: var(--dt-muted);
  font-weight: 550;
}

.dt-note-secondary {
  color: var(--dt-faint);
}

@keyframes dt-panel-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dt-caret-blink {
  0%,
  45% {
    opacity: 1;
  }
  46%,
  100% {
    opacity: 0;
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
    inset: auto 16px 16px auto;
    width: calc(100vw - 32px);
  }

  .dt-panel {
    max-height: calc(100vh - 32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dt-panel {
    animation: none;
  }

  .dt-caret,
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
