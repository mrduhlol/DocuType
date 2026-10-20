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
  const browserApi = namespace.browserApi;
  const docsInput = namespace.docsInput;
  const ControlBar = namespace.ControlBar;
  const TypingEngine = namespace.TypingEngine;
  const extensionApi = browserApi && browserApi.getExtensionApi(root);

  if (
    !shared ||
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

  function createSession(text, wpm, editor) {
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
        total: shared.countCharacters(text),
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
        text,
        wpm,
        initialDelayMs: INITIAL_DELAY_MS,
        onReveal({ char, index, total }) {
          const result = docsInput.insertUnit(editor, char);
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
          bar.setProgress(shared.countCharacters(text), shared.countCharacters(text));
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

    const text = shared.normalizePassage(message && message.text);
    if (!text) {
      return { ok: false, code: "EMPTY_TEXT" };
    }

    if (shared.countCharacters(text) > shared.MAX_TEXT_LENGTH) {
      return { ok: false, code: "TEXT_TOO_LONG" };
    }

    const wpm = shared.clampWpm(message && message.wpm);

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

    const session = createSession(text, wpm, editor);
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
