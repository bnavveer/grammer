# Grammer privacy policy

Effective September 7, 2026. Applies to version 0.2.0 of the source and packaged extension in this repository.

## Text

Grammer runs when you invoke a shortcut, toolbar action, or context-menu action. It captures the selection in an accessible page or frame. To prevent stale edits, it temporarily keeps a local snapshot of the selected input's value or rich-text editor's markup. That snapshot is never sent to Google.

**Fix grammar** sends the selected text, a proofreading instruction, and your spelling preference directly to Google's Gemini API at generativelanguage.googleapis.com. The request uses Gemini 3.5 Flash-Lite and includes your Gemini API key in the x-goog-api-key header. The key is never put in the request URL. The request does not include the page URL, title, unselected surrounding text, or browsing history. **Test connection** sends a fixed example sentence instead of page content.

**Remove formatting** runs on your device without a network request. **Copy plain text** writes the result to the system clipboard only when you click it. Grammer does not read your clipboard. Your operating system or clipboard manager may retain copied text separately.

Selections and results are held in memory while a preview or request is active. Closing the preview cancels the request and releases its selection snapshot. Grammer does not save or log selections, requests, results, or editing history. Browser and provider internals may retain their own network data. Cancelling a request cannot recall text already received by Google.

## Google's processing

Grammer has no developer-operated backend. Grammar requests go directly to Google, which receives normal network metadata such as your IP address. Google's applicable Gemini API terms and policies govern processing and retention, including any differences between free and paid use. Requests set store to false; this is not a promise of zero retention by Google.

No analytics, advertising, remote fonts, or tracking SDKs are included. There is no extension account system and no sale of user data by this extension.

## Settings and keys

Spelling preferences and the model identifier are stored in chrome.storage.local. API keys use chrome.storage.session unless you enable **Remember my key on this device**. Session storage is cleared when Chrome restarts or the extension reloads, updates, or is disabled. Remembered keys are stored in chrome.storage.local without application-level encryption. Neither uses Chrome Sync.

Both storage areas are restricted to trusted extension pages and the service worker. Keys are not passed to content scripts or placed in page markup. Credentials are tied to the fixed Gemini API base URL. Old credentials saved for a different provider are not used for Gemini. Anyone with access to your browser profile or extension DevTools may be able to inspect stored keys.

Keyboard shortcut assignments are managed by Chrome. Grammer reads the current assignments to display them and opens Chrome's shortcut editor when you choose to change them.

## Controls and deletion

Use **Forget saved key** to clear the credential from both storage areas. **Reset settings** clears preferences, credentials, and optional API permissions. It leaves Chrome-managed shortcut assignments unchanged. Uninstalling the extension removes its local extension storage. Deletion does not remove requests already held by Google or clipboard history held by your operating system.

Chrome asks for access to generativelanguage.googleapis.com when you connect Gemini. Host permissions cover that hostname's paths and ports. Page access otherwise starts with an explicit action through activeTab; Grammer does not automatically scan pages.

## Questions

Open a non-sensitive issue in the source repository where you obtained this release. For security concerns, follow [SECURITY.md](SECURITY.md). Include only public examples, never API keys or private documents.
