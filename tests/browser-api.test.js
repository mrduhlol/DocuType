const test = require("node:test");
const assert = require("node:assert/strict");

const { getExtensionApi } = require("../lib/browser-api.js");

test("prefers the Firefox browser namespace", () => {
  const browser = { tabs: { query() {} } };
  const chrome = { tabs: { query() {} } };

  assert.equal(getExtensionApi({ browser, chrome }), browser);
});

test("falls back to the Chrome namespace", () => {
  const chrome = { scripting: { executeScript() {} } };

  assert.equal(getExtensionApi({ chrome }), chrome);
});

test("returns null when no extension namespace exists", () => {
  assert.equal(getExtensionApi({}), null);
  assert.equal(getExtensionApi(null), null);
});
