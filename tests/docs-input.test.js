const test = require("node:test");
const assert = require("node:assert/strict");

const {
  escapeHtml,
  getKeyDescriptor,
} = require("../content/docs-input.js");

test("escapes characters used in the paste HTML", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("maps ASCII letters to real keydown and keypress codes", () => {
  assert.deepEqual(getKeyDescriptor("a"), {
    key: "a",
    code: "KeyA",
    keyCode: 65,
    which: 65,
    charCode: 97,
    shiftKey: false,
  });

  assert.deepEqual(getKeyDescriptor("A"), {
    key: "A",
    code: "KeyA",
    keyCode: 65,
    which: 65,
    charCode: 65,
    shiftKey: true,
  });
});

test("maps digits, punctuation, whitespace, and Enter", () => {
  assert.deepEqual(getKeyDescriptor("7"), {
    key: "7",
    code: "Digit7",
    keyCode: 55,
    which: 55,
    charCode: 55,
    shiftKey: false,
  });

  assert.deepEqual(getKeyDescriptor("?"), {
    key: "?",
    code: "",
    keyCode: 191,
    which: 191,
    charCode: 63,
    shiftKey: true,
  });

  assert.deepEqual(getKeyDescriptor(" "), {
    key: " ",
    code: "Space",
    keyCode: 32,
    which: 32,
    charCode: 32,
    shiftKey: false,
  });

  assert.deepEqual(getKeyDescriptor("\t"), getKeyDescriptor(" "));

  assert.deepEqual(getKeyDescriptor("\n"), {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    charCode: 13,
    shiftKey: false,
  });
});

test("leaves non-ASCII code points for the paste path", () => {
  assert.equal(getKeyDescriptor("é"), null);
  assert.equal(getKeyDescriptor("🙂"), null);
});
