/**
 * Serves the Expo web export for the hosted preview.
 *
 * `expo export --platform web` with `output: "static"` writes one HTML file per route, so a plain
 * static server needs two fallbacks: `/atelier` has to resolve to `atelier.html`, and a dynamic
 * route such as `/product/nyoni-oxford` has to resolve to the single `[productId].html` the export
 * produced. Everything else is served as it is, with long caching for the fingerprinted bundles.
 */

import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

/** Resolve a request path to a file inside the export, or null when nothing matches. */
function resolve(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath.split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
  const target = path.join(ROOT, clean);
  if (!target.startsWith(ROOT)) return null;

  if (existsSync(target) && statSync(target).isFile()) return target;
  if (existsSync(`${target}.html`)) return `${target}.html`;

  const index = path.join(target, "index.html");
  if (existsSync(index)) return index;

  // /product/anything was exported once, as /product/[productId].html.
  const directory = path.dirname(target);
  if (existsSync(directory)) {
    const dynamic = readdirSync(directory).find((name) => name.startsWith("[") && name.endsWith("].html"));
    if (dynamic) return path.join(directory, dynamic);
  }

  return null;
}

/** The router's own not-found screen, served with a real 404 rather than a cheerful 200. */
function notFound() {
  const page = path.join(ROOT, "+not-found.html");
  return existsSync(page) ? page : null;
}

createServer((request, response) => {
  const found = resolve(request.url ?? "/");
  const file = found ?? notFound();
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }

  const status = found ? 200 : 404;
  const extension = path.extname(file);
  const immutable = file.includes(`${path.sep}_expo${path.sep}`) || extension === ".webp";
  response.writeHead(status, {
    "content-type": TYPES[extension] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    // A preview build of an unreleased app has no business being indexed.
    "x-robots-tag": "noindex, nofollow",
  });
  createReadStream(file).pipe(response);
}).listen(PORT, () => {
  console.log(`Nyoni Circle preview on :${PORT}`);
});
