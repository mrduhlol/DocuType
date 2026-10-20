# DocuType Autotype + Firefox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change DocuType from a prompt-only practice panel into a cross-browser extension that types the passage directly into the Google Docs editor at the selected pace, with a compact pause/stop bar.

**Architecture:** The popup injects the same content bundle into Chrome or Firefox on demand. A new `docs-input` module locates Docs' hidden contenteditable and inserts code points through synthetic paste/key events. The existing typing engine drives pacing; a new Shadow-DOM control bar shows status and approximate progress. Popup and content code select `browser` first, then `chrome`.

**Tech Stack:** Chrome MV3 / Firefox MV3, vanilla HTML/CSS/JavaScript (classic scripts), Node 20+ built-in test runner, headless Chromium for browser harnesses.

**Spec:** `docs/superpowers/specs/2026-10-20-docutype-autotype-firefox-design.md`

## Global Constraints

- Chrome 105+ and Firefox 109+.
- Permissions: `activeTab` and `scripting` only. No host permissions, storage, background worker, analytics, telemetry, or network calls.
- Passage limit: 10,000 Unicode code points. Pace presets: Gentle 30 WPM, Steady 45 WPM, Quick 65 WPM.
- One live session at a time. Starting another stops the previous one without deleting inserted text.
- No automatic undo/cleanup and no Restart control.
- Only `https://docs.google.com/document/...` document URLs.
- The control bar never renders the passage.
- Content injection order: `lib/shared.js`, `lib/browser-api.js`, `content/typing-engine.js`, `content/docs-input.js`, `content/control-bar-styles.js`, `content/control-bar.js`, `content/content.js`.

## Review Focus

- Docs' hidden input surface is missing or changed → fail with a clear error, never a silent no-op.
- View-only docs or ignored pastes → stop typing and explain that the document is not editable.
- Rapid pause/resume/stop, duplicate injection, or a replacement start → exactly one timer and one bar.
- Unicode, spaces, tabs, and line breaks → one code point per tick, real whitespace, no dropped or doubled characters.
- Firefox's promise-only `browser` namespace → popup validation, injection, and start still work.

---

### Task 1: Cross-browser foundation

**Files:**
- Create: `lib/browser-api.js`
- Create: `tests/browser-api.test.js`
- Create: `tests/manifest.test.js`
- Modify: `manifest.json`

**Interfaces:**
- Produces: `DocuType.browserApi.getExtensionApi(root) -> object | null`, preferring `root.browser` and falling back to `root.chrome`.
- Produces manifest metadata: `browser_specific_settings.gecko.id = "docutype@mrduhlol.github.io"`, `strict_min_version = "109.0"`, `data_collection_permissions.required = ["none"]`.

- [ ] **Step 1: Write the failing tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { getExtensionApi } = require("../lib/browser-api.js");

test("prefers the Firefox browser namespace", () => {
  const browser = { tabs: {} };
  const chrome = { tabs: {} };
  assert.equal(getExtensionApi({ browser, chrome }), browser);
});

test("falls back to chrome", () => {
  const chrome = { scripting: {} };
  assert.equal(getExtensionApi({ chrome }), chrome);
  assert.equal(getExtensionApi({}), null);
});
```

Manifest assertions: parse `manifest.json`; assert `manifest_version === 3`, permissions exactly `["activeTab", "scripting"]`, no `host_permissions`, no `background`, gecko ID/min version/data collection as above, and every icon path exists.

- [ ] **Step 2: Run the failing tests**

Run: `node --test tests/browser-api.test.js tests/manifest.test.js`
Expected: FAIL because `lib/browser-api.js` does not exist and the manifest has no Firefox settings.

- [ ] **Step 3: Implement the helper and manifest settings**

Use the same UMD pattern as `lib/shared.js`. Export a frozen `{ getExtensionApi }`. Add the Gecko settings above; keep `minimum_chrome_version` and the existing Chrome keys.

- [ ] **Step 4: Verify**

Run: `node --test tests/browser-api.test.js tests/manifest.test.js`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add lib/browser-api.js tests/browser-api.test.js tests/manifest.test.js manifest.json
git commit -m "feat: add Firefox manifest settings and browser API helper"
git push
```

---

### Task 2: Docs input module

**Files:**
- Create: `content/docs-input.js`
- Create: `tests/docs-input.test.js`
- Create: `tests/browser/docs-input.html`
- Modify: `tests/run-browser-tests.mjs`

**Interfaces:**
- Produces: `DocuType.docsInput.escapeHtml(value) -> string`
- Produces: `DocuType.docsInput.getKeyDescriptor(char) -> { key, code, keyCode, which, charCode, shiftKey } | null`
  - `"\n"` → Enter (`keyCode` 13); `" "`/`"\t"` → Space (`keyCode` 32). Other characters → `null`.
- Produces: `DocuType.docsInput.findEditor(documentRef) -> HTMLElement | null`
  - Finds `iframe.docs-texteventtarget-iframe`, then its `contentDocument`'s `[contenteditable="true"]`.
- Produces: `DocuType.docsInput.insertUnit(editor, char) -> { ok: true } | { ok: false, code, message }`
  - `code` is `EDITOR_NOT_FOUND` or `PASTE_REJECTED`.
  - Non-whitespace code points dispatch a paste with `<span>escaped</span>` + `text/plain`.
  - Whitespace dispatches a keydown/keypress/keyup triple. Tabs become spaces.
  - Build events with `editor.ownerDocument.defaultView` constructors; define `clipboardData`, `keyCode`, `which`, or `charCode` on the event if the constructor drops them.

- [ ] **Step 1: Write the failing Node tests**

Test `escapeHtml("&<>\"'")`, space/enter/tab descriptors, and `null` for `"a"` and `"🙂"`.

- [ ] **Step 2: Write the failing browser harness**

In `tests/browser/docs-input.html`, create a same-origin iframe with class `docs-texteventtarget-iframe` and a contenteditable. Its mock listeners append pasted plain text and Space/Enter keys to the editor. Assert:

- `findEditor(document)` returns the editor.
- Pasting `"a"` inserts `"a"`, and `insertUnit` returns `ok`.
- Space and newline append `" "` and `"\n"`; tab inserts `" "`.
- `"🙂"` is one paste and one code point.
- A paste listener that does not call `preventDefault()` returns `PASTE_REJECTED`.
- Removing the iframe returns `EDITOR_NOT_FOUND`.

Add `{ path: "tests/browser/docs-input.html" }` to `PAGE_SPECS`.

- [ ] **Step 3: Run and verify failure**

Run: `node --test tests/docs-input.test.js`
Expected: FAIL because the module is missing.

Run: `npm run test:browser`
Expected: the new harness fails because `docs-input.js` is missing.

- [ ] **Step 4: Implement the module and harness**

Keep the UMD wrapper so Node can require it. In `insertUnit`, return the error object instead of throwing; callers decide how to stop.

- [ ] **Step 5: Verify**

Run: `node --test tests/docs-input.test.js` and `npm run test:browser`
Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add content/docs-input.js tests/docs-input.test.js tests/browser/docs-input.html tests/run-browser-tests.mjs
git commit -m "feat: add Google Docs input surface adapter"
git push
```

---

### Task 3: Compact control bar

**Files:**
- Create: `content/control-bar-styles.js`
- Create: `content/control-bar.js`
- Create: `tests/browser/control-bar.html`
- Modify: `tests/run-browser-tests.mjs`
- Delete after Task 4: `content/panel.js`, `content/panel-styles.js`, `tests/browser/panel.html`

**Interfaces:**
- Produces: `new DocuType.ControlBar({ total, wpm, onPause, onResume, onStop })`
- Produces: `bar.setState(state)` for `starting`, `running`, `paused`, `complete`, `stopped`, `error`
- Produces: `bar.setProgress(index, total)`, `bar.setError(message)`, `bar.destroy()`, `bar.element`
- UI: one `#docutype-root` with Shadow DOM; status text; progressbar; Pause/Resume; Stop. No passage text and no Restart.

- [ ] **Step 1: Write the failing browser harness**

Assert one bar mounts, status and progress render, the passage string never appears in the shadow tree, Pause calls `onPause` while running, `setState("paused")` switches the button to Resume and calls `onResume`, Stop calls `onStop` and removes the bar, `destroy()` is idempotent, and light/dark page backgrounds select the matching `data-theme`.

Add the harness to `PAGE_SPECS`.

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:browser`
Expected: FAIL because `DocuType.ControlBar` is missing.

- [ ] **Step 3: Implement styles and bar**

Use a fixed bottom-right card roughly 320–360px wide, Shadow DOM isolation, light/dark tokens, and `prefers-reduced-motion`. Reuse the existing brand SVG and theme detection logic from `panel.js`. Keep copy short: status, `≈ N%`, `N / total characters`, Pause/Resume, Stop.

- [ ] **Step 4: Verify**

Run: `npm run test:browser`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add content/control-bar-styles.js content/control-bar.js tests/browser/control-bar.html tests/run-browser-tests.mjs
git commit -m "feat: add compact autotype control bar"
git push
```

---

### Task 4: Content autotype session

**Files:**
- Modify: `content/content.js`
- Modify: `tests/browser/content.html`
- Modify: `tests/run-browser-tests.mjs`
- Modify: `package.json`
- Delete: `content/panel.js`, `content/panel-styles.js`, `tests/browser/panel.html`

**Interfaces:**
- Consumes: `DocuType.browserApi`, `DocuType.docsInput`, `DocuType.ControlBar`, `DocuType.TypingEngine`.
- Produces: message responses `{ ok: true }` or `{ ok: false, code }` with `NOT_DOCS`, `EMPTY_TEXT`, `TEXT_TOO_LONG`, `EDITOR_NOT_FOUND`, `START_FAILED`.
- Session behavior: validate input and editor before destroying the previous session; create the bar; start the engine with `initialDelayMs: 1200`; on reveal call `insertUnit`; update progress; on insertion failure stop the engine and call `bar.setError`; on complete show `100%`; Stop destroys both.

- [ ] **Step 1: Rewrite the content harness**

Add a mock Docs iframe with a contenteditable and paste/key listeners that append text. Test:

- A valid start types into the mock editor, mounts exactly one bar, and the bar contains no passage text.
- Pause stops insertion; Resume continues.
- Stop removes the bar and stops insertion permanently.
- A replacement start stops the old run and keeps one bar.
- Whitespace-only, overlong, and missing-editor starts are rejected without touching a running bar/editor.
- A mock that ignores paste shows an error in the bar and stops.
- The non-Docs harness still returns `NOT_DOCS`.

Remove the old `panel.html` scenario from `PAGE_SPECS`.

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:browser`
Expected: content tests fail because `content.js` still mounts the old panel.

- [ ] **Step 3: Implement the session wiring**

Follow the interfaces above. Keep the duplicate-injection guard. Ensure the editor check happens before replacing a running session. Map insertion errors to the bar's error state; the initial response remains `{ ok: true }` once typing begins.

- [ ] **Step 4: Update syntax checks**

Change `npm run check` to cover `lib/browser-api.js`, `content/docs-input.js`, `content/control-bar-styles.js`, and `content/control-bar.js`, and remove the deleted panel files.

- [ ] **Step 5: Verify**

Run: `npm test && npm run check && npm run test:browser`
Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add content/content.js tests/browser/content.html tests/run-browser-tests.mjs package.json
git add -u content/panel.js content/panel-styles.js tests/browser/panel.html
git commit -m "feat: type passages directly into Google Docs"
git push
```

---

### Task 5: Popup and Firefox API flow

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.js`
- Modify: `popup/popup.css` (copy fit only)
- Modify: `tests/browser/popup.html`
- Modify: `tests/browser/popup-frame.html`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `DocuType.browserApi.getExtensionApi(globalThis)`.
- Produces: popup file list in the new content order (see Global Constraints).
- Produces: error copy for `EDITOR_NOT_FOUND`, `PASTE_REJECTED`, `TYPE_FAILED`.
- Produces: Firefox test scenario using only `window.browser` with promise-returning APIs.

- [ ] **Step 1: Update the failing popup assertions**

Replace practice copy with autotype copy. Assert:

- The success scenario injects the seven files in the new order.
- The sent message still contains the normalized passage and selected WPM.
- `EDITOR_NOT_FOUND` and `PASTE_REJECTED` surface their specific messages.
- A new `firefox-success` scenario, with no `window.chrome` and a `window.browser` mock, injects, sends, and closes successfully.

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:browser`
Expected: popup tests fail on the old file list/copy and missing Firefox scenario.

- [ ] **Step 3: Implement popup changes**

Load `../lib/browser-api.js` before `popup.js`; use the selected API for `tabs.query`, `scripting.executeScript`, and `tabs.sendMessage`. Update:

- Tagline: “Types passages into Google Docs”.
- Speed hint: “How fast DocuType types into your document.”
- Start button: “Start typing” / “Starting…” in flight.
- Footer: “Nothing is uploaded or saved. The passage stays in your browser.” and “DocuType inserts the passage into your document. Use only where outside help is allowed.”
- Manifest description: “Types a passage into Google Docs at a chosen pace.”

- [ ] **Step 4: Verify**

Run: `npm test && npm run check && npm run test:browser`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add popup/popup.html popup/popup.js popup/popup.css tests/browser/popup.html tests/browser/popup-frame.html manifest.json
git commit -m "feat: update popup for autotyping and Firefox"
git push
```

---

### Task 6: Documentation and release QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-10-20-docutype-autotype-firefox.md` (check boxes only)
- Modify: `docs/superpowers/specs/2026-10-20-docutype-autotype-firefox-design.md` (status only if needed)

- [ ] **Step 1: Rewrite README**

Cover:

- What changed: DocuType types into the document; the bar is controls only.
- Chrome unpacked install; Firefox temporary install via `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → choose `manifest.json`.
- Firefox permanent install requires AMO signing; include a `zip` command for the upload artifact.
- Placing the cursor before Start, pacing, Pause/Resume, Stop, undo with Ctrl+Z, text remains after stop.
- Privacy/permissions unchanged; no network/storage/telemetry.
- Docs DOM risk: the hidden input surface is undocumented; if Docs changes, DocuType stops with an error.
- Troubleshooting: missing editor, view-only docs, ignored paste, focus/cursor, autocorrect, reload after extension update.
- Responsible use: autotyping may violate assessment/workplace rules; use only where permitted; not a record of manual typing.
- Tests and project layout.

- [ ] **Step 2: Run the full verification**

Run: `npm test && npm run check && npm run test:browser`
Expected: all green.

Run a forbidden-API sweep over `manifest.json`, `lib`, `content`, `popup`, and `icons` for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `chrome.storage`, `localStorage`, `sessionStorage`, `indexedDB`, analytics, and telemetry.
Expected: no matches.

Parse `manifest.json`, verify permissions and icon dimensions (16/32/48/128).

- [ ] **Step 3: Visual QA**

Capture popup light/dark and control-bar light/dark screenshots with the static harness. Confirm the bar contains no passage and fits without clipping.

- [ ] **Step 4: Manual smoke test note**

Document that live Docs insertion must be tested in a scratch document in both browsers; the headless harness only models the input surface.

- [ ] **Step 5: Commit and push**

```bash
git add README.md docs/superpowers/plans/2026-10-20-docutype-autotype-firefox.md
git commit -m "docs: document autotype mode and Firefox install"
git push
```
