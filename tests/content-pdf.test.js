const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const shared = require("../lib/shared.js");
const humanize = require("../lib/humanize.js");

test("PDF setup must finish before one-character ticks can reach the document", async () => {
  const calls = [];
  const editor = {};
  let listener;
  let typing;
  let resolveLayout;
  const setup = new Promise((resolve) => { resolveLayout = resolve; });
  const extension = { runtime: { onMessage: { addListener: (fn) => { listener = fn; } } } };
  const context = {
    location: { href: "https://docs.google.com/document/d/sample/edit" },
    DocuType: {
      shared,
      humanize,
      browserApi: { getExtensionApi: () => extension },
      pdfPageSetup: { prepare: () => setup },
      docsInput: {
        findEditor: () => editor,
        insertPdfCharacter(target, char, run, paragraph) {
          assert.equal(target, editor);
          calls.push({ char, bold: run.bold, alignment: paragraph?.alignment });
          return { ok: true };
        },
        insertUnit(target, char) {
          assert.equal(target, editor);
          calls.push({ char });
          return { ok: true };
        },
      },
      ControlBar: class { setProgress() {} },
      TypingEngine: class {
        constructor(options) { typing = options; }
        start() { return true; }
      },
    },
  };
  const contentPath = path.join(__dirname, "../content/content.js");
  vm.runInNewContext(fs.readFileSync(contentPath, "utf8"), context);
  const pdfRows = [
    { alignment: "center", runs: [{ text: "A", bold: true }, { text: "😀" }] },
    { alignment: "right", runs: [{ text: "B" }] },
  ];
  const response = new Promise((resolve) => {
    const asynchronous = listener({
      type: shared.START_SESSION_MESSAGE,
      pdfRows,
      wpm: 45,
      humanizeLevel: 0,
    }, {}, resolve);
    assert.equal(asynchronous, true);
  });
  assert.equal(typing, undefined);
  resolveLayout({ ok: true });
  assert.equal((await response).ok, true);

  assert.equal(typing.text, "A😀\nB");
  assert.equal(typing.wpm, 45);
  const characters = Array.from(typing.text);
  for (const [index, char] of characters.entries()) {
    typing.onReveal({ char, index: index + 1, total: characters.length });
    assert.equal(calls.length, index + 1);
  }
  assert.deepEqual(calls, [
    { char: "A", bold: true, alignment: "center" },
    { char: "😀", bold: undefined, alignment: undefined },
    { char: "\n" },
    { char: "B", bold: undefined, alignment: "right" },
  ]);
});
