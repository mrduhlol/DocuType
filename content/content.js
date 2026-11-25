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
  let preparingPdf = false;

  function isSupportedPage() {
    try {
      return shared.isGoogleDocsDocumentUrl(root.location.href);
    } catch {
      return false;
    }
  }

  function buildPdfPlan(rows, level, border) {
    const units = [];
    const parts = [];
    for (const [index, row] of rows.entries()) {
      const startsPage = index === 0 || row.pageBreak;
      const endsPage = index === rows.length - 1 || rows[index + 1].pageBreak;
      const paragraph = border?.width > 0
        ? { ...row, border: { ...border, top: startsPage, bottom: endsPage } }
        : row;
      if (index > 0) {
        parts.push("\n");
        units.push(null);
      }
      let first = true;
      for (const run of row.runs) {
        const text = /^\(img \d+\)$/.test(run.text) ? run.text : humanize.buildTypingPlan(run.text, { level });
        parts.push(text);
        for (const character of text) {
          units.push({ run, paragraph: first ? paragraph : undefined });
          first = false;
        }
      }
    }
    return { text: parts.join(""), units };
  }

  function createSession(text, wpm, editor, level, pdfRows, layout) {
    const pdf = pdfRows ? buildPdfPlan(pdfRows, level, layout?.border) : null;
    const plan = pdf ? pdf.text : humanize.buildTypingPlan(text, { level });
    const total = shared.countCharacters(plan);
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
          const unit = pdf?.units[index - 1];
          const result =
            char === shared.BACKSPACE_MARKER
              ? docsInput.insertBackspace(editor)
              : unit
                ? docsInput.insertPdfCharacter(editor, char, unit.run, unit.paragraph)
                : docsInput.insertUnit(editor, char);
          if (!result.ok) {
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

    if (preparingPdf) {
      return { ok: false, code: "PDF_LAYOUT_FAILED" };
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

    const prepare = namespace.pdfPageSetup?.prepare;
    if (pdfRows && typeof prepare !== "function") {
      return { ok: false, code: "PDF_LAYOUT_UNAVAILABLE" };
    }

    if (activeSession) {
      const previousSession = activeSession;
      activeSession = null;
      previousSession.destroy();
    }

    function beginTyping(nextEditor = editor) {
      const session = createSession(text, wpm, nextEditor, level, pdfRows, message.pdfLayout);
      if (!session) return { ok: false, code: "START_FAILED" };
      activeSession = session;
      return { ok: true };
    }

    if (!pdfRows) return beginTyping();

    preparingPdf = true;
    return Promise.resolve()
      .then(() => prepare({ editor, layout: message.pdfLayout, rows: pdfRows }))
      .then((result) => {
        if (result?.ok === false) return result;
        const nextEditor = docsInput.findEditor(root.document);
        return nextEditor ? beginTyping(nextEditor) : { ok: false, code: "EDITOR_NOT_FOUND" };
      })
      .catch(() => ({ ok: false, code: "PDF_LAYOUT_FAILED" }))
      .finally(() => { preparingPdf = false; });
  }

  function handleMessage(message, sender, sendResponse) {
    if (!message || message.type !== shared.START_SESSION_MESSAGE) {
      return false;
    }

    const result = startSession(message);
    if (result instanceof Promise) {
      result.then(sendResponse);
      return true;
    }
    sendResponse(result);
    return false;
  }

  namespace.__contentBooted = true;
  extensionApi.runtime.onMessage.addListener(handleMessage);
})(typeof globalThis !== "undefined" ? globalThis : this);
