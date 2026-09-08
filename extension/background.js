import { loadSettings, loadCredential, API_PERMISSION, MODEL_LABEL, protectStorage } from "./lib/settings.js";
import { correctGrammar } from "./lib/llm.js";

const storageReady = protectStorage();
const pending = new Map();
const actions = new Set(["fix-grammar", "plain-text"]);
const trustedPages = new Set(["popup.html", "options.html"].map((file) => chrome.runtime.getURL(file)));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of [["fix-grammar", "Grammer: fix grammar"], ["plain-text", "Grammer: remove formatting"]]) {
      chrome.contextMenus.create({ id, title, contexts: ["selection", "editable"] });
    }
  });
});

function frameKey(tabId, frameId) { return `${tabId}:${frameId}`; }
async function send(tabId, frameId, message) {
  return chrome.tabs.sendMessage(tabId, message, { frameId });
}

async function completeGrammar(tabId, frameId, requestId, text, controller) {
  try {
    await storageReady;
    const settings = await loadSettings();
    const allowed = await chrome.permissions.contains({ origins: [API_PERMISSION] });
    if (!allowed) throw new Error("Connect Gemini in Settings first. Remove formatting already works offline.");
    const key = await loadCredential();
    if (!key) {
      throw new Error("Add your Gemini API key in Settings. Session-only keys are cleared when Chrome restarts or the extension reloads.");
    }
    await send(tabId, frameId, { type: "GRAMMER_PROGRESS", requestId, label: `Fixing grammar with ${MODEL_LABEL}…` });
    const result = await correctGrammar(text, settings, key, { signal: controller.signal });
    if (!controller.signal.aborted) await send(tabId, frameId, { type: "GRAMMER_RESULT", requestId, text: result });
  } catch (error) {
    if (!controller.signal.aborted) {
      await send(tabId, frameId, { type: "GRAMMER_ERROR", requestId, error: error.message }).catch(() => {});
    }
  } finally {
    const key = frameKey(tabId, frameId);
    if (pending.get(key)?.requestId === requestId) pending.delete(key);
  }
}

async function runAction(action, tab, requestedFrameId) {
  if (!actions.has(action)) throw new Error("Unknown action.");
  if (!tab?.id) throw new Error("Open a webpage and select some text first.");
  let frames;
  try {
    frames = await chrome.scripting.executeScript({
      target: requestedFrameId === undefined ? { tabId: tab.id, allFrames: true } : { tabId: tab.id, frameIds: [requestedFrameId] },
      files: ["content.js"],
    });
  } catch {
    throw new Error("Chrome blocks access to this page or frame. Try a regular webpage; Chrome pages, the Web Store, and built-in PDF viewers are restricted.");
  }
  const candidates = frames.filter((frame) => frame.result?.selected);
  const target = candidates.find((frame) => frame.result.focused) ?? candidates[0] ?? frames.find((frame) => frame.result?.focused) ?? frames.find((frame) => frame.frameId === 0) ?? frames[0];
  if (!target) throw new Error("This frame is not accessible. Select text in the main page and try again.");
  const frameId = target.frameId;
  const id = frameKey(tab.id, frameId);
  pending.get(id)?.controller.abort();
  const requestId = crypto.randomUUID();
  const captured = await send(tab.id, frameId, { type: "GRAMMER_CAPTURE", action, requestId });
  if (!captured?.ok) return { ok: true }; // The in-page panel explains how to recover.
  if (action === "fix-grammar") {
    const controller = new AbortController();
    pending.set(id, { requestId, controller });
    void completeGrammar(tab.id, frameId, requestId, captured.text, controller);
  }
  return { ok: true };
}

async function reportCommandError(tabId, error) {
  if (!tabId) return;
  await chrome.action.setBadgeText({ tabId, text: "!" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#A6323D" });
  await chrome.action.setTitle({ tabId, title: `Grammer: ${error.message}` });
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (actions.has(command)) {
    void (async () => {
      const current = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      await chrome.action.setBadgeText({ tabId: current?.id, text: "" });
      await runAction(command, current);
    })().catch((error) => reportCommandError(tab?.id, error).catch(() => {}));
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (actions.has(info.menuItemId)) {
    void runAction(info.menuItemId, tab, info.frameId).catch((error) => reportCommandError(tab?.id, error).catch(() => {}));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [key, request] of pending) {
    if (key.startsWith(`${tabId}:`)) { request.controller.abort(); pending.delete(key); }
  }
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") return;
  if (message.type === "GRAMMER_CANCEL" && sender.tab) {
    const key = frameKey(sender.tab.id, sender.frameId ?? 0);
    const request = pending.get(key);
    if (request?.requestId === message.requestId) { request.controller.abort(); pending.delete(key); }
    respond({ ok: true });
    return;
  }
  if (message.type === "GRAMMER_SETTINGS") {
    void chrome.runtime.openOptionsPage();
    respond({ ok: true });
    return;
  }
  if (!trustedPages.has(sender.url)) return;
  if (message.type === "GRAMMER_TEST") {
    void (async () => {
      await storageReady;
      const settings = await loadSettings();
      if (!await chrome.permissions.contains({ origins: [API_PERMISSION] })) {
        throw new Error("Save & connect first to grant access to Gemini.");
      }
      const key = await loadCredential();
      await correctGrammar("This sentence is already correct.", settings, key);
      return { ok: true };
    })().then(respond, (error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "GRAMMER_RUN") {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
        await chrome.action.setTitle({ tabId: tab.id, title: "Grammer" });
      }
      return runAction(message.action, tab);
    })().then(respond, (error) => respond({ ok: false, error: error.message }));
    return true;
  }
});
