# DocuType

DocuType types a supplied passage directly into your Google Docs document at a chosen pace. Paste the passage into the popup, place your cursor, and press **Start typing**. The passage is written into the document itself; the floating DocuType card only shows status, approximate progress, Pause/Resume, and Stop.

DocuType is an autotyper. It inserts text into your document and does not claim that you typed it yourself. Use it only where outside help is allowed.

## Requirements

- Google Chrome 105 or later, or Firefox 109 or later.
- An editable Google Docs document at `docs.google.com/document/d/...`.
- A cursor placed where you want the passage to begin.

There is no build step and no package installation needed to use the extension.

## Install

### Chrome (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Optional: pin DocuType from the extensions menu for quicker access.

### Firefox (temporary)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this repository.

Firefox removes temporary add-ons when the browser restarts. Reload it the same way after restarting Firefox.

### Firefox (signed install)

A permanent Firefox install must be signed by Mozilla. The manifest already has the add-on ID `docutype@mrduhlol.github.io` and declares no data collection.

1. Package the extension folder:
   ```sh
   zip -r docutype-firefox.zip manifest.json popup content lib icons
   ```
2. Submit the ZIP through the [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/) for signing (unlisted distribution is fine for personal use), or sign it with `web-ext sign` and a Mozilla API key.
3. Install the signed `.xpi` in Firefox.

Mozilla signing is required for permanent installation. Loading the folder temporarily does not require signing.

## Use

1. Open an editable Google Docs document and click in the document where the passage should start.
2. Click the DocuType toolbar icon.
3. Paste or type the passage (up to 10,000 Unicode characters).
4. Choose a pace.
5. Click **Start typing**.

The popup closes and the compact DocuType bar appears in the bottom-right. After a short preparation delay, DocuType inserts the passage one character at a time at the selected pace.

The passage is never displayed in the DocuType bar. It goes into the document through Google Docs' hidden input surface.

## Controls

- **Pause / Resume** — freezes or continues insertion without losing your place.
- **Stop** — ends the session and removes the bar.

There is no automatic cleanup. Text that has already been inserted stays in the document after Stop. If you want it gone, use **Ctrl+Z / Cmd+Z** in Google Docs, or undo as you normally would.

Starting a new session stops the previous one and begins inserting at the current cursor. It does **not** delete text from an earlier session. DocuType intentionally has no Restart control because removing already-inserted text would be unsafe.

Clicking into the document while DocuType is running moves the insertion point. For a clean result, place the cursor before starting and avoid clicking elsewhere until the session finishes.

## Pace

| Preset | Pace |
| --- | --- |
| Gentle | 30 WPM |
| Steady | 45 WPM |
| Quick | 65 WPM |

The pace controls real insertion timing. The rhythm varies slightly and pauses a little longer at punctuation and line breaks to feel more natural.

Progress in the bar is approximate: it reflects how much of the passage has been inserted, not verified keystrokes or a measure of typing skill.

## How insertion works

Google Docs does not provide an extension API for inserting text at the cursor. DocuType uses the same hidden input surface Docs uses for keyboard input:

- It finds `iframe.docs-texteventtarget-iframe` and its contenteditable element.
- Printable ASCII characters, spaces, tabs, and line breaks are sent as synthetic key sequences. Tabs become spaces.
- Non-ASCII characters (accented letters, curly quotes, CJK, emoji) are sent as synthetic inline paste events carrying HTML and plain text.
- The bar's Pause/Stop controls are isolated so their clicks and keystrokes do not leak into the document.

This surface is undocumented and may change when Google updates Docs. If it does, DocuType stops with an error rather than silently pretending to type. Test on a scratch document after a Docs update.

## Privacy and permissions

DocuType requests only two permissions:

- **`activeTab`** — temporary access to the current tab after you click the extension.
- **`scripting`** — injects DocuType's local content files into that Docs tab when you press Start.

There are no host permissions, no storage permission, no background worker, no cookies, no analytics, and no network requests. The passage is not sent anywhere and is not saved:

- The passage lives in the popup and in memory inside the current Docs tab.
- Stopping, closing, reloading, or navigating away discards it.
- DocuType does not read or upload the document's contents, and it does not record your keystrokes. It only drives the hidden input surface at the cursor.
- All source code is in this repository and can be inspected before installing.

The Firefox manifest declares `data_collection_permissions.required: ["none"]`.

## Supported pages

DocuType works only on Google Docs document URLs, such as:

- `https://docs.google.com/document/d/.../edit`
- `/view`, `/preview`, and similar document modes

It intentionally does not run on published links (`/document/d/e/.../pub`), Google Sheets, Slides, Drive, or other sites. The document must be editable; view-only documents cannot accept insertion.

## Responsible use

DocuType inserts the passage into your document automatically. It is not a record of manual typing, and progress in the bar is not evidence that you wrote anything.

Use DocuType only where outside help is permitted. Do not use it for assessments, exams, or other work where assistance is prohibited, and do not treat it as a replacement for learning the material. You remain responsible for what you submit and for following the rules that apply to your work.

## Troubleshooting

**The popup says the tab is not a Google Docs document.**
Open an editable Google Docs document in the current tab, then reopen the popup.

**DocuType couldn't find the document editor.**
Click into the document so Docs has an active cursor, then try again. If the problem continues, reload the Docs tab. Very new or offline documents may still be loading.

**Google Docs rejected the text.**
Make sure the document is editable and not view-only, then reload the tab and try again. If Docs changed its hidden input surface, DocuType will stop with this error until it is updated.

**The text went to the wrong place, or stopped appearing.**
DocuType inserts at the current cursor. Avoid clicking elsewhere during a session. If you click away, Stop and start again with the cursor in the right place. Keep the Docs tab in the foreground; browsers may throttle timers in background tabs.

**Chrome or Firefox blocked DocuType, or it could not connect.**
Reload the Google Docs tab and press Start again. After installing, updating, or reloading the extension, reload any Docs tab that was already open. In Chrome, check `chrome://extensions` for extension errors.

**The bar disappeared.**
Stop removes the bar and ends the session. Use the popup to start again. Navigating within Google Docs can also require a fresh start.

**The bar's shortcut keys do not reach Docs.**
The bar isolates its own clicks and key presses. Click back into the document to restore normal Docs shortcuts.

**The text is different from the passage.**
Google Docs autocorrect and smart quotes can change text as it is typed. Turn those options off in Docs if you need exact characters. Non-ASCII text is inserted through paste and is less likely to be autocorrected.

**The passage is rejected as too long.**
The limit is 10,000 Unicode characters. Shorten the passage in the popup.

**The bar colors do not match Docs.**
The bar follows the page background when it can, with your system light/dark preference as a fallback. Give Docs a moment to finish switching themes.

**Firefox removed DocuType after restarting.**
Temporary add-ons are removed on restart. Load it again from `about:debugging`, or install a Mozilla-signed build for a permanent install.

## Project layout

```
manifest.json                  Chrome/Firefox Manifest V3 definition
popup/                        Passage form, pace presets, tab validation, start flow
content/content.js            Message listener, URL guard, one-session lifecycle
content/docs-input.js         Docs input-surface discovery and key/paste insertion
content/typing-engine.js      Deterministic character timer and pacing
content/control-bar.js        Compact Shadow-DOM status and pause/stop bar
content/control-bar-styles.js Bar light/dark styling
lib/shared.js                 URL guard, limits, pace presets, shared helpers
lib/browser-api.js            Firefox `browser` / Chrome `chrome` namespace selection
icons/                        Extension icons
tests/                        Node unit tests and headless browser harnesses
docs/                         Design notes and implementation plans
```

## Development

Runtime code is plain HTML, CSS, and vanilla JavaScript with no dependencies. The popup injects the content bundle as classic scripts in this order:

1. `lib/shared.js`
2. `lib/browser-api.js`
3. `content/typing-engine.js`
4. `content/docs-input.js`
5. `content/control-bar-styles.js`
6. `content/control-bar.js`
7. `content/content.js`

After changing code, reload the extension (`chrome://extensions` in Chrome, or reload the temporary add-on in Firefox), then reload any open Google Docs tab.

### Tests

Requires Node.js 20 or later and, for browser tests, Chromium or Google Chrome.

```sh
npm test              # shared helpers, Docs input helpers, typing engine, manifest
npm run test:browser  # Docs input, control bar, popup, and content harnesses
npm run check         # JavaScript syntax checks
```

Set `CHROME_PATH` if Chromium is not on your `PATH`. The browser suite uses `openssl` to create a temporary local HTTPS certificate for the Google Docs URL scenarios.

The browser harnesses model the Docs input surface; they do not run against live Google Docs. Before releasing a change, load the extension into both Chrome and Firefox and test insertion on a scratch document, including Pause, Resume, Stop, newlines, spaces, and an emoji.
