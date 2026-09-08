# Changelog

## 0.2.0 — 2026-09-07

- Renamed the extension to Grammer and replaced the logo with a plain G.
- Simplified setup to a Gemini API key. Grammar uses Gemini 3.5 Flash-Lite through Google's native API with minimal thinking.
- Limited optional API access to Google's Gemini hostname and kept credentials out of request URLs.
- Added prominent shortcut customization controls and refresh of displayed bindings when returning from Chrome's shortcut editor.
- Updated documentation and tests for Gemini authentication, response parsing, blocked responses, and isolation of old provider keys.

## 0.1.0 — 2026-09-07

- Added grammar correction using a user-configured OpenAI-compatible LLM, with OpenAI and Ollama presets.
- Added local formatting removal, plain-text copy, and selected-text replacement with a review step.
- Added keyboard shortcuts, toolbar actions, and context-menu actions.
- Added session-only keys, opt-in local key persistence, provider permissions, cancellation, bounded requests, and stale-edit protection.
- Added MIT licensing, contributor and privacy documentation, unit and Chromium integration tests, and ZIP packaging.
