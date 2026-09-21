#!/usr/bin/env node
/**
 * Turn the WooCommerce export from scripts/capture-nyoni.mjs into convex/shared/collection.ts, the
 * Nyoni capsule every member's wardrobe starts with.
 *
 *   node scripts/build-collection.mjs                 # remote image URLs (the seeder fetches from the store)
 *   node scripts/build-collection.mjs --download      # also save each image to public/collection/<key>.<ext>
 *   node scripts/build-collection.mjs --local         # use images already present in public/collection/ (no network)
 *
 * The store's bot challenge blocks plain downloads; scripts/fetch-collection-images.mjs pulls the
 * photos through Jetpack's image CDN into public/collection/, after which --local wires them up.
 *
 * The capsule is curated, not filtered: CAPSULE below names each piece by its WooCommerce slug, so
 * the house chooses what every member starts with and this script only carries the product's real
 * name, price, link, photo and description across. Season, formality and fit are defaults the
 * concierge can correct. Three overrides exist for the places the store's own data is thin: `colour`
 * (several product names carry no colour word at all), `name` (a bare "Kenzie" does not say what the
 * piece is) and `note` (a house line where the product has no description worth showing a member).
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const download = args.includes("--download");
const local = args.includes("--local");

/**
 * The Nyoni capsule: twenty-two pieces chosen from the catalogue so a member can dress a boardroom,
 * a wedding, a black-tie dinner and a Saturday before owning anything of their own. Four suits in
 * the house neutrals plus a tuxedo; one odd jacket and one overcoat to layer; three trousers that
 * take any of those jackets; shirts in white, blue and black with a turtleneck and a waistcoat for
 * separates; three pairs of shoes; and the four accessories that finish a look. Grow it
 * deliberately: a capsule stops working the moment it becomes a catalogue again.
 */
const CAPSULE = [
  { group: "Tailoring", slug: "cascata-2" },
  { group: "Tailoring", slug: "grayson" },
  { group: "Tailoring", slug: "kijivu-suit" },
  { group: "Tailoring", slug: "isabella-bleu-pin-suit" },
  { group: "Tailoring", slug: "opel-black-tux", name: "Sovereign Black Double-Breasted Tuxedo", colour: "black" },
  { group: "Layers", slug: "cobalt-blazer-2", colour: "grey" },
  { group: "Layers", slug: "grey-overcoat" },
  { group: "Trousers", slug: "nyoni-classic-side-adjuster-dress-pants", colour: "black" },
  { group: "Trousers", slug: "nyoni-midnight-glen-plaid-pant", colour: "navy" },
  { group: "Trousers", slug: "nyoni-taupe-flat-front-tailored-dress-pants", colour: "taupe" },
  { group: "Shirts and knitwear", slug: "cavalera-formal", colour: "white" },
  { group: "Shirts and knitwear", slug: "elna-blu" },
  { group: "Shirts and knitwear", slug: "nyoni-sable-black-spread-collar-shirt" },
  { group: "Shirts and knitwear", slug: "nyoni-navy-turtleneck" },
  {
    group: "Shirts and knitwear",
    slug: "kenzie",
    note: "A navy wool waistcoat for separates: over the blue shirt with grey or taupe trousers, or under the blazer when the evening turns formal.",
    name: "Kenzie Waistcoat",
    colour: "navy",
  },
  {
    group: "Shoes",
    slug: "oxford",
    note: "The black cap-toe oxford, the one shoe that answers every suit in the capsule and carries black tie when the evening calls for it.",
    colour: "black",
  },
  { group: "Shoes", slug: "monaco-cap-toe", name: "Monaco Cap-Toe Boot", colour: "black" },
  { group: "Shoes", slug: "florence-ii-penny-loafer", colour: "burgundy" },
  {
    group: "Accessories",
    slug: "obinna",
    note: "A handcrafted Milano silk tie, teal ground with a grey bar stripe: the pattern that sits comfortably against navy, charcoal and grey.",
    name: "Obina Stripe Neck-tie",
    colour: "teal",
  },
  { group: "Accessories", slug: "granito-2", colour: "blue" },
  {
    group: "Accessories",
    slug: "brittan-2",
    note: "The black silk self-tie bow. Black tie asks for one thing, and this is it.",
    name: "Brittan Silk Bow Tie",
    colour: "black",
  },
  {
    group: "Accessories",
    slug: "silvano-2",
    note: "A navy silk pocket square with a fine white print, made in Italy. Restrained enough for the boardroom, finished enough for a wedding.",
    name: "Silvano Pocket Square",
    colour: "navy",
  },
];

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
  ["taupe", "taupe", "#B3A492"],
  ["teal", "teal", "#1F6F73"],
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

function colourOf(text, override) {
  const lower = (override ?? text).toLowerCase();
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

/**
 * Store names carry the house prefix, stray dashes, a trailing " – Nyoni Couture" and the odd
 * shouted caps; the wardrobe shows the piece's own name. A CAPSULE entry can override it outright
 * where the store's name (a bare "Kenzie") does not say what the piece is.
 */
function cleanName(name, override) {
  if (override) return override;
  return name
    .replace(/^Nyoni\s+/i, "")
    .replace(/^[\s\u2013\u2014-]+/, "")
    .replace(/[\s\u2013\u2014-]+Nyoni Couture\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[A-Z][A-Z-]+\b/g, (word) =>
      /^[IVXL]+$/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase(),
    );
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
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const localFiles = local && existsSync(PUBLIC_DIR) ? await readdir(PUBLIC_DIR) : [];
  const pieces = [];
  for (const entry of CAPSULE) {
    const product = bySlug.get(entry.slug);
    if (!product) throw new Error(`${entry.slug} is not in the export; re-run scripts/capture-nyoni.mjs.`);
    if (!product.inStock) throw new Error(`${entry.slug} is out of stock; choose another piece for the capsule.`);
    const mapping = classify(product);
    if (!mapping) throw new Error(`${entry.slug} has no wardrobe category: ${product.categories.join(", ")}.`);
    if (!product.images?.[0]?.src) throw new Error(`${entry.slug} has no product photo.`);
    const [category, subcategory, formality, season] = mapping;
    const text = `${product.name} ${product.shortDescription ?? ""} ${product.description ?? ""}`;
    const key = keyFor(product);
    let image = product.images[0].src;
    if (local) {
      const file = localFiles.find((name) => name.startsWith(`${key}.`));
      if (!file) throw new Error(`No photo in public/collection for ${key}; run scripts/fetch-collection-images.mjs.`);
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
      group: entry.group,
      productUrl: product.permalink,
      priceUsd: product.priceUsd,
      image,
      attributes: {
        name: cleanName(product.name, entry.name),
        category,
        subcategory,
        colours: colourOf(product.name, entry.colour),
        pattern: firstMatch(text, PATTERNS, "solid").replace("glenn plaid", "glen plaid"),
        material: firstMatch(text, MATERIALS, category === "shoes" ? "leather" : "wool"),
        season,
        formality,
        fit: category === "suit" || subcategory === "blazer" ? "slim" : undefined,
        brand: "Nyoni Couture",
        description: (entry.note || product.shortDescription || product.description || product.name).slice(0, 240),
      },
    });
  }

  const body = pieces
    .map((piece, index) => {
      const a = piece.attributes;
      const optional = [a.fit ? `      fit: ${tsString(a.fit)},` : null].filter(Boolean);
      const heading = piece.group === pieces[index - 1]?.group ? "" : `${index === 0 ? "" : "\n"}  // ${piece.group}\n`;
      return `${heading}  {
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
 * The Nyoni capsule: the ${pieces.length} pieces every member's wardrobe starts with, enough to dress a
 * boardroom, a wedding, a black-tie dinner and a Saturday. GENERATED by scripts/build-collection.mjs
 * from research/nyoni/woo-products.json on ${new Date().toISOString().slice(0, 10)}; choose the pieces in that
 * script's CAPSULE list, not here. \`key\` is stable across syncs (it is what \`items.collectionKey\` stores);
 * a piece whose image cannot be fetched is skipped by the seeder rather than failing the whole seed, and a
 * member's item whose key has left the capsule is retired on their next seed.
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
    `Wrote the ${pieces.length}-piece capsule to ${path.relative(process.cwd(), TARGET)}${download ? ` and images to ${path.relative(process.cwd(), PUBLIC_DIR)}` : ""}.`,
  );
  console.log("Run `pnpm format` then `pnpm typecheck`; the seeder picks the new pieces up on the next seed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
