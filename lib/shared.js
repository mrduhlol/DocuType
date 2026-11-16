(function initializeDocuTypeShared(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  const namespace = root.DocuType || (root.DocuType = {});
  namespace.shared = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSharedApi() {
  "use strict";

  const START_SESSION_MESSAGE = "DOCUTYPE_START_SESSION";
  const MAX_TEXT_LENGTH = 10000;
  const DEFAULT_WPM = 45;
  const MIN_WPM = 10;
  const MAX_WPM = 160;
  const DEFAULT_HUMANIZE_LEVEL = 0;
  const MAX_HUMANIZE_LEVEL = 3;
  // U+0008 is a single code point, so the typing engine can reveal it as one
  // keystroke and the content script can turn it into a real backspace.
  const BACKSPACE_MARKER = "\b";

  const SPEEDS = Object.freeze([
    Object.freeze({ id: "gentle", label: "Gentle", wpm: 30 }),
    Object.freeze({ id: "steady", label: "Steady", wpm: 45 }),
    Object.freeze({ id: "quick", label: "Quick", wpm: 65 }),
  ]);

  const HUMANIZE_LEVELS = Object.freeze([
    Object.freeze({ id: "clean", label: "Clean", value: 0 }),
    Object.freeze({ id: "small", label: "Small", value: 1 }),
    Object.freeze({ id: "medium", label: "Medium", value: 2 }),
    Object.freeze({ id: "more", label: "More", value: 3 }),
  ]);

  // Only editable document surfaces are supported. Published links
  // (/document/d/e/.../pub) and other Docs products are intentionally excluded.
  const DOCUMENT_PATH =
    /^\/document\/(?:u\/\d+\/)?d\/[A-Za-z0-9_-]+(?:\/(?:edit|view|preview|mobilebasic|comment|copy))?\/?$/;

  function isGoogleDocsDocumentUrl(value) {
    if (typeof value !== "string") {
      return false;
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      return false;
    }

    return (
      url.protocol === "https:" &&
      url.hostname === "docs.google.com" &&
      DOCUMENT_PATH.test(url.pathname)
    );
  }

  function normalizePassage(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\r\n?/g, "\n").trim();
  }

  function countCharacters(value) {
    if (typeof value !== "string" || value.length === 0) {
      return 0;
    }

    return Array.from(value).length;
  }

  function clampWpm(value) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      typeof value === "boolean"
    ) {
      return DEFAULT_WPM;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_WPM;
    }

    return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(numeric)));
  }

  function clampHumanizeLevel(value) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      typeof value === "boolean"
    ) {
      return DEFAULT_HUMANIZE_LEVEL;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_HUMANIZE_LEVEL;
    }

    return Math.min(MAX_HUMANIZE_LEVEL, Math.max(0, Math.round(numeric)));
  }

  return Object.freeze({
    START_SESSION_MESSAGE,
    MAX_TEXT_LENGTH,
    BACKSPACE_MARKER,
    DEFAULT_HUMANIZE_LEVEL,
    HUMANIZE_LEVELS,
    SPEEDS,
    isGoogleDocsDocumentUrl,
    normalizePassage,
    countCharacters,
    clampWpm,
    clampHumanizeLevel,
  });
});
