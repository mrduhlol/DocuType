(function initializePopup() {
  "use strict";

  const shared = globalThis.DocuType && globalThis.DocuType.shared;
  if (!shared) {
    return;
  }

  const CONTENT_FILES = [
    "lib/shared.js",
    "content/typing-engine.js",
    "content/panel-styles.js",
    "content/panel.js",
    "content/content.js",
  ];

  const DEFAULT_SPEED_ID = "steady";

  const CONTENT_ERROR_COPY = {
    NOT_DOCS:
      "This tab isn't a Google Docs document. Open your document, then reopen DocuType.",
    EMPTY_TEXT: "Add a passage before starting.",
    TEXT_TOO_LONG: "This passage is longer than 10,000 characters. Shorten it and try again.",
    START_FAILED: "DocuType couldn't open the practice panel. Reload the document and try again.",
    TAB_NOT_READY: "This tab isn't ready yet. Give the document a moment, then try again.",
  };

  const BANNER_COPY = {
    NO_TAB: "No active tab found. Open a Google Docs document, then reopen DocuType.",
    DISCARDED: "This tab is inactive or discarded. Open the document again, then reopen DocuType.",
    NOT_DOCS: "DocuType works only in Google Docs documents. Open your document, then reopen DocuType.",
    QUERY_FAILED: "DocuType couldn't check this tab. Reopen the popup and try again.",
  };

  const ARROW_ICON = `
    <svg viewBox="0 0 16 16" fill="none" focusable="false">
      <path d="M3.4 8h8.4M8.4 4.6 11.8 8l-3.4 3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const SPINNER_ICON = `
    <svg viewBox="0 0 16 16" fill="none" focusable="false">
      <path d="M13.2 8a5.2 5.2 0 1 1-1.55-3.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;

  const state = {
    initialized: false,
    ready: false,
    tab: null,
    inFlight: false,
  };

  let elements = null;

  function cacheElements() {
    elements = {
      form: document.getElementById("sessionForm"),
      passage: document.getElementById("passage"),
      charCount: document.getElementById("charCount"),
      speedOptions: document.getElementById("speedOptions"),
      startButton: document.getElementById("startButton"),
      startLabel: document.getElementById("startLabel"),
      startIcon: document.getElementById("startIcon"),
      formError: document.getElementById("formError"),
      contextBanner: document.getElementById("contextBanner"),
      contextText: document.getElementById("contextText"),
      openDocsLink: document.getElementById("openDocsLink"),
    };
  }

  function renderSpeedOptions() {
    const fragment = document.createDocumentFragment();

    for (const speed of shared.SPEEDS) {
      const option = document.createElement("label");
      option.className = "speed-option";

      const input = document.createElement("input");
      input.className = "speed-input";
      input.type = "radio";
      input.name = "wpm";
      input.value = String(speed.wpm);
      input.checked = speed.id === DEFAULT_SPEED_ID;
      input.setAttribute("aria-label", `${speed.label} — ${speed.wpm} words per minute`);

      const body = document.createElement("span");
      body.className = "speed-option-body";

      const name = document.createElement("span");
      name.className = "speed-name";
      name.textContent = speed.label;

      const wpm = document.createElement("span");
      wpm.className = "speed-wpm";
      wpm.textContent = `${speed.wpm} WPM`;

      body.append(name, wpm);
      option.append(input, body);
      fragment.append(option);
    }

    elements.speedOptions.replaceChildren(fragment);
  }

  function updateCharCount() {
    const count = shared.countCharacters(elements.passage.value);
    elements.charCount.textContent = `${count.toLocaleString("en-US")} / 10,000`;
  }

  function updateStartState() {
    const hasText = shared.normalizePassage(elements.passage.value).length > 0;
    elements.startButton.disabled = state.inFlight || !state.ready || !hasText;
  }

  function showBanner(message) {
    elements.contextText.textContent = message;
    elements.contextBanner.hidden = false;
    elements.openDocsLink.hidden = false;
  }

  function clearBanner() {
    elements.contextText.textContent = "";
    elements.contextBanner.hidden = true;
    elements.openDocsLink.hidden = true;
  }

  function showError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
  }

  function clearError() {
    elements.formError.textContent = "";
    elements.formError.hidden = true;
  }

  function setInFlight(value) {
    state.inFlight = value;
    elements.startButton.classList.toggle("is-loading", value);
    elements.startLabel.textContent = value ? "Starting…" : "Start practice session";
    elements.startIcon.innerHTML = value ? SPINNER_ICON : ARROW_ICON;
    updateStartState();
  }

  function getSelectedWpm() {
    const radio = elements.form.querySelector('input[name="wpm"]:checked');
    return shared.clampWpm(radio ? radio.value : undefined);
  }

  async function inspectActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : null;

      if (!tab || typeof tab.id !== "number") {
        return { ok: false, reason: "NO_TAB" };
      }

      if (tab.discarded) {
        return { ok: false, reason: "DISCARDED", tab };
      }

      if (!shared.isGoogleDocsDocumentUrl(tab.url)) {
        return { ok: false, reason: "NOT_DOCS", tab };
      }

      return { ok: true, tab };
    } catch {
      return { ok: false, reason: "QUERY_FAILED" };
    }
  }

  async function refreshTabState() {
    const check = await inspectActiveTab();
    state.ready = check.ok;
    state.tab = check.ok ? check.tab : null;

    if (check.ok) {
      clearBanner();
    } else {
      showBanner(BANNER_COPY[check.reason] || BANNER_COPY.QUERY_FAILED);
    }

    updateStartState();
    return check;
  }

  async function injectContentScripts(tabId) {
    for (const file of CONTENT_FILES) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [file],
      });
    }
  }

  function describeStartError(error) {
    const message = error && error.message ? String(error.message) : "";

    if (/receiving end does not exist|could not establish connection/i.test(message)) {
      return "DocuType couldn't connect to this document. Reload the Google Docs tab and try again.";
    }

    if (/cannot access|extensions gallery|chrome:\/\//i.test(message)) {
      return "Chrome blocked DocuType on this tab. Reload the document and try again.";
    }

    return "DocuType couldn't start the session. Reload the Google Docs tab and try again.";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state.inFlight) {
      return;
    }

    clearError();

    const text = shared.normalizePassage(elements.passage.value);
    if (!text) {
      showError(CONTENT_ERROR_COPY.EMPTY_TEXT);
      elements.passage.focus();
      return;
    }

    if (!state.ready || !state.tab) {
      const check = await refreshTabState();
      if (!check.ok) {
        showError(BANNER_COPY[check.reason] || BANNER_COPY.QUERY_FAILED);
        return;
      }
    }

    const tab = state.tab;
    const wpm = getSelectedWpm();
    setInFlight(true);

    try {
      await injectContentScripts(tab.id);

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: shared.START_SESSION_MESSAGE,
        text,
        wpm,
      });

      if (!response || response.ok !== true) {
        showError(CONTENT_ERROR_COPY[response && response.code] || CONTENT_ERROR_COPY.START_FAILED);
        setInFlight(false);
        return;
      }

      window.close();
    } catch (error) {
      showError(describeStartError(error));
      setInFlight(false);
    }
  }

  function bindEvents() {
    elements.passage.addEventListener("input", () => {
      updateCharCount();
      updateStartState();
      clearError();
    });

    elements.form.addEventListener("submit", handleSubmit);
  }

  async function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    cacheElements();
    renderSpeedOptions();
    updateCharCount();
    updateStartState();
    bindEvents();
    await refreshTabState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    init();
  }
})();
