(function bootDocuTypeContent(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});

  // The popup injects all content files on every Start so already-open Docs
  // tabs work immediately after installation. This guard keeps one listener
  // and one live session no matter how often the bundle is injected.
  if (namespace.__contentBooted) {
    return;
  }

  const shared = namespace.shared;
  const humanize = namespace.humanize;
  const browserApi = namespace.browserApi;
  const docsInput = namespace.docsInput;
  const ControlBar = namespace.ControlBar;
  const TypingEngine = namespace.TypingEngine;
  const extensionApi = browserApi && browserApi.getExtensionApi(root);

  if (
    !shared ||
    !humanize ||
    !docsInput ||
    typeof ControlBar !== "function" ||
    typeof TypingEngine !== "function" ||
    !extensionApi ||
    !extensionApi.runtime ||
    !extensionApi.runtime.onMessage ||
    typeof extensionApi.runtime.onMessage.addListener !== "function"
  ) {
    return;
  }

  const INITIAL_DELAY_MS = 1200;
  let activeSession = null;

  function isSupportedPage() {
    try {
      return shared.isGoogleDocsDocumentUrl(root.location.href);
    } catch {
      return false;
    }
  }

  function createSession(text, wpm, editor, level, pdfRows) {
    const plan = pdfRows ? text : humanize.buildTypingPlan(text, { level });
    const total = shared.countCharacters(plan);
    const rowStarts = new Map();
    let offset = 1;
    for (const row of pdfRows || []) {
      rowStarts.set(offset, row);
      offset += shared.countCharacters(row.runs.map((run) => run.text).join("")) + 1;
    }
    let bar = null;
    let engine = null;
    let session = null;
    let destroyed = false;

    function destroySession() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      if (activeSession === session) {
        activeSession = null;
      }

      if (engine) {
        engine.destroy();
      }

      if (bar) {
        bar.destroy();
      }
    }

    try {
      bar = new ControlBar({
        total,
        wpm,
        onPause() {
          if (engine && engine.state === "running") {
            engine.pause();
          }
        },
        onResume() {
          if (engine && engine.state === "paused") {
            engine.resume();
          }
        },
        onSpeedChange(nextWpm) {
          if (engine && engine.setWpm(nextWpm)) {
            bar.setSpeed(nextWpm);
          }
        },
        onStop: destroySession,
      });

      engine = new TypingEngine({
        text: plan,
        wpm,
        initialDelayMs: INITIAL_DELAY_MS,
        onReveal({ char, index, total }) {
          const row = rowStarts.get(index);
          const result =
            pdfRows
              ? row && docsInput.insertPdfRow(editor, row, index === 1)
              : char === shared.BACKSPACE_MARKER
              ? docsInput.insertBackspace(editor)
              : docsInput.insertUnit(editor, char);
          if (result && !result.ok) {
            engine.stop();
            bar.setError(result.message);
            return;
          }

          bar.setProgress(index, total);
        },
        onStateChange(state) {
          bar.setState(state);
        },
        onComplete() {
          bar.setProgress(total, total);
        },
      });

      session = { destroy: destroySession };

      if (!engine.start()) {
        destroySession();
        return null;
      }

      return session;
    } catch {
      if (engine) {
        engine.destroy();
      }
      if (bar) {
        bar.destroy();
      }
      return null;
    }
  }

  function startSession(message) {
    if (!isSupportedPage()) {
      return { ok: false, code: "NOT_DOCS" };
    }

    const pdfRows = Array.isArray(message.pdfRows) ? message.pdfRows : null;
    if (pdfRows && !pdfRows.every((row) => Array.isArray(row?.runs) &&
      row.runs.length > 0 && row.runs.every((run) => typeof run?.text === "string"))) {
      return { ok: false, code: "START_FAILED" };
    }
    const text = pdfRows
      ? pdfRows.map((row) => row.runs.map((run) => run.text).join("")).join("\n")
      : shared.normalizePassage(message.text);
    if (!text) {
      return { ok: false, code: "EMPTY_TEXT" };
    }

    if (shared.countCharacters(text) > shared.MAX_TEXT_LENGTH) {
      return { ok: false, code: "TEXT_TOO_LONG" };
    }

    const wpm = shared.clampWpm(message && message.wpm);
    const level = shared.clampHumanizeLevel(message && message.humanizeLevel);

    // Check for the editor before replacing a running session, so a bad
    // request cannot kill work that is already inserting text.
    const editor = docsInput.findEditor(root.document);
    if (!editor) {
      return { ok: false, code: "EDITOR_NOT_FOUND" };
    }

    if (activeSession) {
      const previousSession = activeSession;
      activeSession = null;
      previousSession.destroy();
    }

    const session = createSession(text, wpm, editor, level, pdfRows);
    if (!session) {
      return { ok: false, code: "START_FAILED" };
    }

    activeSession = session;
    return { ok: true };
  }

  function handleMessage(message, sender, sendResponse) {
    if (!message || message.type !== shared.START_SESSION_MESSAGE) {
      return false;
    }

    sendResponse(startSession(message));
    return false;
  }

  namespace.__contentBooted = true;
  extensionApi.runtime.onMessage.addListener(handleMessage);
})(typeof globalThis !== "undefined" ? globalThis : this);
