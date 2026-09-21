#!/usr/bin/env node
/**
 * Turn the WooCommerce export from scripts/capture-nyoni.mjs into convex/shared/collection.ts, the
 * list of Nyoni pieces every member's wardrobe starts with.
 *
 *   node scripts/build-collection.mjs                 # remote image URLs (the seeder fetches from the store)
 *   node scripts/build-collection.mjs --download      # also save each image to public/collection/<key>.<ext>
 *   node scripts/build-collection.mjs --local         # use images already present in public/collection/ (no network)
 *   node scripts/build-collection.mjs --limit 40      # cap the number of pieces (default 50)
 *
 * The store's bot challenge blocks plain downloads; scripts/fetch-collection-images.mjs pulls the
 * photos through Firecrawl's browser into public/collection/, after which --local wires them up.
 *
 * Reads research/nyoni/woo-products.json. Category slugs map onto the app's wardrobe categories;
 * colours are read from the product name; everything else is a sensible default the concierge can
 * correct. Cloth-only "bespoke clothing" products, services and sale bundles are left out.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const download = args.includes("--download");
const local = args.includes("--local");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 50;

/** A balanced starter wardrobe rather than the newest fifty ties: caps per garment type (by subcategory). */
const TYPE_CAPS = {
  "two-piece suit": 4,
  "three-piece suit": 3,
  "double-breasted suit": 2,
  tuxedo: 3,
  suit: 1,
  "traditional set": 2,
  blazer: 4,
  overcoat: 2,
  sweatsuit: 1,
  sweater: 1,
  "short set": 0,
  "dress shirt": 4,
  shirt: 2,
  waistcoat: 1,
  "dress trousers": 3,
  loafers: 2,
  "dress shoes": 2,
  boots: 2,
  sneakers: 1,
  "neck tie": 3,
  "bow tie": 2,
  "pocket square": 3,
  cufflinks: 1,
  belt: 1,
  scarf: 1,
  socks: 0,
  "collar bar": 0,
  "tie pin": 0,
  "lapel pin": 0,
  "leather bag": 2,
  hat: 1,
};
/** Products that are not a wearable piece: WooCommerce variation rows and generic listings. */
const SKIP_NAMES = /^(variation #|custom suits?\b|rush fee)/i;

const SOURCE = path.resolve("research/nyoni/woo-products.json");
const TARGET = path.resolve("convex/shared/collection.ts");
const PUBLIC_DIR = path.resolve("public/collection");

/** WooCommerce category slug → [category, subcategory, formality, seasons]. Order matters: first match wins. */
const CATEGORY_MAP = [
  ["tuxedo", ["suit", "tuxedo", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["three-piece-suit", ["suit", "three-piece suit", "formal", ["autumn", "winter", "spring"]]],
  ["double-breasted", ["suit", "double-breasted suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["two-piece", ["suit", "two-piece suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["suits", ["suit", "suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["blazers", ["outerwear", "blazer", "smart-casual", ["spring", "autumn", "winter"]]],
  ["winter-coat", ["outerwear", "overcoat", "formal", ["autumn", "winter"]]],
  ["vest", ["top", "waistcoat", "formal", ["autumn", "winter", "spring"]]],
  ["dress-shirts", ["top", "dress shirt", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["casual-shirts", ["top", "shirt", "smart-casual", ["spring", "summer", "autumn"]]],
  ["sweater", ["top", "sweater", "smart-casual", ["autumn", "winter"]]],
  ["sweatsuit", ["top", "sweatsuit", "casual", ["autumn", "winter", "spring"]]],
  ["short-set", ["top", "short set", "casual", ["spring", "summer"]]],
  ["trousers", ["bottom", "dress trousers", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["traditional-wear", ["suit", "traditional set", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["dress-shoes", ["shoes", "dress shoes", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["loafers", ["shoes", "loafers", "smart-casual", ["spring", "summer", "autumn", "winter"]]],
  ["boots", ["shoes", "boots", "smart-casual", ["autumn", "winter", "spring"]]],
  ["sneakers", ["shoes", "sneakers", "casual", ["spring", "summer", "autumn"]]],
  ["pocket-squares", ["accessory", "pocket square", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["bow-tie", ["accessory", "bow tie", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["pre-tied-bow", ["accessory", "bow tie", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["neck-tie", ["accessory", "neck tie", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["cufflinks", ["accessory", "cufflinks", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["belts", ["accessory", "belt", "smart-casual", ["spring", "summer", "autumn", "winter"]]],
  ["collar-bar", ["accessory", "collar bar", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["tie-pins", ["accessory", "tie pin", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["lapel-pins", ["accessory", "lapel pin", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["scarves", ["accessory", "scarf", "smart-casual", ["autumn", "winter"]]],
  ["socks", ["accessory", "socks", "smart-casual", ["spring", "summer", "autumn", "winter"]]],
  ["hats", ["headwear", "hat", "smart-casual", ["spring", "summer", "autumn", "winter"]]],
  ["leather-goods", ["bag", "leather bag", "smart-casual", ["spring", "summer", "autumn", "winter"]]],
];

const SKIP_CATEGORIES = new Set(["bespoke-clothing", "uncategorized", "labor-day-sale", "measurement"]);

/** Colour words that appear in Nyoni product names, with a representative hex for the swatch. */
const COLOURS = [
  ["onyx", "black", "#141414"],
  ["black", "black", "#141414"],
  ["navy", "navy", "#1F2A44"],
  ["steel blue", "steel blue", "#4A6B8A"],
  ["azure", "azure", "#2F6FB0"],
  ["blue", "blue", "#3B6EA8"],
  ["light grey", "light grey", "#9A9A96"],
  ["grey", "grey", "#7D7B76"],
  ["gray", "grey", "#7D7B76"],
  ["charcoal", "charcoal", "#3A3A3A"],
  ["crimson", "crimson", "#A5122E"],
  ["bordeaux", "bordeaux", "#5E1B2A"],
  ["burgundy", "burgundy", "#5E1B2A"],
  ["maroon", "maroon", "#5E1B2A"],
  ["pinot noir", "wine", "#4A1F2D"],
  ["red", "red", "#9E1B2A"],
  ["fuchsia", "fuchsia", "#C2288A"],
  ["rosado", "light rose", "#E8C5C1"],
  ["rosé", "rosé", "#D9A5A8"],
  ["rose", "rosé", "#D9A5A8"],
  ["blush pink", "blush pink", "#E8C5C1"],
  ["pink", "pink", "#E8B7C0"],
  ["ochre", "ochre", "#C7791E"],
  ["orange", "orange", "#C7791E"],
  ["mint", "mint", "#9FC5B0"],
  ["eau de nil", "eau de nil", "#9FC5B0"],
  ["pine green", "pine green", "#2F5D46"],
  ["olive", "olive", "#5E6B3A"],
  ["green", "green", "#2F5D46"],
  ["yellow", "yellow", "#E0B42A"],
  ["beige", "beige", "#CDB58F"],
  ["brown", "brown", "#5A3A24"],
  ["white", "white", "#F7F5F0"],
  ["ivory", "ivory", "#F4EFE6"],
  ["silver", "silver", "#C0C0C0"],
  ["gold", "gold", "#B8925A"],
];

const PATTERNS = [
  "glen plaid",
  "glenn plaid",
  "glencheck",
  "check",
  "plaid",
  "sharkskin",
  "pinstripe",
  "stripe",
  "aztec",
  "floral",
  "geo",
  "paisley",
  "houndstooth",
];
const MATERIALS = ["cashmere", "linen", "silk", "velvet", "suede", "calfskin", "leather", "cotton", "wool"];

function classify(product) {
  for (const [slug, mapping] of CATEGORY_MAP) if (product.categories.includes(slug)) return mapping;
  return null;
}

function colourOf(text) {
  const lower = text.toLowerCase();
  const found = COLOURS.filter(([word]) => lower.includes(word));
  if (found.length === 0) return { primary: "unknown", secondary: [], hex: [] };
  const [, primary, hex] = found[0];
  const secondary = [
    ...new Set(
      found
        .slice(1)
        .map(([, name]) => name)
        .filter((name) => name !== primary),
    ),
  ].slice(0, 3);
  return { primary, secondary, hex: [hex] };
}

function firstMatch(text, words, fallback) {
  const lower = text.toLowerCase();
  return words.find((word) => lower.includes(word)) ?? fallback;
}

/** Store names carry stray dashes and the house prefix; the wardrobe shows the piece's own name. */
function cleanName(name) {
  return name
    .replace(/^[\s\u2013\u2014-]+/, "")
    .replace(/^Nyoni\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keyFor(product) {
  const slug = product.slug
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug.startsWith("nyoni-") ? slug : `nyoni-${slug}`;
}

function tsString(value) {
  return JSON.stringify(value);
}

async function main() {
  const products = JSON.parse(await readFile(SOURCE, "utf8"));
  const localFiles = local && existsSync(PUBLIC_DIR) ? await readdir(PUBLIC_DIR) : [];
  const pieces = [];
  const perCategory = {};
  for (const product of products) {
    if (!product.inStock || product.categories.some((slug) => SKIP_CATEGORIES.has(slug))) continue;
    const mapping = classify(product);
    if (!mapping || !product.images?.[0]?.src) continue;
    const [category, subcategory, formality, season] = mapping;
    if (SKIP_NAMES.test(product.name.trim())) continue;
    if ((perCategory[subcategory] ?? 0) >= (TYPE_CAPS[subcategory] ?? 2)) continue;
    const text = `${product.name} ${product.shortDescription ?? ""} ${product.description ?? ""}`;
    const key = keyFor(product);
    let image = product.images[0].src;
    if (local) {
      const file = localFiles.find((name) => name.startsWith(`${key}.`));
      if (!file) continue;
      image = `/collection/${file}`;
    }
    if (download) {
      await mkdir(PUBLIC_DIR, { recursive: true });
      const ext = (new URL(image).pathname.split(".").pop() || "jpg").toLowerCase();
      const response = await fetch(image);
      if (response.ok) {
        await writeFile(path.join(PUBLIC_DIR, `${key}.${ext}`), Buffer.from(await response.arrayBuffer()));
        image = `/collection/${key}.${ext}`;
      }
    }
    pieces.push({
      key,
      productUrl: product.permalink,
      priceUsd: product.priceUsd,
      image,
      attributes: {
        name: cleanName(product.name),
        category,
        subcategory,
        colours: colourOf(product.name),
        pattern: firstMatch(text, PATTERNS, "solid").replace("glenn plaid", "glen plaid"),
        material: firstMatch(text, MATERIALS, category === "shoes" ? "leather" : "wool"),
        season,
        formality,
        fit: category === "suit" || subcategory === "blazer" ? "slim" : undefined,
        brand: "Nyoni Couture",
        description: (product.shortDescription || product.description || product.name).slice(0, 240),
      },
    });
    perCategory[subcategory] = (perCategory[subcategory] ?? 0) + 1;
    if (pieces.length >= limit) break;
  }

  const body = pieces
    .map((piece) => {
      const a = piece.attributes;
      const optional = [a.fit ? `      fit: ${tsString(a.fit)},` : null].filter(Boolean);
      return `  {
    key: ${tsString(piece.key)},
    productUrl: ${tsString(piece.productUrl)},${piece.priceUsd !== undefined ? `\n    priceUsd: ${piece.priceUsd},` : ""}
    image: ${tsString(piece.image)},
    attributes: {
      name: ${tsString(a.name)},
      category: ${tsString(a.category)},
      subcategory: ${tsString(a.subcategory)},
      colours: { primary: ${tsString(a.colours.primary)}, secondary: ${tsString(a.colours.secondary)}, hex: ${tsString(a.colours.hex)} },
      pattern: ${tsString(a.pattern)},
      material: ${tsString(a.material)},
      season: ${tsString(a.season)},
      formality: ${tsString(a.formality)},
${optional.length ? optional.join("\n") + "\n" : ""}      brand: ${tsString(a.brand)},
      description: ${tsString(a.description)},
    },
  },`;
    })
    .join("\n");

  const file = `import type { Infer } from "convex/values";
import type { vItemAttributes } from "./validators";

/**
 * The Nyoni Couture pieces every member's wardrobe starts with. GENERATED by scripts/build-collection.mjs
 * from research/nyoni/woo-products.json on ${new Date().toISOString().slice(0, 10)}; edit the script or the
 * export, not this file. \`key\` is stable across syncs (it is what \`items.collectionKey\` stores); a piece
 * whose image cannot be fetched is skipped by the seeder rather than failing the whole seed.
 */
export type CollectionPiece = {
  key: string;
  productUrl: string;
  priceUsd?: number;
  image: string;
  attributes: Infer<typeof vItemAttributes>;
};

export const COLLECTION: readonly CollectionPiece[] = [
${body}
];

export function collectionPiece(key: string): CollectionPiece | undefined {
  return COLLECTION.find((piece) => piece.key === key);
}
`;
  await writeFile(TARGET, file);
  console.log(
    `Wrote ${pieces.length} pieces to ${path.relative(process.cwd(), TARGET)}${download ? ` and images to ${path.relative(process.cwd(), PUBLIC_DIR)}` : ""}.`,
  );
  console.log("Run `pnpm format` then `pnpm typecheck`; the seeder picks the new pieces up on the next seed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
