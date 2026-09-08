import { API_BASE_URL, API_PERMISSION, DEFAULTS, loadSettings, loadCredential, protectStorage, saveSettings, validateSettings } from "./lib/settings.js";
import { showShortcuts, bindShortcuts } from "./lib/ui.js";

const $ = (id) => document.getElementById(id);
let saved = { ...DEFAULTS };
let initialized = false;

function status(message, kind = "") {
  $("form-status").textContent = message;
  $("form-status").className = `status ${kind}`;
}

function formSettings() { return validateSettings({ dialect: $("dialect").value }); }

async function renderCredentialStatus() {
  const key = await loadCredential();
  const { credential } = await chrome.storage.local.get("credential");
  $("api-key").value = "";
  $("api-key").placeholder = key ? "Key saved — leave blank to keep it" : "Paste your Gemini API key";
  $("forget-key").hidden = !key;
  $("remember").checked = Boolean(credential?.key && credential.baseUrl === API_BASE_URL);
}

async function renderSettings() {
  saved = await loadSettings();
  $("dialect").value = saved.dialect;
  await renderCredentialStatus();
}

$("reveal").addEventListener("click", () => {
  const show = $("api-key").type === "password";
  $("api-key").type = show ? "text" : "password";
  $("reveal").textContent = show ? "Hide" : "Show";
  $("reveal").setAttribute("aria-label", show ? "Hide API key" : "Show API key");
  $("reveal").setAttribute("aria-pressed", String(show));
});

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!initialized) return;
  const settings = formSettings();
  const typedKey = $("api-key").value.trim();
  const remember = $("remember").checked;
  $("save").disabled = $("test").disabled = true;
  try {
    // Invoke directly in the submit gesture, before any await, so Chrome can prompt.
    const granted = await chrome.permissions.request({ origins: [API_PERMISSION] });
    if (!granted) throw new Error("Gemini access was not granted. Save again and allow access to connect.");
    const key = typedKey || await loadCredential();
    saved = await saveSettings(settings, key, remember);
    const permissions = await chrome.permissions.getAll();
    const oldOrigins = (permissions.origins ?? []).filter((origin) => origin !== API_PERMISSION);
    if (oldOrigins.length) await chrome.permissions.remove({ origins: oldOrigins });
    await renderCredentialStatus();
    status("Settings saved. Select text on a webpage to try Grammer.", "success");
  } catch (error) { status(error.message, "error"); }
  finally { $("save").disabled = $("test").disabled = false; }
});

$("test").addEventListener("click", async () => {
  try {
    if (JSON.stringify(formSettings()) !== JSON.stringify(saved) || $("api-key").value) throw new Error("Save your changes before testing the connection.");
    $("test").disabled = $("save").disabled = true;
    status("Testing Gemini…");
    const response = await chrome.runtime.sendMessage({ type: "GRAMMER_TEST" });
    if (!response?.ok) throw new Error(response?.error || "Reload the extension and try again.");
    status("Connected. Gemini returned an edit successfully.", "success");
  } catch (error) { status(error.message, "error"); }
  finally { $("test").disabled = $("save").disabled = false; }
});

$("forget-key").addEventListener("click", async () => {
  try {
    await Promise.all([chrome.storage.local.remove("credential"), chrome.storage.session.remove("credential")]);
    await renderCredentialStatus();
    status("API key removed from this extension.", "success");
  } catch { status("Could not remove the key. Reload this settings page and try again.", "error"); }
});

$("reset").addEventListener("click", async () => {
  try {
    await Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]);
    const { origins = [] } = await chrome.permissions.getAll();
    if (origins.length) await chrome.permissions.remove({ origins });
    await renderSettings();
    status("Settings, stored keys, and Gemini permission cleared. Keyboard shortcuts stay as you set them.", "success");
  } catch { status("Could not reset settings. Reload this page and try again.", "error"); }
});

bindShortcuts();
$("save").disabled = $("test").disabled = true;
void (async () => {
  await protectStorage();
  await renderSettings();
  await showShortcuts();
  initialized = true;
  $("save").disabled = $("test").disabled = false;
})().catch(() => status("Settings could not be loaded. Reload the extension and open this page again.", "error"));
