#!/usr/bin/env node
/**
 * Pull the collection's product photos into public/collection/ as resized WebP files.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/fetch-collection-images.mjs
 *
 * The store's own host answers plain requests with a bot challenge, so the photos are fetched
 * through Jetpack's public image CDN (i0.wp.com), which reads them from the store server-side.
 * Reads the remote `image` URLs in convex/shared/collection.ts; run `build-collection.mjs --local`
 * afterwards to point the collection at the saved files.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const COLLECTION = path.resolve("convex/shared/collection.ts");
const OUT = path.resolve("public/collection");
const MAX_WIDTH = 1400;

const source = await readFile(COLLECTION, "utf8");
const pieces = [...source.matchAll(/key: "([^"]+)",[\s\S]*?image: "([^"]+)"/g)].map((m) => ({
  key: m[1],
  image: m[2],
}));
await mkdir(OUT, { recursive: true });

let saved = 0;
for (const piece of pieces) {
  if (!/^https?:/.test(piece.image)) continue;
  const target = path.join(OUT, `${piece.key}.webp`);
  const origin = new URL(piece.image);
  const cdn = `https://i0.wp.com/${origin.host}${origin.pathname}?w=${MAX_WIDTH}&quality=85`;
  try {
    const response = await fetch(cdn);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toFile(target);
    saved += 1;
    console.log(`saved ${piece.key}.webp`);
  } catch (error) {
    console.warn(`skipped ${piece.key}: ${error.message}`);
  }
}
console.log(`${saved} of ${pieces.length} photos saved to ${path.relative(process.cwd(), OUT)}.`);
