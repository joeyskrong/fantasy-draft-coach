import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT || 4173);
const assets = join(root, "assets");
const jsFallback = readdirSync(assets).find((f) => f.endsWith(".js"));
const cssFallback = readdirSync(assets).find((f) => f.endsWith(".css"));

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean === "/" || clean === "/index.html") return join(root, "index.html");
  if (clean.startsWith("/assets/index-") && clean.endsWith(".js") && jsFallback) {
    const hashed = join(root, clean);
    return existsSync(hashed) ? hashed : join(assets, jsFallback);
  }
  if (clean.startsWith("/assets/index-") && clean.endsWith(".css") && cssFallback) {
    const hashed = join(root, clean);
    return existsSync(hashed) ? hashed : join(assets, cssFallback);
  }
  const next = normalize(join(root, clean.replace(/^\/+/, "")));
  if (!next.startsWith(root)) return null;
  return next;
}

createServer((req, res) => {
  const file = resolve(req.url || "/");
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const html = file.endsWith("index.html");
  res.writeHead(200, {
    "content-type": types[extname(file)] || "application/octet-stream",
    "cache-control": html ? "no-store" : "public, max-age=60",
    "access-control-allow-origin": "*",
  });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`preview http://0.0.0.0:${port}/`);
});
