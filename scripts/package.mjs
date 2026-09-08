import { cp, mkdir, readdir, rm, readFile, utimes, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
execFileSync(process.execPath, [path.join(root, "scripts/check.mjs")], { stdio: "inherit" });
const { version } = JSON.parse(await readFile(path.join(root, "extension/manifest.json"), "utf8"));
const stage = path.join(root, "dist/grammer");
const archive = path.join(root, `dist/grammer-${version}.zip`);
await mkdir(path.join(root, "dist"), { recursive: true });
await rm(stage, { recursive: true, force: true });
await rm(archive, { force: true });
await cp(path.join(root, "extension"), stage, { recursive: true });
for (const file of ["LICENSE", "PRIVACY.md"]) await cp(path.join(root, file), path.join(stage, file));
async function collect(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await collect(file));
    else paths.push(path.relative(stage, file));
  }
  return paths;
}
const files = (await collect(stage)).sort();
const epoch = new Date("2026-01-01T00:00:00Z");
for (const file of files) await utimes(path.join(stage, file), epoch, epoch);
execFileSync("zip", ["-X", "-q", archive, ...files], { cwd: stage, env: { ...process.env, TZ: "UTC" } });
const hash = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(`${archive}.sha256`, `${hash}  ${path.basename(archive)}\n`);
console.log(`Packaged ${path.relative(root, archive)} (${files.length} files).`);
