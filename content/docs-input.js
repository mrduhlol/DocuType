(function initializeDocuTypeDocsInput(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  const namespace = root.DocuType || (root.DocuType = {});
  namespace.docsInput = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDocsInputApi() {
  "use strict";

  const EDITOR_NOT_FOUND_MESSAGE =
    "DocuType couldn't find the Google Docs editor. Click into the document and try again.";
  const PASTE_REJECTED_MESSAGE =
    "Google Docs rejected the text. Make sure the document is editable and try again.";
  const TYPE_FAILED_MESSAGE =
    "DocuType couldn't type into this document. Reload the page and try again.";

  const SHIFTED_DIGITS = ")!@#$%^&*(";
  const PUNCTUATION = Object.freeze({
    ";": [186, false],
    ":": [186, true],
    "=": [187, false],
    "+": [187, true],
    ",": [188, false],
    "<": [188, true],
    "-": [189, false],
    "_": [189, true],
    ".": [190, false],
    ">": [190, true],
    "/": [191, false],
    "?": [191, true],
    "`": [192, false],
    "~": [192, true],
    "[": [219, false],
    "{": [219, true],
    "\\": [220, false],
    "|": [220, true],
    "]": [221, false],
    "}": [221, true],
    "'": [222, false],
    '"': [222, true],
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  /**
   * Map a printable ASCII character to the key codes Google Docs expects.
   * Docs acts on keydown keyCode, then reads the actual character from
   * keypress charCode, so both must match a real keyboard.
   */
  function getKeyDescriptor(character) {
    if (character === "\n" || character === "\r") {
      return {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        charCode: 13,
        shiftKey: false,
      };
    }

    if (character === "\t" || character === " ") {
      return {
        key: " ",
        code: "Space",
        keyCode: 32,
        which: 32,
        charCode: 32,
        shiftKey: false,
      };
    }

    if (/^[a-z]$/.test(character)) {
      return {
        key: character,
        code: `Key${character.toUpperCase()}`,
        keyCode: character.toUpperCase().charCodeAt(0),
        which: character.toUpperCase().charCodeAt(0),
        charCode: character.charCodeAt(0),
        shiftKey: false,
      };
    }

    if (/^[A-Z]$/.test(character)) {
      return {
        key: character,
        code: `Key${character}`,
        keyCode: character.charCodeAt(0),
        which: character.charCodeAt(0),
        charCode: character.charCodeAt(0),
        shiftKey: true,
      };
    }

    if (/^[0-9]$/.test(character)) {
      return {
        key: character,
        code: `Digit${character}`,
        keyCode: character.charCodeAt(0),
        which: character.charCodeAt(0),
        charCode: character.charCodeAt(0),
        shiftKey: false,
      };
    }

    const shiftedDigit = SHIFTED_DIGITS.indexOf(character);
    if (shiftedDigit !== -1) {
      return {
        key: character,
        code: `Digit${shiftedDigit}`,
        keyCode: 48 + shiftedDigit,
        which: 48 + shiftedDigit,
        charCode: character.charCodeAt(0),
        shiftKey: true,
      };
    }

    const punctuation = PUNCTUATION[character];
    if (punctuation) {
      return {
        key: character,
        code: "",
        keyCode: punctuation[0],
        which: punctuation[0],
        charCode: character.charCodeAt(0),
        shiftKey: punctuation[1],
      };
    }

    // Non-ASCII text (emoji, accented letters, CJK, curly quotes) arrives
    // through the paste path instead.
    return null;
  }

  function findEditor(documentRef) {
    if (!documentRef || typeof documentRef.querySelector !== "function") {
      return null;
    }

    let frame;
    try {
      frame = documentRef.querySelector("iframe.docs-texteventtarget-iframe");
    } catch {
      return null;
    }

    if (!frame) {
      return null;
    }

    let frameDocument;
    try {
      frameDocument = frame.contentDocument;
    } catch {
      return null;
    }

    if (!frameDocument || typeof frameDocument.querySelector !== "function") {
      return null;
    }

    try {
      return frameDocument.querySelector('[contenteditable="true"]');
    } catch {
      return null;
    }
  }

  function getEventView(editor) {
    const documentRef = editor && editor.ownerDocument;
    return (documentRef && documentRef.defaultView) || null;
  }

  function defineReadOnly(event, name, value) {
    try {
      if (event[name] === value) {
        return;
      }

      Object.defineProperty(event, name, {
        configurable: true,
        enumerable: true,
        get() {
          return value;
        },
      });
    } catch {
      // Some browsers make these properties immutable. The constructor
      // already populated them where possible.
    }
  }

  function createKeyboardEvent(view, type, descriptor) {
    const isPress = type === "keypress";
    const eventInit = {
      key: descriptor.key,
      code: descriptor.code,
      keyCode: isPress ? descriptor.charCode : descriptor.keyCode,
      which: isPress ? descriptor.charCode : descriptor.keyCode,
      shiftKey: descriptor.shiftKey,
      bubbles: true,
      cancelable: true,
    };

    if (isPress) {
      eventInit.charCode = descriptor.charCode;
    }

    const event = new view.KeyboardEvent(type, eventInit);
    const keyCode = isPress ? descriptor.charCode : descriptor.keyCode;

    defineReadOnly(event, "keyCode", keyCode);
    defineReadOnly(event, "which", keyCode);
    if (isPress) {
      defineReadOnly(event, "charCode", descriptor.charCode);
    }

    return event;
  }

  function dispatchKey(editor, descriptor) {
    const view = getEventView(editor);
    if (!view || typeof view.KeyboardEvent !== "function") {
      return {
        ok: false,
        code: "TYPE_FAILED",
        message: TYPE_FAILED_MESSAGE,
      };
    }

    try {
      editor.focus();
      editor.dispatchEvent(createKeyboardEvent(view, "keydown", descriptor));
      editor.dispatchEvent(createKeyboardEvent(view, "keypress", descriptor));
      editor.dispatchEvent(createKeyboardEvent(view, "keyup", descriptor));
      return { ok: true };
    } catch {
      return {
        ok: false,
        code: "TYPE_FAILED",
        message: TYPE_FAILED_MESSAGE,
      };
    }
  }

  function dispatchPaste(editor, character) {
    const view = getEventView(editor);
    if (
      !view ||
      typeof view.DataTransfer !== "function" ||
      typeof view.ClipboardEvent !== "function"
    ) {
      return {
        ok: false,
        code: "PASTE_REJECTED",
        message: PASTE_REJECTED_MESSAGE,
      };
    }

    try {
      const transfer = new view.DataTransfer();
      transfer.setData("text/html", `<span>${escapeHtml(character)}</span>`);
      transfer.setData("text/plain", character);

      let event;
      try {
        event = new view.ClipboardEvent("paste", {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        });
      } catch {
        event = new view.ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
        });
      }

      if (!event.clipboardData) {
        defineReadOnly(event, "clipboardData", transfer);
      }

      editor.focus();
      editor.dispatchEvent(event);

      if (!event.defaultPrevented) {
        return {
          ok: false,
          code: "PASTE_REJECTED",
          message: PASTE_REJECTED_MESSAGE,
        };
      }

      return { ok: true };
    } catch {
      return {
        ok: false,
        code: "PASTE_REJECTED",
        message: PASTE_REJECTED_MESSAGE,
      };
    }
  }

  function insertUnit(editor, character) {
    if (!editor || typeof editor.dispatchEvent !== "function") {
      return {
        ok: false,
        code: "EDITOR_NOT_FOUND",
        message: EDITOR_NOT_FOUND_MESSAGE,
      };
    }

    if (typeof character !== "string" || character.length === 0) {
      return {
        ok: false,
        code: "TYPE_FAILED",
        message: TYPE_FAILED_MESSAGE,
      };
    }

    const descriptor = getKeyDescriptor(character);
    if (descriptor) {
      return dispatchKey(editor, descriptor);
    }

    return dispatchPaste(editor, character);
  }

  return Object.freeze({
    escapeHtml,
    getKeyDescriptor,
    findEditor,
    insertUnit,
  });
});
