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

  const SPEEDS = Object.freeze([
    Object.freeze({ id: "gentle", label: "Gentle", wpm: 30 }),
    Object.freeze({ id: "steady", label: "Steady", wpm: 45 }),
    Object.freeze({ id: "quick", label: "Quick", wpm: 65 }),
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

  return Object.freeze({
    START_SESSION_MESSAGE,
    MAX_TEXT_LENGTH,
    SPEEDS,
    isGoogleDocsDocumentUrl,
    normalizePassage,
    countCharacters,
    clampWpm,
  });
});
