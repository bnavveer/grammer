import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = await readFile(path.join(root, "tests/fixtures/editor.html"));
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const profile = await mkdtemp(path.join(tmpdir(), "grammer-smoke-"));
const extension = path.join(root, "extension");
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: false,
    handleSIGINT: false, handleSIGTERM: false,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1200, height: 920 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator("#draft").evaluate((element) => { element.focus(); element.select(); });
  console.log("Isolated Chromium opened with the unmodified extension. Try the real keyboard shortcuts and toolbar. Ctrl+C stops it and deletes the temporary profile.");
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
    context.once("close", resolve);
  });
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
