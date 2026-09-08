import { readFile, readdir, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..", "extension");
execFileSync(process.execPath, [path.join(import.meta.dirname, "docs.mjs"), "--check"], { stdio: "pipe" });
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version);
assert.ok(!manifest.host_permissions, "Use opt-in provider permissions, never required host access.");
assert.deepEqual(manifest.optional_host_permissions, ["https://generativelanguage.googleapis.com/*"], "The only optional API destination must be Gemini.");
assert.ok(!manifest.content_scripts, "Scripts must be injected on user action.");
assert.ok(!manifest.externally_connectable, "Webpages must not send extension messages.");
for (const file of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) await access(path.join(root, file));
for (const file of await files(root)) {
  if (file.endsWith(".js")) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  if (file.endsWith(".html")) {
    const html = await readFile(file, "utf8");
    assert.ok(!/\son\w+\s*=/i.test(html), `Inline event handler in ${file}`);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `Inline script in ${file}`);
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#|mailto:)/.test(ref)) continue;
      await access(path.resolve(path.dirname(file), ref.split("#")[0]));
    }
  }
}
console.log("Manifest, local assets, CSP-compatible HTML, and JavaScript syntax passed.");
