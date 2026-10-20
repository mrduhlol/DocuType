# DocuType — Design

**Date:** 2026-10-19
**Status:** Superseded on 2026-10-20 by
[`2026-10-20-docutype-autotype-firefox-design.md`](2026-10-20-docutype-autotype-firefox-design.md).
The original prompt-only practice behavior described below is retained as design
history.

## Intent

DocuType is a Chrome extension for Google Docs that turns a pasted passage into a
guided typing practice session. A small floating panel reveals the passage one
character at a time at a natural, slightly uneven pace. The person types the text
into their own document; DocuType never edits the document, never simulates
keystrokes, and never transmits or stores the passage.

The product is explicitly a practice aid. It is not a way to disguise generated
or pasted work as manually typed. Progress shown by DocuType describes how much
of the prompt has been revealed, not verified keystrokes, and is labelled
approximate.

## Goals

- A calm, product-quality popup with a passage field, pace selector, and start action.
- A floating Google Docs panel with progressive character reveal, natural pacing,
  pause/resume, restart, stop, and approximate progress.
- Clean light and dark presentation that fits both the popup and the Docs page.
- Only operate on Google Docs document URLs.
- Fail clearly for non-Docs tabs, discarded tabs, blocked injection, and invalid input.
- Zero dependencies, zero network calls, zero persistence.
- Small, focused modules that can be maintained without a build step.

## Non-goals

- Typing into the Google Docs editor, reading the document, or measuring real keystrokes.
- Accounts, sync, history, analytics, or saved passages.
- Support for Sheets, Slides, Drive, published Docs, or non-Google editors.
- Word processors other than Google Docs.
- A bundled speech/voice feature, AI generation, or remote fonts.

## Product decisions

- **Chrome Manifest V3**, vanilla HTML/CSS/JavaScript, no build step, no libraries.
- **Permissions:** `activeTab` and `scripting` only. The content script is injected
  on demand when the user starts a session, so DocuType has no standing site access.
- **Pace presets:** Gentle (30 WPM), Steady (45 WPM), Quick (65 WPM). WPM is a
  reveal pace, not a measurement of the user's typing.
- **Reveal:** one Unicode code point at a time using chained `setTimeout` calls.
  Delay is randomized around the selected pace, with punctuation, line-break,
  and occasional thinking pauses.
- **Progress:** revealed characters / total characters, prefixed with `≈` and
  described as approximate. It never claims to verify typed output.
- **Panel:** isolated with Shadow DOM so Google Docs styles cannot leak in. Fixed
  bottom-right, no drag behavior (not needed for the core experience).
- **Theme:** follow Google Docs' page background where detectable, with OS
  `prefers-color-scheme` as the fallback.
- **Privacy:** popup sends the passage directly to the content script via
  `chrome.tabs.sendMessage`. No storage, no background worker, no fetch.

## Architecture

```
manifest.json
lib/shared.js          URL guard, constants, pace presets, text helpers
popup/                 Popup markup, styling, tab validation, injection
content/typing-engine.js  Deterministic, testable reveal scheduler
content/panel-styles.js   Shadow-DOM CSS
content/panel.js          Panel rendering, controls, theme, lifecycle
content/content.js        Message wiring, session replacement, guards
icons/                 Rasterized extension icons + source SVG
tests/                 Node unit tests and browser harnesses
```

`lib/shared.js` is UMD-style so the same code runs in extension pages, content
scripts, and Node tests. Content modules attach to a single `DocuType` namespace
and are guarded against duplicate injection. Starting a new session destroys the
previous engine and panel before creating replacements, so timers and listeners
cannot accumulate.

## Error handling

- Popup validates the active tab and blocks starting elsewhere.
- Discarded tabs, unavailable URLs, blocked injection, empty passages, and
  content-script failures each get plain-language inline errors.
- The content script refuses starts outside a Google Docs document URL.
- The panel is only created after a successful start; failures leave the tab untouched.

## Responsible use

The README states the intended use plainly: guided typing practice, not academic
circumvention, and not a record of verified typing. The popup and panel both state
that the user types and DocuType never edits the document.
