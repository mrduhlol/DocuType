# DocuType

Guided typing practice for Google Docs. Paste a passage into the DocuType popup, then type it yourself in your document while a floating panel reveals the text one character at a time.

DocuType is a practice aid, not an autotyper: it never enters text into your document, never edits it, and never reads what you type.

## Requirements

- Google Chrome 105 or later. Other Chromium-based browsers may work but are not tested.
- An editable Google Docs document (`docs.google.com/document/d/...`).

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Optional: pin DocuType from the extensions menu for quicker access.

There is no build step and no package installation needed to use the extension.

## Use

1. Open a Google Docs document.
2. Click the DocuType toolbar icon.
3. Paste or type the passage you want to practice (up to 10,000 characters).
4. Choose a reveal pace.
5. Click **Start practice session**.

The popup closes and the practice panel appears in the bottom-right corner of the document. Start typing the passage in the document yourself; the panel reveals the next character at the selected pace.

## Controls

- **Pause / Resume** — freezes or continues the reveal without losing your place.
- **Restart** — clears the revealed text and starts the same passage again.
- **Stop** — closes the panel and ends the session.

Starting a new session from the popup replaces the existing panel.

## Pace

| Preset | Pace |
| --- | --- |
| Gentle | 30 WPM |
| Steady | 45 WPM |
| Quick | 65 WPM |

The pace controls how quickly the prompt is revealed. It is not a measurement of your typing speed. The reveal varies slightly and pauses a little longer at punctuation and line breaks to feel more natural.

## Progress and responsible use

Progress is approximate. The percentage reflects how much of the prompt has been revealed, not how much you have typed correctly. DocuType does not check, score, or verify your typing.

Use DocuType only where outside help is permitted. Do not use it for assessments, exams, or other work where assistance is prohibited, and do not treat it as a replacement for learning the material. You remain responsible for what you submit.

## Privacy and permissions

DocuType requests only two Chrome permissions:

- **`activeTab`** — temporary access to the current tab after you click the extension.
- **`scripting`** — injects DocuType's local content files into that Docs tab when you press Start.

There are no host permissions, no storage permission, no background worker, no cookies, no analytics, and no network requests. DocuType does not send the passage anywhere and does not save it:

- The passage lives in the popup and in memory inside the current Docs tab.
- Stopping, closing, reloading, or navigating away discards it.
- DocuType does not read the document's contents or your keystrokes. It only mounts an isolated panel in the page.
- All source code is in this repository and can be inspected before installing.

## Supported pages

DocuType works only on Google Docs document URLs, such as:

- `https://docs.google.com/document/d/.../edit`
- `/view`, `/preview`, and similar document modes

It intentionally does not run on published links (`/document/d/e/.../pub`), Google Sheets, Slides, Drive, or other sites.

## Troubleshooting

**The popup says the tab is not a Google Docs document.**
Open an editable Google Docs document in the current tab, then reopen the popup.

**The popup says the tab is inactive or discarded.**
Reopen the document in a new tab and try again.

**Chrome blocked DocuType, or it could not connect.**
Reload the Google Docs tab and try Start again. If you just reloaded or updated the extension, existing Docs tabs also need a reload. Check `chrome://extensions` for any extension errors.

**Start does nothing or the panel does not appear.**
Reload the document tab, reopen the popup, and start the session again. DocuType injects its content files on demand, so a freshly reloaded extension cannot reach a Docs tab that was open before the reload until that tab is refreshed.

**The panel disappeared.**
Closing the panel or stopping the session ends it. Use the popup to start again. Navigating within Google Docs can also require a fresh start.

**My shortcut keys are not working normally.**
The panel keeps its own clicks and key presses from bubbling into Docs. Click back into the document to continue typing and to restore normal Docs shortcuts.

**The passage is rejected as too long.**
The limit is 10,000 characters. Shorten the passage in the popup.

**The panel colors do not match Docs.**
The panel follows the page background when it can, with your system light/dark preference as a fallback. Give Docs a moment to finish switching themes, or reopen the panel.

## Project layout

```
manifest.json            Chrome Manifest V3 definition
popup/                   Passage form, pace presets, tab validation, start flow
content/content.js       Message listener, URL guard, session lifecycle
content/typing-engine.js Deterministic character timer and pacing
content/panel.js         Shadow-DOM practice panel and controls
content/panel-styles.js  Panel light/dark styling
lib/shared.js            URL guard, limits, pace presets, shared helpers
icons/                   Extension icons
tests/                   Node unit tests and headless browser harnesses
docs/                    Design notes and implementation plan
```

## Development

Runtime code is plain HTML, CSS, and vanilla JavaScript with no dependencies. Content scripts are classic scripts loaded in this order:

1. `lib/shared.js`
2. `content/typing-engine.js`
3. `content/panel-styles.js`
4. `content/panel.js`
5. `content/content.js`

After changing code, click **Reload** on `chrome://extensions`, then reload any open Google Docs tab.

### Tests

Requires Node.js 20 or later and, for browser tests, Chromium or Google Chrome.

```sh
npm test              # shared helpers and typing engine
npm run test:browser  # panel, popup, and content harnesses in headless Chromium
npm run check         # JavaScript syntax checks
```

Set `CHROME_PATH` if Chromium is not on your `PATH`. The browser suite also uses `openssl` to create a temporary local HTTPS certificate for the Google Docs URL scenario.
