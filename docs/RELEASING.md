# Release checklist

## Source release

- Run `npm ci`, `npm run check`, `npm test`, and `npm run test:browser` with Playwright's Chromium installed.
- Load the unmodified `extension` directory in current stable Chrome. Verify both actual keyboard shortcuts, context-menu actions, toolbar buttons, provider permission approval and denial, clipboard copy, and Undo. Automated tests use a temporary loopback grant and don't replace this manual permissions pass.
- Test a live Gemini correction with your own key. Don't put the key in a fixture, screenshot, terminal transcript, or commit. If publishing an early build without live verification, mark it as a prerelease and state that API tests used a fake server.
- Check plain inputs, multiline text, partial rich-text selections, a same-origin iframe, and a changed editor during a pending request. Review the documented custom-editor limitations.
- Bump the version in `package.json`, `package-lock.json`, and `extension/manifest.json`, then update displayed versions, privacy dates, changelog, and package examples.
- Run `npm run package`. Inspect the ZIP contents and its `.sha256` file. The ZIP must not contain tests, development dependencies, credentials, browser profiles, or private documents.
- Publish the source under the included MIT license, enable private vulnerability reporting in the repository, and attach the ZIP and checksum to a tagged release.

The repository includes a `.gitignore`, pinned development dependency, pinned CI actions, contributor instructions, a privacy policy, and a security policy. Set repository-specific descriptions and reporting contacts when the remote repository exists.

## Chrome Web Store

This project does not include a store listing or a publisher account. The maintainer needs to prepare those separately.

- Host `PRIVACY.md` at a stable public URL and link it in the listing.
- Describe selected-text grammar correction and local formatting removal as the extension's purpose. Disclose that grammar sends selections directly to Google Gemini.
- Explain every requested permission, including `clipboardWrite` and optional access to generativelanguage.googleapis.com. No wildcard API-host permission is needed.
- Complete the store's current privacy disclosures based on the actual extension behavior and distribution setup.
- Capture listing screenshots without keys or private content. Include clear setup and provider billing instructions.
- Upload the packaged ZIP through the publisher dashboard and complete the current store review process.

Review the store's current requirements before submission. Publishing a source repository and getting a Web Store listing are separate steps.
