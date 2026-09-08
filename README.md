# Grammer

<img src="extension/icons/mark.svg" alt="Grammer's G logo" width="64" height="64">

Select text, press a shortcut, and fix its grammar with Gemini. Or remove its formatting entirely on your device.

Grammer is a Chrome extension with customizable keyboard shortcuts, a preview before every replacement, and one setup requirement: your own Gemini API key. It uses **Gemini 3.5 Flash-Lite** with minimal thinking for quick corrections. The extension has no runtime dependencies, backend, analytics, or bundled keys.

## Install

1. Download the ZIP from [Releases](https://github.com/bnavveer/grammer/releases) and extract it, or clone this repository.
2. Open `chrome://extensions` in Chrome 120 or later and turn on **Developer mode**.
3. Click **Load unpacked**. Select the extracted folder containing `manifest.json`, or this repository's **`extension` folder**.
4. Pin **Grammer** from Chrome's extensions menu, then open **Settings**.
5. Paste a [Gemini API key from Google AI Studio](https://aistudio.google.com/apikey), click **Save & connect**, and allow access to Gemini.

Formatting cleanup works without a key. No build step or Node.js installation is needed to use the extension.

## Use it

| Action | Windows / Linux default | macOS default |
| --- | --- | --- |
| Fix grammar | Alt + Shift + G | Option + Shift + G |
| Remove formatting | Alt + Shift + P | Option + Shift + P |

Select text in an input, rich-text editor, or webpage. Press a shortcut, choose an action from the toolbar, or right-click your selection. Review the result, edit it if needed, then **Replace selection** or **Copy plain text**. Press Escape while the preview is focused to close it and cancel a pending request.

Both actions produce plain text. Rich-text replacement removes inline fonts, colors, highlighting, emphasis, and links from the selection. The surrounding editor's default CSS still applies. Paragraph breaks and spacing are retained; literal Markdown characters stay as written. Read-only selections offer copying.

If the editor changes while Gemini is working, Grammer blocks replacement to protect newer edits. The result stays available to copy. Use your editor's Undo to revert; rich-text cleanup can require more than one Undo step.

## Change the hotkeys

Open **Settings → Change keyboard shortcuts**, or choose **Change shortcuts** in the popup. Chrome's shortcut editor opens at `chrome://extensions/shortcuts`.

Find **Grammer**, click the pencil next to either action, and press your preferred key combination. Chrome saves it automatically. Return to Grammer to see the updated shortcut. You can clear a binding and use the toolbar or right-click menu instead.

Chrome manages these settings, so they survive extension reloads and Grammer's **Reset settings** action. OS shortcuts and other extensions can take priority. See [Chrome's command documentation](https://developer.chrome.com/docs/extensions/reference/api/commands) for supported combinations.

## Gemini setup

The model and Google endpoint are configured in the extension. You only need to enter your key; there is no provider or base-URL field.

- Model: `gemini-3.5-flash-lite`
- Thinking: `MINIMAL`, with thought output excluded
- API: native Gemini `generateContent`
- Authentication: `x-goog-api-key` header; the key never appears in the URL

Google describes [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) as a model for low-latency workloads. Minimal thinking favors shorter response times; actual correction time still depends on passage length, your connection, and Google's service. See the [thinking controls](https://ai.google.dev/gemini-api/docs/generate-content/thinking) and [native API reference](https://ai.google.dev/api/generate-content).

**Test connection** sends one example sentence using your saved key. Google's API quotas and billing apply. Requests time out after 25 seconds, and selections are limited to 16,000 JavaScript characters. Your key needs access to the Gemini API and the selected model.

Keys are session-only by default and clear when Chrome restarts or the extension reloads, updates, or is disabled. **Remember my key on this device** stores it locally without encryption; it never uses Chrome Sync. **Forget saved key** removes it, and **Reset settings** also removes preferences and the Gemini permission. Keys saved for an earlier non-Gemini provider are never reused for Google.

## Privacy and permissions

Grammar sends only the selected text and a proofreading instruction directly to Google. It doesn't send the page URL, title, surrounding document, or browsing history. A local editor snapshot is held temporarily to detect stale edits; it never leaves your device. Formatting cleanup makes no network request.

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access after you invoke an action. |
| `scripting` | Capture the selection and display its preview. |
| `storage` | Save spelling preferences and your session-only or remembered key. |
| `contextMenus` | Offer both actions in the right-click menu. |
| `clipboardWrite` | Copy results as plain text. No clipboard-read permission. |
| Optional `https://generativelanguage.googleapis.com/*` | Send grammar requests to Gemini after you connect. |

There are no wildcard provider permissions and no automatically running content scripts. Both storage areas are [restricted to trusted extension contexts](https://developer.chrome.com/docs/extensions/reference/api/storage). The API sets `store: false`; Google's applicable terms still govern its processing and retention. Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Compatibility

Standard text inputs, textareas, native `contenteditable` regions, read-only selections, and accessible same-origin iframes are supported. Password fields are excluded.

Chrome's internal pages, the Web Store, and the built-in PDF viewer block injection. Google Docs' canvas, closed shadow roots, cross-origin frames, and editors with custom document models aren't guaranteed. If replacement isn't accepted, copy the preview and paste through the editor.

Model output is always treated as literal text. A model can still make a bad edit or follow instructions embedded in a document, so review its preview. Truncated, blocked, empty, and malformed Gemini responses aren't offered as finished edits.

Native editing commands preserve Chrome's editor behavior and Undo where supported. `execCommand` is deprecated and custom-editor compatibility needs ongoing testing. The fallback for plain inputs dispatches an input event but may not preserve Undo on every site. See [MDN's editing API notes](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).

## Develop and test

Use Node.js 22 or later:

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run package
```

Packaging writes `dist/grammer-0.2.0.zip`, its SHA-256 checksum, and the unpacked `dist/grammer` folder. It includes extension files, the MIT license, and privacy documentation. The `zip` CLI is required; use WSL or install a ZIP CLI on Windows.

Run `npm run demo` and visit `http://127.0.0.1:4173` for an editing playground. `npm run smoke` opens the unmodified extension and playground in a separate, visible Chromium profile for checking real hotkeys and permission prompts. Ctrl+C closes it and deletes that temporary profile. Your regular Chrome profile is not used.

Browser tests load a real extension with a local fake Gemini server. Only their temporary copy replaces the fixed Google endpoint and grants the loopback host; the distributed manifest and source keep Google as the only API destination. Tests require no real key or paid request. Native OS bindings, permission approval/denial, and live Gemini quality also need a manual pass before release.

After editing `PRIVACY.md`, run `npm run docs` to regenerate the packaged policy. After editing the SVG logo, run `node scripts/icons.mjs` to regenerate PNG icons. Reload the extension and your test page after changing source files.

```text
extension/
  manifest.json         Permissions and default shortcuts
  background.js         Commands, frame routing, and Gemini requests
  content.js            Selection capture, preview, copy, and replacement
  lib/                  Gemini client, fixed model, settings, and storage
  popup.* / options.*   Toolbar and settings
  help.* / privacy.html Local documentation
scripts/                Validation, packaging, playground, and icon generation
tests/                  Unit tests and Chromium integration tests
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [release checklist](docs/RELEASING.md). Licensed under [MIT](LICENSE).
