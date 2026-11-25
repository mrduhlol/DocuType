(function initializePopup() {
  "use strict";

  const shared = globalThis.DocuType && globalThis.DocuType.shared;
  const browserApi = globalThis.DocuType && globalThis.DocuType.browserApi;
  const extensionApi = browserApi && browserApi.getExtensionApi(globalThis);
  if (!shared || !extensionApi) {
    return;
  }

  const CONTENT_FILES = [
    "lib/shared.js",
    "lib/humanize.js",
    "lib/browser-api.js",
    "content/typing-engine.js",
    "content/docs-input.js",
    "content/pdf-page-setup.js",
    "content/control-bar-styles.js",
    "content/control-bar.js",
    "content/content.js",
  ];

  const DEFAULT_SPEED_ID = "steady";
  const DEFAULT_STYLE_ID = "small";
  const STYLE_DESCRIPTIONS = Object.freeze({
    clean: "None",
    small: "A few",
    medium: "Some",
    more: "Lots",
  });

  const STYLE_HINTS = Object.freeze({
    0: "Types your passage exactly as pasted, with no added errors.",
    1: "A few errors may stay in the text. Other typos are backspaced and corrected.",
    2: "Some errors may stay in the text. Other typos are backspaced and corrected.",
    3: "More errors may stay in the text. Other typos are backspaced and corrected.",
  });

  const CONTENT_ERROR_COPY = {
    NOT_DOCS:
      "This tab isn't a Google Docs document. Open your document, then reopen DocuType.",
    EMPTY_TEXT: "Add a passage before starting.",
    TEXT_TOO_LONG: "This passage is longer than 10,000 characters. Shorten it and try again.",
    EDITOR_NOT_FOUND:
      "DocuType couldn't find the document editor. Click into the document, then try again.",
    PASTE_REJECTED:
      "Google Docs rejected the text. Make sure the document is editable and try again.",
    TYPE_FAILED: "DocuType couldn't type into this document. Reload the page and try again.",
    START_FAILED: "DocuType couldn't start typing. Reload the document and try again.",
    PDF_LAYOUT_FAILED:
      "DocuType couldn't set up the page. Open a blank Google Doc in Pages mode, then try again.",
    PDF_LAYOUT_UNAVAILABLE:
      "DocuType couldn't open Page setup. Use a blank Google Doc with an English interface, then try again.",
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
    mode: "passage",
    pdfFile: null,
    styles: { upload: 0 },
  };

  let elements = null;

  function cacheElements() {
    elements = {
      form: document.getElementById("sessionForm"),
      passage: document.getElementById("passage"),
      charCount: document.getElementById("charCount"),
      speedOptions: document.getElementById("speedOptions"),
      styleOptions: document.getElementById("styleOptions"),
      styleHint: document.getElementById("styleHint"),
      documentStatus: document.getElementById("documentStatus"),
      startButton: document.getElementById("startButton"),
      startLabel: document.getElementById("startLabel"),
      startIcon: document.getElementById("startIcon"),
      formError: document.getElementById("formError"),
      contextBanner: document.getElementById("contextBanner"),
      contextText: document.getElementById("contextText"),
      openDocsLink: document.getElementById("openDocsLink"),
      passageMode: document.getElementById("passageMode"),
      uploadMode: document.getElementById("uploadMode"),
      passagePanel: document.getElementById("passagePanel"),
      uploadPanel: document.getElementById("uploadPanel"),
      pdfDrop: document.getElementById("pdfDrop"),
      pdfFile: document.getElementById("pdfFile"),
      pdfChooseLabel: document.getElementById("pdfChooseLabel"),
      pdfName: document.getElementById("pdfName"),
      pdfStatus: document.getElementById("pdfStatus"),
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

  function renderStyleOptions() {
    const fragment = document.createDocumentFragment();

    for (const style of shared.HUMANIZE_LEVELS) {
      const option = document.createElement("label");
      option.className = "speed-option";

      const input = document.createElement("input");
      input.className = "speed-input";
      input.type = "radio";
      input.name = "style";
      input.value = String(style.value);
      input.checked = style.id === DEFAULT_STYLE_ID;
      input.setAttribute(
        "aria-label",
        `${style.label} — ${STYLE_DESCRIPTIONS[style.id]} added errors`
      );

      const body = document.createElement("span");
      body.className = "speed-option-body";

      const name = document.createElement("span");
      name.className = "speed-name";
      name.textContent = style.label;

      const description = document.createElement("span");
      description.className = "speed-wpm";
      description.textContent = STYLE_DESCRIPTIONS[style.id];

      body.append(name, description);
      option.append(input, body);
      fragment.append(option);
    }

    elements.styleOptions.replaceChildren(fragment);
    updateStyleHint();
  }

  function updateStyleHint() {
    const style = getSelectedStyle();
    elements.styleHint.textContent = state.mode === "upload" && style === 0
      ? "Types the PDF text without adding mistakes."
      : STYLE_HINTS[style];
  }

  function updateCharCount() {
    const count = shared.countCharacters(elements.passage.value);
    elements.charCount.textContent = `${count.toLocaleString("en-US")} / 10,000`;
  }

  function updateStartState() {
    const hasInput = state.mode === "upload"
      ? Boolean(state.pdfFile)
      : shared.normalizePassage(elements.passage.value).length > 0;
    elements.startButton.disabled = state.inFlight || !state.ready || !hasInput;
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
    elements.pdfDrop.disabled = value;
    elements.passageMode.disabled = value;
    elements.uploadMode.disabled = value;
    elements.speedOptions.closest("fieldset").disabled = value;
    elements.styleOptions.closest("fieldset").disabled = value;
    elements.startButton.classList.toggle("is-loading", value);
    elements.startLabel.textContent = value ? "Starting…" : "Start typing";
    elements.startIcon.innerHTML = value ? SPINNER_ICON : ARROW_ICON;
    updateStartState();
  }

  function getSelectedWpm() {
    const radio = elements.form.querySelector('input[name="wpm"]:checked');
    return shared.clampWpm(radio ? radio.value : undefined);
  }

  function getSelectedStyle() {
    const radio = elements.form.querySelector('input[name="style"]:checked');
    return shared.clampHumanizeLevel(radio ? radio.value : undefined);
  }

  async function inspectActiveTab() {
    try {
      const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
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
    elements.documentStatus.textContent = check.ok ? "Document ready" : "Open Google Docs";
    elements.documentStatus.classList.toggle("is-ready", check.ok);

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
      await extensionApi.scripting.executeScript({
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
      return "The browser blocked DocuType on this tab. Reload the document and try again.";
    }

    return "DocuType couldn't start typing. Reload the Google Docs tab and try again.";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state.inFlight) {
      return;
    }

    clearError();

    const file = state.mode === "upload" ? state.pdfFile : null;
    const text = file ? "" : shared.normalizePassage(elements.passage.value);
    if (state.mode === "upload" && !file) {
      showError("Choose a PDF before starting.");
      elements.pdfDrop.focus();
      return;
    }
    if (!file && !text) {
      showError(CONTENT_ERROR_COPY.EMPTY_TEXT);
      elements.passage.focus();
      return;
    }

    const wpm = getSelectedWpm();
    const humanizeLevel = getSelectedStyle();
    setInFlight(true);

    try {
      const check = state.ready && state.tab ? { ok: true, tab: state.tab } : await refreshTabState();
      if (!check.ok) {
        showError(BANNER_COPY[check.reason] || BANNER_COPY.QUERY_FAILED);
        return;
      }

      let source = { text };
      if (file) {
        elements.pdfStatus.textContent = "Reading PDF…";
        try {
          const { readPdf } = await import("../lib/pdf-import.mjs");
          const pdfRows = await readPdf(file, shared.MAX_TEXT_LENGTH);
          source = { pdfRows, pdfLayout: pdfRows.layout };
        } catch (error) {
          showError(error.message || "DocuType couldn't read this PDF.");
          return;
        }
        elements.pdfStatus.textContent = "Setting up the Google Doc…";
      }

      const { tab } = check;
      await injectContentScripts(tab.id);

      const response = await extensionApi.tabs.sendMessage(tab.id, {
        type: shared.START_SESSION_MESSAGE,
        ...source,
        wpm,
        humanizeLevel,
      });

      if (!response || response.ok !== true) {
        showError(CONTENT_ERROR_COPY[response && response.code] || CONTENT_ERROR_COPY.START_FAILED);
        return;
      }

      window.close();
    } catch (error) {
      showError(describeStartError(error));
    } finally {
      if (file) {
        elements.pdfStatus.textContent = "Place your cursor in a blank Google Doc before starting.";
      }
      setInFlight(false);
    }
  }

  function switchMode(mode) {
    if (state.inFlight || state.mode === mode) return;
    state.styles[state.mode] = getSelectedStyle();
    state.mode = mode;
    const uploading = mode === "upload";
    elements.passageMode.setAttribute("aria-pressed", String(!uploading));
    elements.uploadMode.setAttribute("aria-pressed", String(uploading));
    elements.passagePanel.hidden = uploading;
    elements.uploadPanel.hidden = !uploading;
    elements.form.querySelector(`input[name="style"][value="${state.styles[mode]}"]`).checked = true;
    updateStyleHint();
    updateStartState();
    clearError();
  }

  function selectPdf(files) {
    if (!files?.length || state.inFlight) return;
    switchMode("upload");
    clearError();
    const file = files[0];
    if (files.length !== 1 || !(/\.pdf$/i.test(file.name) || file.type === "application/pdf")) {
      showError("Choose one PDF file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showError("Choose a PDF smaller than 25 MB.");
      return;
    }
    state.pdfFile = file;
    elements.pdfName.hidden = false;
    elements.pdfName.textContent = file.name;
    elements.pdfChooseLabel.textContent = "Replace PDF";
    updateStartState();
  }

  function bindEvents() {
    elements.passage.addEventListener("input", () => {
      updateCharCount();
      updateStartState();
      clearError();
    });

    elements.styleOptions.addEventListener("change", updateStyleHint);
    elements.form.addEventListener("submit", handleSubmit);

    elements.passageMode.addEventListener("click", () => switchMode("passage"));
    elements.uploadMode.addEventListener("click", () => switchMode("upload"));
    elements.pdfDrop.addEventListener("click", () => elements.pdfFile.click());
    elements.pdfFile.addEventListener("change", () => {
      selectPdf(elements.pdfFile.files);
      elements.pdfFile.value = "";
    });
    document.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    });
    document.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      elements.pdfDrop.classList.remove("is-dragging");
      selectPdf(event.dataTransfer.files);
    });
    elements.pdfDrop.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.dataTransfer.dropEffect = state.inFlight ? "none" : "copy";
      elements.pdfDrop.classList.toggle("is-dragging", !state.inFlight);
    });
    elements.pdfDrop.addEventListener("dragleave", (event) => {
      if (!elements.pdfDrop.contains(event.relatedTarget)) elements.pdfDrop.classList.remove("is-dragging");
    });
  }

  async function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    cacheElements();
    renderSpeedOptions();
    renderStyleOptions();
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
