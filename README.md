# DocuType

DocuType is a guided typing practice extension for Google Docs. It types the passage you provide into the document at your cursor, one character at a time, with a variable pace and pauses. The floating control bar shows approximate progress and lets you pause, resume, stop, or change speed.

DocuType inserts text automatically. It does not verify who wrote the passage or measure typing skill. Use it only where this kind of assistance is allowed.

## Install in Chrome

1. Download or clone this repository to your computer.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the DocuType folder containing `manifest.json`.
5. Optional: pin DocuType from Chrome's extensions menu.

To update an existing installation, open `chrome://extensions` and click **Reload** on DocuType.

## Install in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` in the DocuType folder.

Firefox removes temporary add-ons when it restarts. Load DocuType again from the same page after restarting Firefox.

## Use DocuType

1. Open an editable Google Docs document and click where the passage should begin.
2. Click the DocuType toolbar icon.
3. Enter or paste your passage and choose a starting speed.
4. Click **Start typing**.

The popup closes and the passage is inserted into the main document. The floating bar does not display the passage.

Use the floating bar to:

- **Pause** and **Resume** the session.
- Change the speed to **30, 45, or 65 WPM** while typing or paused. The selected pace applies to the next character.
- **Stop** the session. Text already inserted stays in the document; use Google Docs Undo (`Ctrl+Z` on Windows/Linux or `Cmd+Z` on Mac) to remove it.

Progress is approximate and shows how much of the passage DocuType has inserted. It does not verify the document text. For best results, keep the Google Docs tab in the foreground and avoid moving the cursor during a session.

## Where it works

DocuType works on editable Google Docs document pages. It does not work in Sheets, Slides, Drive, published documents, or view-only documents. The passage limit is 10,000 characters.

Google Docs does not provide an official extension API for typing at the cursor. DocuType uses Docs' internal input surface, which Google may change. If insertion stops working after a Docs update, reload the document and try again.

## Privacy

DocuType has no analytics, storage, or network requests. Your passage stays in the extension popup and the current Docs tab while a session is active. It is not saved or sent anywhere. DocuType does not read your document contents.

The extension requests only `activeTab` and `scripting` permissions to access the current tab after you start a session and load its local code into Google Docs.

## Troubleshooting

**DocuType says the tab is unsupported.** Open an editable Google Docs document in the current tab, then open DocuType again.

**DocuType cannot find the editor.** Click in the document, wait for it to finish loading, and try again. Reload the Docs tab if needed.

**The text appears in the wrong place.** DocuType inserts at the active cursor. Stop the session, click the correct location, and start again.

**The popup or floating bar does not appear.** Reload the Docs tab and then reload DocuType from the browser's extensions page.

**Some punctuation or spelling changes.** Google Docs may apply autocorrect or smart quotes while text is entered.

## For contributors

DocuType uses plain HTML, CSS, and vanilla JavaScript, with no runtime dependencies. To run the checks, install Node.js 20 or later and run:

```sh
npm test
npm run test:browser
npm run check
```

The browser tests use a simulated Docs input surface; they do not replace a manual check in a scratch document.
