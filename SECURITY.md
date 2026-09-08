# Security

## Reporting

Don't put credentials, private text, or working exploit details in a public issue. If the source repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**. If it doesn't, open an issue asking the maintainer for a private reporting channel without including the vulnerability details.

Only the latest source version is maintained. Maintainers should review the reporting setup before publishing a release; see [docs/RELEASING.md](docs/RELEASING.md).

## Boundaries

The page and its content are untrusted. The extension captures a selection after user action and runs page-facing code in Chrome's isolated world. A Shadow DOM preview avoids most style collisions, but it isn't a security boundary: a webpage can inspect or interfere with its DOM. It must never contain credentials. A hostile page can also modify its own editor, so users should treat previews on untrusted pages accordingly.

The service worker owns Gemini requests. Messages that run actions or test Gemini are restricted to the extension's own popup and settings page. There is no `externally_connectable` entry or bridge from `window.postMessage`.

Content scripts cannot access local or session extension storage. Credentials are pinned to the fixed Gemini API base URL. Neither saved settings nor runtime messages can override that destination. Requests use HTTPS and the x-goog-api-key header; keys are never placed in URLs. Redirects are blocked. The manifest permits optional API access only to generativelanguage.googleapis.com. Keys saved for an older provider are not reused for Gemini.

Selected documents and model output are untrusted data. The proofreading instruction asks the model not to follow document instructions, but does not guarantee it. The model has no tools, and output is inserted as literal text only. A preview is required before replacing a selection. The original editor is checked again before applying an edit.

## Limits

Remembered API keys are not encrypted by the extension. Someone with access to the browser profile, extension DevTools, a compromised browser, or a malicious extension update may obtain them. Session-only storage reduces persistence; it is not a secure hardware vault.

Chrome's optional host permissions apply across all paths and ports on a hostname. Restricted browser pages and inaccessible frames cannot be edited. Native editing APIs are deprecated and may behave differently in custom editors. Selection validation reduces accidental overwrites but cannot protect against a page that deliberately interferes with its own DOM.

There has been no independent security audit. Automated tests exercise data flow, credential isolation, literal insertion, stale selections, and error handling. They don't establish that a third-party model or webpage is trustworthy.
