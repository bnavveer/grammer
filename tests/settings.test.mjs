import test from "node:test";
import assert from "node:assert/strict";
import { API_BASE_URL, API_PERMISSION, DEFAULTS, validateSettings, saveSettings, loadCredential, loadSettings } from "../extension/lib/settings.js";

function storageArea() {
  let state = {};
  return {
    async get(key) { return { [key]: state[key] }; },
    async set(values) { Object.assign(state, structuredClone(values)); },
    async remove(key) { delete state[key]; },
    async setAccessLevel(value) { assert.equal(value.accessLevel, "TRUSTED_CONTEXTS"); },
  };
}

test("Gemini endpoint and model are fixed, and old provider settings cannot override them", () => {
  assert.equal(API_BASE_URL, "https://generativelanguage.googleapis.com/v1beta");
  assert.equal(API_PERMISSION, "https://generativelanguage.googleapis.com/*");
  assert.deepEqual(validateSettings({ provider: "custom", baseUrl: "https://untrusted.example", model: "injected", dialect: "en-GB", apiKey: "not-allowed" }), { model: "gemini-3.5-flash-lite", dialect: "en-GB" });
  assert.deepEqual(validateSettings({ dialect: "injected" }), DEFAULTS);
});

test("session keys stay off disk and persistence is opt-in", async () => {
  globalThis.chrome = { storage: { local: storageArea(), session: storageArea() } };
  try {
    await saveSettings(DEFAULTS, "synthetic-gemini-key", false);
    assert.equal((await chrome.storage.local.get("credential")).credential, undefined);
    assert.equal(await loadCredential(), "synthetic-gemini-key");
    await saveSettings(DEFAULTS, "synthetic-remembered-key", true);
    assert.equal((await chrome.storage.session.get("credential")).credential, undefined);
    assert.equal(await loadCredential(), "synthetic-remembered-key");
    assert.deepEqual(await loadSettings(), DEFAULTS);
    await assert.rejects(saveSettings(DEFAULTS, "", false), /Gemini API key/);
    await assert.rejects(saveSettings(DEFAULTS, "bad\nkey", false), /line breaks/);
  } finally { delete globalThis.chrome; }
});

test("a previous provider's saved key is never sent to Gemini", async () => {
  globalThis.chrome = { storage: { local: storageArea(), session: storageArea() } };
  try {
    await chrome.storage.local.set({ credential: { baseUrl: "https://api.openai.com/v1", key: "synthetic-old-key" } });
    assert.equal(await loadCredential(), "");
    await saveSettings(DEFAULTS, "synthetic-gemini-key", false);
    assert.equal((await chrome.storage.local.get("credential")).credential, undefined);
    assert.equal(await loadCredential(), "synthetic-gemini-key");
  } finally { delete globalThis.chrome; }
});
