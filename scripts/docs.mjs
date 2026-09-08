import { readFile, writeFile } from "node:fs/promises";

// This intentionally small renderer handles only the headings, paragraphs, and
// inline markup in our own privacy policy. It is a build tool, not a runtime parser.
const source = await readFile(new URL("../PRIVACY.md", import.meta.url), "utf8");
function inline(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace("[SECURITY.md](SECURITY.md)", '<a href="help.html#security">the security reporting guidance</a>');
}
const body = source.trim().split(/\n\n+/).map((block) => {
  if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
  if (block.startsWith("# ")) return `<h1>${inline(block.slice(2))}</h1>`;
  return `<p>${inline(block.replaceAll("\n", " "))}</p>`;
}).join("\n");
const html = `<!doctype html>
<!-- Generated from PRIVACY.md by scripts/docs.mjs. -->
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Grammer — Privacy</title><link rel="stylesheet" href="ui.css"></head>
<body><div class="options document">
<header class="topbar"><div class="brand"><img src="icons/mark.svg" alt="">Grammer</div><a href="options.html">Settings</a></header>
<main class="workspace">${body}</main>
<footer class="page-footer"><span>Grammer · MIT licensed</span><a href="help.html">How to use</a></footer>
</div></body>
</html>
`;
const output = new URL("../extension/privacy.html", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== html) throw new Error("Privacy page is out of date. Run npm run docs.");
} else {
  await writeFile(output, html);
  console.log("Generated extension/privacy.html from PRIVACY.md.");
}
