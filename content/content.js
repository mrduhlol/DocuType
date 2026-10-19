(function bootDocuTypeContent(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});

  // The popup injects all content files on every Start so already-open Docs
  // tabs work immediately after installation. This guard keeps one listener
  // and one live panel no matter how often the bundle is injected.
  if (namespace.__contentBooted) {
    return;
  }

  const shared = namespace.shared;
  const Panel = namespace.Panel;
  const chromeApi = root.chrome;

  if (
    !shared ||
    typeof Panel !== "function" ||
    !chromeApi ||
    !chromeApi.runtime ||
    !chromeApi.runtime.onMessage ||
    typeof chromeApi.runtime.onMessage.addListener !== "function"
  ) {
    return;
  }

  let activePanel = null;

  function isSupportedPage() {
    try {
      return shared.isGoogleDocsDocumentUrl(root.location.href);
    } catch {
      return false;
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

    // Replace atomically: destroy the old panel only after the new input
    // has been validated, so a bad request cannot kill a running session.
    if (activePanel) {
      const previousPanel = activePanel;
      activePanel = null;
      previousPanel.destroy();
    }

    let panel;
    try {
      panel = new Panel({
        text,
        wpm,
        onClose() {
          if (activePanel === panel) {
            activePanel = null;
          }
        },
      });
    } catch {
      return { ok: false, code: "START_FAILED" };
    }

    activePanel = panel;
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
  chromeApi.runtime.onMessage.addListener(handleMessage);
})(typeof globalThis !== "undefined" ? globalThis : this);
