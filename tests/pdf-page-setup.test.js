const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content/pdf-page-setup.js"), "utf8");
const layout = {
  width: 595.32,
  height: 841.92,
  margins: { top: 36, bottom: 54, left: 72, right: 27 },
};

test("applies matched paper size and named margins before restoring the editor", async () => {
  let menuOpen = false;
  let dialogOpen = false;
  let restored = false;
  let saved;
  const element = (textContent, properties = {}) => ({
    textContent,
    getAttribute() { return null; },
    getClientRects() { return [1]; },
    dispatchEvent() {},
    click() {},
    ...properties,
  });
  const input = (name) => element("", { name, type: "text", focus() {}, blur() {} });
  const left = input("Left");
  const right = input("Right");
  const top = input("Top");
  const bottom = input("Bottom");
  const select = element("", {
    value: "letter",
    options: [element("Letter", { value: "letter" }), element("A4", { value: "a4" })],
  });
  const ok = element("OK", {
    click() {
      saved = { paper: select.value, values: [top.value, bottom.value, left.value, right.value] };
      dialogOpen = false;
    },
  });
  const file = element("File", { id: "docs-file-menu", click() { menuOpen = true; } });
  const menuLabel = element("Page setup…", { click() { dialogOpen = true; } });
  const item = element("Icon Page setup…", { querySelector() { return menuLabel; } });
  const dialog = element("Page setup Margins (inches)", {
    getClientRects: () => dialogOpen ? [1] : [],
    querySelectorAll(selector) {
      if (selector === "input") return [left, right, top, bottom];
      if (selector === "select") return [select];
      if (selector === "button, [role=button]") return [ok];
      return [];
    },
  });
  const document = {
    getElementById() { return null; },
    querySelectorAll(selector) {
      if (selector.startsWith("#docs-file-menu")) return [file];
      if (selector.startsWith("[role=menuitem]")) return menuOpen ? [item] : [];
      if (selector.startsWith("[role=dialog]")) return [dialog];
      return [];
    },
  };
  for (const control of [top, bottom, left, right]) control.ownerDocument = document;
  const context = vm.createContext({ document, Event, MouseEvent: Event, setTimeout });
  vm.runInContext(source, context);
  const result = await context.DocuType.pdfPageSetup.prepare({
    editor: { focus() { restored = true; } },
    layout,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(saved, { paper: "a4", values: ["0.50", "0.75", "1.00", "0.38"] });
  assert.equal(restored, true);
});
