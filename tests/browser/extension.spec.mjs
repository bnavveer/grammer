import { test, expect, chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let context, worker, options, page, server, temporary, origin, extensionId;
let calls = [];
let responseText = "Yesterday we were talking about the new project. There are a few things we need to fix before it's ready.";
let responseStatus = 200;
let delay = 0;
const root = path.resolve(import.meta.dirname, "../..");

test.beforeAll(async () => {
  const fixture = await readFile(path.join(root, "tests/fixtures/editor.html"));
  server = createServer(async (request, response) => {
    if (request.url === "/v1beta/models/gemini-3.5-flash-lite:generateContent") {
      let body = "";
      for await (const chunk of request) body += chunk;
      calls.push({ body: JSON.parse(body), apiKey: request.headers["x-goog-api-key"], referer: request.headers.referer });
      const status = responseStatus;
      const text = responseText;
      setTimeout(() => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(status === 200 ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] } : { error: { message: "provider-echo-must-never-display" } }));
      }, delay);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(fixture);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  temporary = await mkdtemp(path.join(tmpdir(), "grammer-test-"));
  const extensionPath = path.join(temporary, "extension");
  await cp(path.join(root, "extension"), extensionPath, { recursive: true });
  const manifestPath = path.join(extensionPath, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  // Only the temporary test copy has a required loopback permission. This lets
  // automation exercise injection without pretending to generate a trusted OS shortcut.
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  // Only the temporary test copy redirects Gemini to a loopback fake. Production
  // has a fixed Google destination and no configurable URL.
  const settingsPath = path.join(extensionPath, "lib/settings.js");
  await writeFile(settingsPath, (await readFile(settingsPath, "utf8")).replace("https://generativelanguage.googleapis.com/v1beta", `${origin}/v1beta`));
  context = await chromium.launchPersistentContext(path.join(temporary, "profile"), {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: { width: 1280, height: 1000 },
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  extensionId = worker.url().split("/")[2];
});

test.beforeEach(async () => {
  calls = []; responseStatus = 200; delay = 0;
  responseText = "Yesterday we were talking about the new project. There are a few things we need to fix before it's ready.";
  await worker.evaluate(async (baseUrl) => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    await chrome.storage.local.set({ settings: { model: "gemini-3.5-flash-lite", dialect: "preserve" } });
    await chrome.storage.session.set({ credential: { baseUrl, key: "synthetic-test-key" } });
  }, `${origin}/v1beta`);
  options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator("#save")).toBeEnabled();
  page = await context.newPage();
  await page.goto(origin);
});

test.afterEach(async () => { await page?.close(); await options?.close(); });
test.afterAll(async () => {
  await context?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

async function selectField(id, start = 0, end) {
  await page.locator(`#${id}`).evaluate((element, selection) => {
    element.focus(); element.setSelectionRange(selection.start, selection.end ?? element.value.length);
  }, { start, end });
}

async function selectContents(selector) {
  await page.locator(selector).evaluate((element) => {
    element.focus();
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
}

async function run(action, targetPage = page) {
  await targetPage.bringToFront();
  const result = await options.evaluate((action) => chrome.runtime.sendMessage({ type: "GRAMMER_RUN", action }), action);
  expect(result).toEqual({ ok: true });
}

test("loads real MV3 worker, toolbar, settings, and registered shortcuts", async () => {
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  expect(commands.map((command) => command.name)).toEqual(expect.arrayContaining(["fix-grammar", "plain-text"]));
  await expect(options.getByRole("heading", { name: "Connect Gemini." })).toBeVisible();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#connection-label")).toContainText("Gemini 3.5 Flash-Lite");
  await expect(popup.getByRole("button", { name: /Remove formatting/ })).toBeVisible();
  await mkdir(path.join(root, "test-results/screenshots"), { recursive: true });
  await popup.locator("body").screenshot({ path: path.join(root, "test-results/screenshots/popup.png") });
  await options.screenshot({ path: path.join(root, "test-results/screenshots/settings.png"), fullPage: true });
  await popup.close();
});

test("grammar sends only selected text and replaces after review with native Undo", async () => {
  const original = await page.locator("#draft").inputValue();
  await selectField("draft");
  await run("fix-grammar");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(responseText);
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body.contents[0].parts[0].text)).toEqual({ text: original });
  expect(calls[0].apiKey).toBe("synthetic-test-key");
  expect(calls[0].referer).toBeUndefined();
  await expect(page.locator("#draft")).toHaveValue(original);
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator("#draft")).toHaveValue(responseText);
  await page.locator("#draft").focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(page.locator("#draft")).toHaveValue(original);
});

test("grammar can replace a partial input selection without touching its neighbors", async () => {
  responseText = "I have an idea";
  await selectField("single", 7, 19);
  await run("fix-grammar");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(responseText);
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator("#single")).toHaveValue("Before I have an idea after.");
});

test("formatting cleanup strips inline fonts, colors, bold, and links without network", async () => {
  await selectContents("#rich");
  const original = await page.locator("#rich").innerText();
  await run("plain-text");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(original);
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator("#rich")).toHaveText(original);
  expect(await page.locator("#rich a, #rich b, #rich [style]").count()).toBe(0);
  expect(calls).toHaveLength(0);
});

test("partial cleanup preserves formatting and text outside the selection", async () => {
  await page.locator("#rich b").evaluate((element) => {
    element.closest('[contenteditable]').focus();
    const range = document.createRange(); range.setStart(element.firstChild, 6); range.setEnd(element.firstChild, 11);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await run("plain-text");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue("words");
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator("#rich")).toHaveText("Keep this. These words is very colorful. A link to keep as words. Keep that.");
  await expect(page.locator("#rich a")).toHaveText("A link to keep as words.");
  const styles = await page.locator("#rich").evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.includes("words")) return { color: getComputedStyle(node.parentElement).color, weight: getComputedStyle(node.parentElement).fontWeight };
    }
  });
  expect(styles).toEqual({ color: "rgb(19, 42, 74)", weight: "400" });
});

test("selected CSS-styled text returns to its editor's default style", async () => {
  await selectContents("#class-rich .inline-style");
  await run("plain-text");
  await page.getByRole("button", { name: "Replace selection" }).click();
  expect(await page.locator("#class-rich .inline-style").count()).toBe(0);
  await expect(page.locator("#class-rich")).toHaveText("Before colorful words after.");
});

test("read-only selections offer copying and never replacement", async () => {
  await selectContents("#readonly");
  await run("plain-text");
  await expect(page.getByRole("button", { name: "Replace selection" })).toBeDisabled();
  await page.getByRole("button", { name: "Copy plain text" }).click();
  await expect(page.locator('[data-grammer="panel"] #status')).toHaveText("Copied as plain text.");
  expect(calls).toHaveLength(0);
});

test("selection changes cannot overwrite newer input", async () => {
  delay = 100;
  await selectField("draft");
  await run("fix-grammar");
  await page.locator("#draft").fill("Newer writing must survive.");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(responseText);
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator('[data-grammer="panel"] #status')).toContainText("original editor changed");
  await expect(page.locator("#draft")).toHaveValue("Newer writing must survive.");
});

test("changed rich-text DOM is protected from stale replacements", async () => {
  await selectContents("#rich");
  await run("plain-text");
  await page.locator("#rich").evaluate((element) => element.append(" NEW"));
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator('[data-grammer="panel"] #status')).toContainText("original editor changed");
  await expect(page.locator("#rich")).toContainText(" NEW");
});

test("password fields and empty selections never reach the provider", async () => {
  await selectField("password");
  await run("fix-grammar");
  await expect(page.locator('[data-grammer="panel"] #status')).toContainText("Password fields are excluded");
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.locator("h1").click();
  await page.evaluate(() => getSelection().removeAllRanges());
  await run("fix-grammar");
  await expect(page.locator('[data-grammer="panel"] #status')).toContainText("Select some text");
  expect(calls).toHaveLength(0);
});

test("model output is always literal text, including HTML-looking content", async () => {
  responseText = '<img src=x onerror="window.grammerXss=true">';
  await selectField("draft");
  await run("fix-grammar");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(responseText);
  await page.getByRole("button", { name: "Replace selection" }).click();
  await expect(page.locator("#draft")).toHaveValue(responseText);
  expect(await page.evaluate(() => window.grammerXss)).toBeUndefined();
});

test("provider errors are actionable and leave the original alone", async () => {
  responseStatus = 401;
  const original = await page.locator("#draft").inputValue();
  await selectField("draft");
  await run("fix-grammar");
  await expect(page.locator('[data-grammer="panel"] #status')).toContainText("API key was rejected");
  await expect(page.locator("#draft")).toHaveValue(original);
  await expect(page.getByRole("button", { name: "Open Settings" })).toBeVisible();
  expect(await page.locator('[data-grammer="panel"]').textContent()).not.toContain("provider-echo");
});

test("closing a preview cancels it and later responses do not reopen it", async () => {
  delay = 300;
  await selectField("draft");
  await run("fix-grammar");
  await expect.poll(() => calls.length).toBe(1);
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(page.locator('[data-grammer="panel"]')).toHaveCount(0);
  // Synchronize with the fake server's response without relying on a UI animation.
  await new Promise((resolve) => setTimeout(resolve, 400));
  await expect(page.locator('[data-grammer="panel"]')).toHaveCount(0);
});

test("same-origin iframe selections stay in the right frame", async () => {
  const frame = page.frames().find((frame) => frame.parentFrame());
  await frame.locator("#framed").evaluate((element) => { element.focus(); element.select(); });
  await run("plain-text");
  await expect(frame.getByRole("textbox", { name: "Edited text" })).toHaveValue("we was in a frame.");
  await expect(page.locator('[data-grammer="panel"]')).toHaveCount(0);
});

test("settings retain keys in session by default, support explicit persistence, and test saved provider", async () => {
  await options.locator("#api-key").fill("changed-synthetic-test-key");
  await options.locator("#save").click();
  await expect(options.locator("#form-status")).toContainText("Settings saved");
  const stored = await worker.evaluate(async () => ({ local: await chrome.storage.local.get("credential"), session: await chrome.storage.session.get("credential") }));
  expect(stored.local.credential).toBeUndefined();
  expect(stored.session.credential.key).toBe("changed-synthetic-test-key");
  await options.locator("#remember").check();
  await options.locator("#save").click();
  await expect(options.locator("#form-status")).toContainText("Settings saved");
  expect(await worker.evaluate(async () => (await chrome.storage.local.get("credential")).credential.key)).toBe("changed-synthetic-test-key");
  await options.locator("#test").click();
  await expect(options.locator("#form-status")).toContainText("Connected.");
  expect(JSON.parse(calls[0].body.contents[0].parts[0].text).text).toBe("This sentence is already correct.");
  await options.locator("#forget-key").click();
  await expect(options.locator("#form-status")).toContainText("API key removed");
  expect(await worker.evaluate(async () => (await chrome.storage.local.get("credential")).credential)).toBeUndefined();
});

test("settings remain usable on narrow screens", async () => {
  await options.setViewportSize({ width: 390, height: 844 });
  await expect(options.locator("#save")).toBeVisible();
  expect(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("multiline rich text preserves its visible paragraph breaks", async () => {
  await selectContents("#paragraphs");
  const selected = await page.evaluate(() => getSelection().toString());
  await run("plain-text");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(selected);
  await page.getByRole("button", { name: "Replace selection" }).click();
  expect(await page.locator("#paragraphs").innerText()).toBe(selected);
});

test("multiline model output preserves spacing and escapes HTML during rich-text insertion", async () => {
  responseText = 'First line.\n\n  <img src=x onerror="window.grammerXss=true">  Last line.';
  await selectContents("#paragraphs");
  await run("fix-grammar");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue(responseText);
  await page.getByRole("button", { name: "Replace selection" }).click();
  expect(await page.locator("#paragraphs").innerText()).toBe(responseText);
  expect(await page.locator("#paragraphs img").count()).toBe(0);
  expect(await page.evaluate(() => window.grammerXss)).toBeUndefined();
});

test("focused iframe wins over a stale selection in the main document", async () => {
  await selectContents("#readonly");
  const frame = page.frames().find((frame) => frame.parentFrame());
  await frame.locator("#framed").evaluate((element) => { element.focus(); element.select(); });
  await run("plain-text");
  await expect(frame.getByRole("textbox", { name: "Edited text" })).toHaveValue("we was in a frame.");
  await expect(page.locator('[data-grammer="panel"]')).toHaveCount(0);
});

test("content scripts cannot read the API key from either storage area", async () => {
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url + "/").id, origin);
  const results = await worker.evaluate(async (tabId) => chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const result = {};
      for (const name of ["local", "session"]) {
        try { result[name] = await chrome.storage[name].get("credential"); }
        catch { result[name] = "blocked"; }
      }
      return result;
    },
  }), tabId);
  expect(results[0].result).toEqual({ local: "blocked", session: "blocked" });
});

test("a second request replaces the first preview without accepting its late result", async () => {
  delay = 500; responseText = "Old response must be ignored.";
  await selectField("draft");
  await run("fix-grammar");
  await expect.poll(() => calls.length).toBe(1);
  delay = 0; responseText = "New response.";
  await selectField("single");
  await run("fix-grammar");
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue("New response.");
  await new Promise((resolve) => setTimeout(resolve, 550));
  await expect(page.getByRole("textbox", { name: "Edited text" })).toHaveValue("New response.");
  await expect(page.locator('[data-grammer="panel"]')).toHaveCount(1);
});

test("local help and generated privacy policy load without missing assets", async () => {
  await options.goto(`chrome-extension://${extensionId}/help.html`);
  await expect(options.getByRole("heading", { name: "Connect Gemini" })).toBeVisible();
  await options.goto(`chrome-extension://${extensionId}/privacy.html`);
  await expect(options.getByRole("heading", { name: "Grammer privacy policy" })).toBeVisible();
});

test("both hotkeys can be changed in Chrome and settings refresh on return", async () => {
  const newPage = context.waitForEvent("page");
  await options.getByRole("button", { name: "Change keyboard shortcuts" }).click();
  const editor = await newPage;
  try {
    await editor.waitForURL("chrome://extensions/shortcuts");
    await expect(editor.locator("extensions-keyboard-shortcuts")).toContainText("Grammer");
    await expect(editor.locator("extensions-keyboard-shortcuts")).toContainText("Fix grammar in the selected text");
    await expect(editor.locator("extensions-keyboard-shortcuts")).toContainText("Remove formatting from the selected text");
    for (const [description, name, key] of [
      ["Fix grammar in the selected text", "fix-grammar", "U"],
      ["Remove formatting from the selected text", "plain-text", "Y"],
    ]) {
      await editor.getByRole("button", { name: `Edit shortcut ${description} for Grammer`, exact: true }).click();
      await editor.keyboard.press(`Alt+Shift+${key}`);
      await expect.poll(async () => (await worker.evaluate(() => chrome.commands.getAll())).find((command) => command.name === name)?.shortcut).toMatch(new RegExp(`${key}$`));
    }
    await options.bringToFront();
    await options.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(options.locator('[data-command="fix-grammar"]')).toContainText("U");
    await expect(options.locator('[data-command="plain-text"]')).toContainText("Y");
    await options.getByRole("button", { name: "Reset settings", exact: true }).click();
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    expect(commands.find((command) => command.name === "fix-grammar").shortcut).toMatch(/U$/);
    expect(commands.find((command) => command.name === "plain-text").shortcut).toMatch(/Y$/);
  } finally { await editor.close(); }
});
