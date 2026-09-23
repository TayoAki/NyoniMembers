#!/usr/bin/env node
/**
 * Give every split suit part a photograph of its own.
 *
 *   OPENAI_API_KEY=sk-… node scripts/cut-collection-parts.mjs            # all parts missing a cutout
 *   AI_GATEWAY_API_KEY=… node scripts/cut-collection-parts.mjs           # through the Vercel AI Gateway
 *   … node scripts/cut-collection-parts.mjs --force                      # redo parts already cut
 *   … node scripts/cut-collection-parts.mjs --only nyoni-nathan-vest     # one piece
 *
 * A suit product has one photograph: the whole suit, usually on a model. Split into a jacket, a
 * pair of trousers and a waistcoat, the three pieces would otherwise share that one image and the
 * wardrobe would show the same picture three times. This isolates each garment from it, the same
 * way convex/ai/openai.ts isolates a garment a member photographs, and writes the result over the
 * placeholder in public/collection/.
 *
 * Costs roughly $0.03 and 30–50 s per part, so about $0.40 for a capsule of five suits. Run it
 * after `build-collection.mjs --local`, then run that again so nothing else changes.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const COLLECTION = path.resolve("convex/shared/collection.ts");
const OUT = path.resolve("public/collection");
const MODEL = "gpt-image-2";
const MAX_WIDTH = 1400;

/** What to ask for, per part. The suit's own colour and cloth come from the piece's description. */
const PART_BRIEF = {
  jacket: "the suit jacket only — its sleeves, lapels, buttons and vents, with no trousers and no waistcoat",
  trousers: "the suit trousers only — both legs full length, with no jacket, no waistcoat and no shoes",
  vest: "the waistcoat only — its full front and buttons, with no jacket, no shirt and no trousers",
};

const directKey = process.env.OPENAI_API_KEY;
const gatewayKey = process.env.AI_GATEWAY_API_KEY;
if (!directKey && !gatewayKey) {
  console.error("Set OPENAI_API_KEY or AI_GATEWAY_API_KEY. Nothing was changed.");
  process.exit(1);
}
const openai = new OpenAI({
  apiKey: directKey ?? gatewayKey,
  ...(directKey ? {} : { baseURL: "https://ai-gateway.vercel.sh/v1" }),
  maxRetries: 1,
  timeout: 5 * 60 * 1000,
});
const modelId = directKey ? MODEL : `openai/${MODEL}`;

const source = await readFile(COLLECTION, "utf8");
const parts = [...source.matchAll(/key: "([^"]+)",[\s\S]*?partOf: \{ name: "([^"]+)"[\s\S]*?name: "([^"]+)"/g)]
  .map(([, key, suit, name]) => ({ key, suit, name, part: key.split("-").at(-1) }))
  .filter((piece) => PART_BRIEF[piece.part])
  .filter((piece) => !only || piece.key === only);

if (parts.length === 0) {
  console.error("No split parts found. Run scripts/build-collection.mjs first.");
  process.exit(1);
}

/** The placeholder is the suit's own photo, so every part of one suit starts out byte-identical. */
async function isPlaceholder(file, siblings) {
  const mine = await readFile(file).catch(() => null);
  if (!mine) return true;
  for (const other of siblings) {
    if (other === file) continue;
    const theirs = await readFile(other).catch(() => null);
    if (theirs && theirs.equals(mine)) return true;
  }
  return false;
}

let cut = 0;
let skipped = 0;
for (const piece of parts) {
  const target = path.join(OUT, `${piece.key}.webp`);
  const siblings = parts.filter((p) => p.suit === piece.suit).map((p) => path.join(OUT, `${p.key}.webp`));
  if (!force && !(await isPlaceholder(target, siblings))) {
    skipped += 1;
    continue;
  }
  try {
    const photo = await readFile(target);
    const response = await openai.images.edit({
      model: modelId,
      image: [await toFile(photo, "suit.webp", { type: "image/webp" })],
      prompt: [
        `Isolate ONLY this item from the photo of the ${piece.suit}: ${PART_BRIEF[piece.part]}.`,
        "",
        "Render it as a clean e-commerce flat-lay product photo: the item alone, neatly laid out, lightly smoothed, fully visible, centred in frame, soft even studio lighting, plain white background.",
        "",
        "Preserve the item exactly as it appears in the photo — the same colour, cloth, weave, stitching, buttons, lapels, pockets, hems, lining and proportions. Do not add, remove or restyle anything. Do not add any brand labels, tags or logos that are not visible in the photo. Do not include any part of a person, any other garment, or any background object.",
      ].join("\n"),
      size: "1024x1536",
      quality: "medium",
      output_format: "png",
      // gpt-image-2 rejects input_fidelity — never send it.
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("the model returned no image");
    await sharp(Buffer.from(b64, "base64"))
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(target);
    cut += 1;
    console.log(`cut ${piece.key} (${piece.name})`);
  } catch (error) {
    console.warn(`failed ${piece.key}: ${error.message}`);
  }
}

console.log(`${cut} cut, ${skipped} already had a photo of their own, out of ${parts.length} parts.`);
if (cut > 0) console.log("Run `node scripts/build-collection.mjs --local` so the capsule points at them.");
