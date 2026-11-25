const test = require("node:test");
const assert = require("node:assert/strict");

const {
  escapeHtml,
  getKeyDescriptor,
  getBackspaceDescriptor,
  insertBackspace,
  insertPdfCharacter,
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

test("describes Backspace as a real key with keyCode 8", () => {
  assert.deepEqual(getBackspaceDescriptor(), {
    key: "Backspace",
    code: "Backspace",
    keyCode: 8,
    which: 8,
    charCode: 8,
    shiftKey: false,
  });
});

test("insertBackspace sends keydown and keyup but no keypress", () => {
  const events = [];
  const view = {
    KeyboardEvent: class FakeKeyboardEvent {
      constructor(type, init) {
        this.type = type;
        Object.assign(this, init);
      }
    },
  };
  const editor = {
    ownerDocument: { defaultView: view },
    focus() {
      events.push({ type: "focus" });
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
  };

  assert.deepEqual(insertBackspace(editor), { ok: true });
  assert.deepEqual(
    events.map((event) => event.type),
    ["focus", "keydown", "keyup"]
  );
  assert.equal(events[1].key, "Backspace");
  assert.equal(events[1].keyCode, 8);
});

test("insertBackspace rejects a missing editor", () => {
  const result = insertBackspace(null);
  assert.equal(result.ok, false);
  assert.equal(result.code, "EDITOR_NOT_FOUND");
});

test("a PDF tick inserts one styled character, without moving the cursor or pasting a block", () => {
  const transfers = [];
  const keys = [];
  const view = {
    KeyboardEvent: class {
      constructor(type, init) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    DataTransfer: class extends Map {
      setData(type, value) {
        this.set(type, value);
      }
    },
    ClipboardEvent: class {
      constructor(type, init) {
        this.type = type;
        Object.assign(this, init);
      }
    },
  };
  const editor = {
    ownerDocument: { defaultView: view },
    focus() {},
    dispatchEvent(event) {
      event.defaultPrevented = true;
      if (event.type === "paste") transfers.push(event.clipboardData);
      if (event.type === "keydown") keys.push([event.key, event.ctrlKey]);
    },
  };
  const run = { font: "Times New Roman", size: 12, bold: true, italic: true, underline: true, strikethrough: true };
  const row = { alignment: "center" };

  assert.deepEqual(insertPdfCharacter(editor, "&", run, row), { ok: true });
  assert.deepEqual(insertPdfCharacter(editor, " ", run), { ok: true });
  assert.deepEqual(insertPdfCharacter(editor, "a", { ...run, underline: false, strikethrough: false }), { ok: true });
  assert.deepEqual(keys, [["E", true], [" ", undefined]]);
  assert.deepEqual(transfers.map((transfer) => transfer.get("text/plain")), ["&", "a"]);
  const first = transfers[0].get("text/html");
  assert.match(first, /^<span /);
  assert.doesNotMatch(first, /<p[ >]/);
  assert.match(first, /font-family:'Times New Roman';font-size:12\.00pt;/);
  assert.match(first, /font-weight:bold;font-style:italic;text-decoration:underline line-through/);
  assert.match(first, /&amp;/);
  assert.match(transfers[1].get("text/html"), /^<span .*text-decoration:none/);
});
