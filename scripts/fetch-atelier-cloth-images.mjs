#!/usr/bin/env node
/**
 * Pull the atelier cloth swatches into public/atelier/cloth/ as resized WebP files, through Jetpack's
 * image CDN (the store answers plain requests with a bot challenge).
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/fetch-atelier-cloth-images.mjs research/nyoni/atelier-cloths.json public/atelier/cloth
 */
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const [, , jsonPath, outDir] = process.argv;
const { cloths } = JSON.parse(await readFile(jsonPath, "utf8"));
await mkdir(outDir, { recursive: true });
let saved = 0;
for (const cloth of cloths) {
  if (!cloth.image) continue;
  const origin = new URL(cloth.image);
  const cdn = `https://i0.wp.com/${origin.host}${origin.pathname}?w=1200&quality=85`;
  const target = path.join(outDir, `${cloth.code}.webp`);
  try {
    const response = await fetch(cdn);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    await sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(target);
    saved += 1;
    console.log(`saved ${cloth.code}.webp (${meta.width}x${meta.height})`);
  } catch (error) {
    console.warn(`skipped ${cloth.code}: ${error.message}`);
  }
}
console.log(`${saved} of ${cloths.length} swatches saved`);
