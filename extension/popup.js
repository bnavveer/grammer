import { loadCredential, API_PERMISSION, MODEL_LABEL, protectStorage } from "./lib/settings.js";
import { showShortcuts, bindShortcuts } from "./lib/ui.js";

document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
bindShortcuts();

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: "GRAMMER_RUN", action: button.dataset.action });
      if (!response?.ok) throw new Error(response?.error || "Reload the extension and try again.");
      window.close();
    } catch (error) {
      const notice = document.getElementById("notice");
      notice.hidden = false;
      notice.classList.add("error");
      notice.textContent = error.message;
    } finally { button.disabled = false; }
  });
}

async function initialize() {
  await protectStorage();
  const allowed = await chrome.permissions.contains({ origins: [API_PERMISSION] });
  const key = await loadCredential();
  const needsKey = !key;
  const ready = allowed && !needsKey;
  document.getElementById("connection").classList.toggle("ready", ready);
  document.getElementById("connection-label").textContent = ready
    ? `Ready · ${MODEL_LABEL}`
    : "Add your Gemini key in Settings to fix grammar.";
  await showShortcuts();
}

void initialize().catch(() => {
  document.getElementById("connection-label").textContent = "Open Settings to connect Gemini.";
});
