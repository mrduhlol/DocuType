(function initializeHumanize(root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./shared.js"));
    return;
  }

  const namespace = root.DocuType || (root.DocuType = {});
  namespace.humanize = factory(namespace.shared);
})(typeof globalThis !== "undefined" ? globalThis : this, function createHumanizeApi(shared) {
  "use strict";

  const MARKER = shared.BACKSPACE_MARKER;

  // Keys that sit next to each other on a QWERTY keyboard. A mistyped
  // neighbour is the most common kind of real typing slip.
  const NEIGHBORS = Object.freeze({
    a: "qwsz", b: "vghn", c: "xdfv", d: "edcrfv", e: "wsdrf",
    f: "rtgdyvc", g: "tyfhbv", h: "ygujbn", i: "uojk", j: "huknm",
    k: "ijol", l: "kop", m: "njk", n: "bhjm", o: "iklp", p: "ol",
    q: "wa", r: "etfg", s: "awedxz", t: "ryfg", u: "yhj", v: "cbfg",
    w: "qase", x: "zdc", y: "tughj", z: "asx",
  });

  // correction = wrong letter, backspace, retype (the visible "typing show").
  // slip = a small error that stays in the finished document.
  const RATES = Object.freeze([
    Object.freeze({ correction: 0, slip: 0 }),
    Object.freeze({ correction: 0.02, slip: 0.003 }),
    Object.freeze({ correction: 0.06, slip: 0.02 }),
    Object.freeze({ correction: 0.14, slip: 0.06 }),
  ]);

  const WORD_PATTERN = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;
  const MIN_CORRECTION_LENGTH = 6;

  function pick(list, random) {
    const index = Math.min(list.length - 1, Math.floor(random() * list.length));
    return list[index];
  }

  function wrongLetter(char, random) {
    const lower = char.toLowerCase();
    const neighbors = NEIGHBORS[lower];
    let candidate = neighbors ? pick(Array.from(neighbors), random) : "x";

    if (candidate === lower) {
      candidate = lower === "x" ? "z" : "x";
    }

    return char === lower ? candidate : candidate.toUpperCase();
  }

  function slipWord(word, random) {
    const letters = Array.from(word);
    const roll = random();

    if (roll < 0.45 && letters.length >= 3) {
      const index = 1 + Math.floor(random() * (letters.length - 2));
      const swapped = letters[index];
      letters[index] = letters[index + 1];
      letters[index + 1] = swapped;
    } else if (roll < 0.75) {
      const index = Math.floor(random() * letters.length);
      letters[index] = wrongLetter(letters[index], random);
    } else {
      const index = Math.floor(random() * letters.length);
      letters.splice(index + 1, 0, letters[index]);
    }

    return letters.join("");
  }

  function correctionWord(word, random) {
    const letters = Array.from(word);
    const index = 1 + Math.floor(random() * (letters.length - 1));
    const wrong = wrongLetter(letters[index], random);

    return (
      letters.slice(0, index).join("") +
      wrong +
      MARKER +
      letters.slice(index).join("")
    );
  }

  /**
   * Turns a passage into the exact keystroke sequence DocuType should type.
   * U+0008 markers become real backspaces in the document, so the finished
   * word is still correct; slips are typed for real and left in place.
   */
  function buildTypingPlan(text, options = {}) {
    if (typeof text !== "string" || text.length === 0) {
      return "";
    }

    const level = shared.clampHumanizeLevel(options.level);
    const rates = RATES[level];
    if (rates.correction === 0 && rates.slip === 0) {
      return text;
    }

    const random = typeof options.random === "function" ? options.random : Math.random;
    const parts = [];
    let cursor = 0;
    let match;

    WORD_PATTERN.lastIndex = 0;
    while ((match = WORD_PATTERN.exec(text)) !== null) {
      parts.push(text.slice(cursor, match.index));

      const original = match[0];
      let word = original;

      if (original.length >= MIN_CORRECTION_LENGTH && random() < rates.correction) {
        word = correctionWord(original, random);
      } else if (random() < rates.slip) {
        word = slipWord(original, random);
      }

      parts.push(word);
      cursor = match.index + original.length;
    }

    parts.push(text.slice(cursor));
    return parts.join("");
  }

  return Object.freeze({ buildTypingPlan });
});
