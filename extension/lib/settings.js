export const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const API_PERMISSION = `${new URL(API_BASE_URL).protocol}//${new URL(API_BASE_URL).hostname}/*`;
export const DEFAULTS = Object.freeze({ model: "gemini-3.5-flash-lite", dialect: "preserve" });
export const MODEL_LABEL = "Gemini 3.5 Flash-Lite";
export const MAX_TEXT_LENGTH = 16000;

export function validateSettings(input = {}) {
  // The destination and model are fixed. Old provider settings cannot redirect a Gemini key.
  return {
    model: DEFAULTS.model,
    dialect: ["preserve", "en-US", "en-GB"].includes(input.dialect) ? input.dialect : "preserve",
  };
}

export async function protectStorage() {
  await Promise.all([
    chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
    chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
  ]);
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return validateSettings(settings);
}

export async function loadCredential() {
  const [session, local] = await Promise.all([
    chrome.storage.session.get("credential"),
    chrome.storage.local.get("credential"),
  ]);
  const credential = session.credential ?? local.credential;
  return credential?.baseUrl === API_BASE_URL && typeof credential.key === "string" ? credential.key : "";
}

export async function saveSettings(settings, key, remember) {
  const validated = validateSettings(settings);
  if (typeof key !== "string" || !key.trim() || key.length > 8192 || /[\r\n]/.test(key)) {
    throw new Error("Enter a Gemini API key without line breaks.");
  }
  await protectStorage();
  await Promise.all([
    chrome.storage.session.remove("credential"),
    chrome.storage.local.remove("credential"),
  ]);
  const storage = remember ? chrome.storage.local : chrome.storage.session;
  await storage.set({ credential: { baseUrl: API_BASE_URL, key: key.trim() } });
  await chrome.storage.local.set({ settings: validated });
  return validated;
}
