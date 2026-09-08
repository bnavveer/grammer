import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../tests/fixtures/editor.html", import.meta.url));
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
server.listen(4173, "127.0.0.1", () => console.log("Grammer playground: http://127.0.0.1:4173 (Ctrl+C to stop)"));
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
