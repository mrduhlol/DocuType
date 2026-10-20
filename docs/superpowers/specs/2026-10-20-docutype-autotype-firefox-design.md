# DocuType Autotype + Firefox — Design

**Date:** 2026-10-20
**Status:** Approved in session. Supersedes the "guided typing practice" behavior in
`2026-10-19-docutype-design.md`.

## Intent

DocuType now types a supplied passage directly into the active Google Docs
document at the selected pace. It is no longer a prompt-only practice tool.
The small floating card is reduced to a status and control bar; the passage
itself appears in the document.

The extension remains zero-dependency, zero-network, zero-storage, and works
without a build step.

## Goals

- Insert the passage into the Google Docs editor at the user's current caret.
- Preserve the existing pacing model: Gentle 30 WPM, Steady 45 WPM, Quick 65 WPM,
  with natural variation and punctuation pauses.
- Pause, resume, and stop the insertion.
- Show a compact status bar with approximate progress and controls.
- Work in Chrome 105+ and Firefox 109+ from the same source tree.
- Keep the existing plain-language failure handling for non-Docs, discarded,
  blocked, empty, and overlong-tab cases.
- Keep the passage in memory only; no uploads, no persistence.

## Non-goals

- Undoing or removing inserted text automatically.
- Restarting a run without duplicating text.
- Reading the document, verifying the inserted text, or measuring keystrokes.
- Google Docs API/OAuth integration.
- Other editors, Sheets, Slides, published Docs, or mobile browsers.
- Accounts, sync, history, analytics, or remote services.

## Behavior

1. The user opens an editable Google Docs document, clicks the DocuType icon,
   pastes a passage, chooses a pace, and presses Start.
2. The popup validates the tab, injects the content bundle, sends the passage and
   pace, and closes on success.
3. The content script locates Docs' hidden input surface:
   `iframe.docs-texteventtarget-iframe` → `[contenteditable="true"]`.
4. A compact control bar mounts in the bottom-right. It contains the DocuType
   mark, a status label, an approximate progress bar, and Pause/Resume and Stop
   buttons. It never displays the passage.
5. After a short "Starting…" delay, the extension inserts one Unicode code point
   at a time using the existing pacing engine.
6. Printable ASCII characters, spaces, tabs, and line breaks use synthetic key
   events, matching a person typing. Non-ASCII code points (accented letters,
   curly quotes, CJK, emoji) use inline HTML paste events so Docs receives them
   exactly and the extension can detect rejection. Tabs become spaces.
7. Pause freezes insertion; Resume continues from the next code point. Stop ends
   the session and removes the bar. Text already inserted stays in the document.
8. Completion is shown in the bar; the user closes the bar with Stop.
9. Starting a new session ends the previous one and inserts at the current caret.
   It does not delete earlier text.
10. If the editor cannot be found, or Docs rejects a paste, the bar shows a plain
    error and stops; the popup reports preflight failures without mounting a bar.

## Technical approach

Docs has no supported extension insertion API. The extension drives the same
hidden input surface Docs uses for keyboard input:

- Locate `iframe.docs-texteventtarget-iframe` and its contenteditable body.
- Printable ASCII characters dispatch a keydown/keypress/keyup triple using real
  keyboard codes. This is the live-verified typing path for Docs. `\n` uses
  Enter; `" "` and `\t` use Space (`\t` becomes a space).
- Non-ASCII code points dispatch a synthetic `paste` ClipboardEvent carrying
  `text/html` (`<span>escaped character</span>`) and `text/plain`. A consumed
  paste calls `preventDefault`; an ignored paste is an error.
- Build events with the iframe's own `defaultView` constructors to avoid
  cross-realm object problems.
- Keep the typing engine's timer and pacing; its reveal callback now inserts a
  character instead of rendering one.

This surface is undocumented and can change with Docs. The README states that
clearly and gives recovery steps. It is not possible to verify live Docs
insertion in the project's headless harness; the harness models the input
surface and the README asks for a manual smoke test on a scratch document.

## Cross-browser support

- Popup and content code use `globalThis.browser` when present, otherwise
  `globalThis.chrome`. Firefox's `browser.*` APIs are promise-based; Chrome MV3's
  `chrome.*` APIs support promises at the required version floor.
- The manifest keeps `activeTab` and `scripting` only. No host permissions.
- Add `browser_specific_settings.gecko` with an add-on ID, `strict_min_version`
  `109.0`, and `data_collection_permissions.required: ["none"]`. Chrome ignores
  this key.
- Firefox can load the folder temporarily from `about:debugging`; permanent
  installation requires Mozilla signing through AMO.
- No Firefox-only APIs are required.

## Error codes

- `NOT_DOCS` — not a Google Docs document URL.
- `EMPTY_TEXT` — no non-whitespace passage.
- `TEXT_TOO_LONG` — more than 10,000 Unicode code points.
- `EDITOR_NOT_FOUND` — Docs' hidden input surface is missing (not loaded, not
  editable, or Docs changed).
- `PASTE_REJECTED` — Docs ignored a synthetic paste; typing stops.
- `START_FAILED` — the session could not be created.

## Responsible use

DocuType inserts text automatically. The popup, README, and manifest description
must say so plainly. It must not claim the user typed the text or that progress
is verified typing. The README warns that autotyping may violate assessment or
workplace rules and that the user is responsible for where they use it.

## Success criteria

- Starting on a Docs document types the passage into the document at the chosen
  pace, with no passage text in the control bar.
- Pause/resume/stop work without duplicate timers or listeners.
- Non-Docs, empty, overlong, missing-editor, and rejected-paste cases fail with
  clear messages and no partial bar.
- The same files load in Chrome and Firefox; manifest and popup API tests cover
  both namespaces.
- All existing privacy guarantees (no network, storage, telemetry) still hold.
