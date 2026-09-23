#!/usr/bin/env node
/**
 * Measure each capsule piece's real colour from its photograph.
 *
 *   node scripts/measure-collection-colours.mjs
 *
 * Colour words carry one hex each, so five different greys all record `#7D7B76` and nothing that
 * matches on shade can tell them apart. This reads the pixels instead and writes
 * research/nyoni/collection-colours.json, which `build-collection.mjs --local` prefers over the
 * word's hex. Run it after the photos are in public/collection/, then rebuild.
 *
 * A cut-out with an alpha channel is masked by transparency. An opaque product shot is masked by
 * dropping the near-white sweep of studio background, and only the middle of the frame is read, so
 * a model's face and hands contribute far less than the cloth.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const COLLECTION = path.resolve("convex/shared/collection.ts");
const PHOTOS = path.resolve("public/collection");
const TARGET = path.resolve("research/nyoni/collection-colours.json");

/** 32 levels per channel: enough to separate navy from black, coarse enough to merge shading. */
const QUANTISE_SHIFT = 3;
/** Anything this pale and this grey is the studio sweep, not the garment. */
const BACKGROUND_MIN = 232;
/** Read the middle of the frame: product shots put the garment there and the face above it. */
const CENTRE = { left: 0.18, top: 0.22, width: 0.64, height: 0.62 };
const SAMPLE_EDGE = 220;
/** Candidate shades kept per piece, narrowed to three when the capsule is built. */
const CANDIDATES = 10;

const source = await readFile(COLLECTION, "utf8");
const keys = [...source.matchAll(/key: "([^"]+)",/g)].map((m) => m[1]);
const files = await readdir(PHOTOS);

function isBackground(r, g, b, alpha) {
  if (alpha !== undefined && alpha < 200) return true;
  // Near-white and near-neutral: the sweep. A genuine ivory garment is warmer and less uniform,
  // and enough of its shadow survives this to keep the bin honest.
  const min = Math.min(r, g, b);
  const spread = Math.max(r, g, b) - min;
  return min >= BACKGROUND_MIN && spread <= 12;
}

async function measure(file) {
  const { width, height, hasAlpha } = await sharp(file).metadata();
  if (!width || !height) return null;

  const region = {
    left: Math.round(width * CENTRE.left),
    top: Math.round(height * CENTRE.top),
    width: Math.max(1, Math.round(width * CENTRE.width)),
    height: Math.max(1, Math.round(height * CENTRE.height)),
  };
  const channels = hasAlpha ? 4 : 3;
  // Trim the uniform border first: some shots sit on white, others on a dark surround, and either
  // way the border is not the garment. Trimming can fail on a photo with no uniform edge at all.
  let pipeline = sharp(file).rotate();
  try {
    const trimmed = await sharp(file).rotate().trim({ threshold: 12 }).toBuffer();
    pipeline = sharp(trimmed);
  } catch {
    pipeline = sharp(file).rotate().extract(region);
  }
  const { data, info } = await pipeline
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map();
  for (let offset = 0; offset + channels <= data.length; offset += info.channels) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = info.channels === 4 ? data[offset + 3] : undefined;
    if (isBackground(r, g, b, alpha)) continue;
    const key = ((r >> QUANTISE_SHIFT) << 10) | ((g >> QUANTISE_SHIFT) << 5) | (b >> QUANTISE_SHIFT);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  if (bins.size === 0) return null;

  // Keep a wide field of candidates: a copper print on a black ground has black in every one of the
  // top three bins, and the build step needs a copper one to choose from when it orders by name.
  return [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, CANDIDATES)
    .map((bin) => toHex(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count));
}

function toHex(r, g, b) {
  const channel = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

const measured = {};
let missing = 0;
for (const key of keys) {
  const file = files.find((name) => name.startsWith(`${key}.`) && /\.(png|webp|jpe?g)$/i.test(name));
  if (!file) {
    missing += 1;
    continue;
  }
  const hex = await measure(path.join(PHOTOS, file));
  if (hex) measured[key] = hex;
}

await writeFile(TARGET, `${JSON.stringify(measured, null, 2)}\n`);
console.log(
  `Measured ${Object.keys(measured).length} of ${keys.length} pieces` +
    `${missing ? `, ${missing} with no photo on disk` : ""} -> ${path.relative(process.cwd(), TARGET)}`,
);
console.log("Run `node scripts/build-collection.mjs --local` so the capsule carries them.");
