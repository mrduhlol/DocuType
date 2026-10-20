const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
);

test("uses MV3 and the minimal permission set", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal("host_permissions" in manifest, false);
  assert.equal("background" in manifest, false);
  assert.equal("storage" in manifest.permissions, false);
  assert.equal(manifest.minimum_chrome_version, "105");
});

test("declares Firefox MV3 installation metadata", () => {
  const gecko = manifest.browser_specific_settings?.gecko;

  assert(gecko, "browser_specific_settings.gecko is required for Firefox");
  assert.equal(gecko.id, "docutype@mrduhlol.github.io");
  assert.equal(gecko.strict_min_version, "109.0");
  assert.deepEqual(gecko.data_collection_permissions.required, ["none"]);
});

test("references icon files that exist", () => {
  const iconPaths = new Set([
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ]);

  for (const iconPath of iconPaths) {
    assert.equal(
      fs.existsSync(path.join(ROOT, iconPath)),
      true,
      `${iconPath} should exist`
    );
  }
});
