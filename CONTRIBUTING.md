# Contributing to Grammer

Start with the [README](README.md) to load the extension and run the playground. The extension source is plain JavaScript; there's no bundler between your changes and Chrome.

## Make a change

1. Create a branch for one issue or feature.
2. Keep the permissions small. Explain any new permission or network destination in the PR.
3. Reload the unpacked extension and your test page after editing the source.
4. Run `npm run check`, `npm test`, and `npm run test:browser`.
5. Add a test when a fix changes selection handling, credential access, request handling, or editor behavior. A small visual change usually needs a screenshot instead.

Browser tests use a local fake Gemini server and synthetic keys. Never add a live key to a test, fixture, screenshot, issue, or commit. Tests replace the Google endpoint and add a loopback host permission only in a temporary copy of the extension. The release keeps a fixed Google endpoint.

## Code decisions

- Keep all network calls in the service worker. Content scripts receive only selected text, progress, results, and user-facing errors.
- Treat model responses as untrusted text. Use `textContent`, input values, or text insertion. Multiline rich-text insertion serializes a fixed DOM wrapper whose content is set with `textContent`; never interpolate raw responses into markup.
- Keep storage restricted to trusted extension contexts and keep keys tied to the fixed Gemini endpoint.
- Preserve unselected content and reject stale snapshots. Support copying when an editor can't accept a replacement.
- Prefer a small, inspectable change over another runtime dependency. Don't add analytics or remotely loaded code.
- Document known limits. A native textarea passing a test doesn't prove that every editor will work.

Use two-space indentation, ES modules where Chrome supports them, and sentence-case UI labels. `content.js` is an isolated-world classic script because it is injected directly through `chrome.scripting`.

## Report a bug

Include your Chrome version, operating system, affected editor, action used, and a short public sample that reproduces the issue. Mention whether **Copy plain text** worked. Remove personal text and keys from screenshots.

Keep review discussions respectful and focused on the change. Contributions are offered under this project's MIT license.
