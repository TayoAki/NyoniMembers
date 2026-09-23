#!/usr/bin/env node
/**
 * Turn the WooCommerce export from scripts/capture-nyoni.mjs into convex/shared/collection.ts, the
 * Nyoni capsule every member's wardrobe starts with.
 *
 *   node scripts/build-collection.mjs                 # remote image URLs (the seeder fetches from the store)
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
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
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
  // Five suits. `parts` splits a product into the pieces a wardrobe actually holds: the jacket and
  // the trousers are worn apart as often as together, and a three-piece adds its waistcoat.
  { group: "Suits", slug: "nathan", parts: ["jacket", "trousers", "vest"], colour: "navy" },
  { group: "Suits", slug: "grayson", parts: ["jacket", "trousers", "vest"], colour: "charcoal" },
  {
    group: "Suits",
    slug: "evano-windowpane",
    parts: ["jacket", "trousers", "vest"],
    colour: "grey",
    note: "Super 200s wool in a grey windowpane check, for the days a plain suit is too plain. The waistcoat makes it a wedding; without it, a Tuesday.",
  },
  {
    group: "Suits",
    slug: "opel-black-tux",
    parts: ["jacket", "trousers"],
    name: "Sovereign Black Double-Breasted Tuxedo",
    colour: "black",
  },
  { group: "Suits", slug: "perseo", parts: ["jacket", "trousers"], colour: "grey" },

  // Five odd jackets, so the suit jackets are not the only thing that goes over a shirt.
  { group: "Blazers", slug: "navy-aztec-blazer", colour: "navy" },
  {
    group: "Blazers",
    slug: "vicenzo",
    colour: "grey",
    note: "A grey mélange odd jacket with enough texture to read as tailoring rather than a suit jacket gone astray. Takes the taupe or walnut trousers.",
  },
  {
    group: "Blazers",
    slug: "james-blazer",
    colour: "grey",
    note: "Grey-green glen check with a soft windowpane over it. The jacket for a town day that is not quite a suit day.",
  },
  {
    group: "Blazers",
    slug: "thomson-blazer",
    colour: "orange",
    note: "Burnt ochre in an open weave, cut unstructured. Summer, and the one piece in the capsule that answers a navy trouser with warmth.",
  },
  {
    group: "Blazers",
    slug: "ivoire-blazer-2",
    colour: "ivory",
    name: "Ivoire Double-Breasted Blazer",
    note: "Ivory, double breasted, peak lapel. It carries a black tie evening in summer and a wedding at any time of year.",
  },

  // Five trousers that take any of those jackets.
  { group: "Trousers", slug: "nyoni-classic-side-adjuster-dress-pants", colour: "black" },
  { group: "Trousers", slug: "nyoni-taupe-flat-front-tailored-dress-pants", colour: "taupe" },
  { group: "Trousers", slug: "nyoni-midnight-glen-plaid-pant", colour: "navy" },
  { group: "Trousers", slug: "nyoni-walnut-tweed-pant", colour: "brown" },
  { group: "Trousers", slug: "nyoni-black-satin-side-stripe-tuxedo-pants", colour: "black" },

  // Five waistcoats worn on their own, beside the ones that came with a three-piece.
  {
    group: "Vests",
    slug: "chalcedony",
    colour: "charcoal",
    name: "Chalcedony Shawl Waistcoat",
    note: "A charcoal shawl waistcoat, plain: the one that goes under every jacket in the capsule without asking a question.",
  },
  {
    group: "Vests",
    slug: "kenzie",
    colour: "navy",
    name: "Kenzie Waistcoat",
    note: "A navy wool waistcoat for separates: over the blue shirt with grey or taupe trousers, or under a blazer when the evening turns formal.",
  },
  {
    group: "Vests",
    slug: "yuma",
    colour: "grey",
    name: "Yuma Double-Breasted Waistcoat",
    note: "Mid grey, double breasted, shawl collar. A waistcoat with a front of its own, worn best where the jacket comes off.",
  },
  {
    group: "Vests",
    slug: "hematite",
    colour: "blue",
    name: "Hematite Windowpane Waistcoat",
    note: "Blue with a fine windowpane. It lifts a plain charcoal or navy suit without competing with a patterned jacket.",
  },
  {
    group: "Vests",
    slug: "gabbro",
    colour: "black",
    name: "Gabbro Marbled Waistcoat",
    note: "A marbled black and ivory waistcoat. Black tie, and nothing else: it wants the plainest jacket in the room.",
  },

  // Every boot the house stocks.
  {
    group: "Boots",
    slug: "antwerp-wing-tip",
    colour: "brown",
    name: "Antwerp Wing-Tip Boot",
    note: "Cognac calf with a buttoned side and a wing-tip toe, made in Italy on a leather sole. The boot for brown and taupe tailoring.",
  },
  {
    group: "Boots",
    slug: "roma-wing-tip",
    colour: "black",
    name: "Roma Wing-Tip Boot",
    note: "Black calf and suede, laced, on a leather sole, made in Italy. The most forgiving boot here with a checked or textured suit.",
  },
  {
    group: "Boots",
    slug: "monaco-cap-toe",
    colour: "black",
    name: "Monaco Cap-Toe Boot",
    note: "Black calf with a cap toe and a buckled strap, made in Italy on a leather sole. It carries navy and charcoal equally.",
  },
  {
    group: "Boots",
    slug: "chelsea-ii",
    colour: "black",
    name: "Chelsea II Boot",
    note: "A black calf Chelsea with a brogued wing-tip, made in Italy. Pulls on, and goes under a suit trouser without a word.",
  },
  {
    group: "Boots",
    slug: "hamburg-wing-tip",
    colour: "black",
    name: "Hamburg Wing-Tip Boot",
    note: "Black calf, side zip, wing-tip toe, made in Italy on a leather sole. The boot for winter tailoring and a long evening.",
  },

  // Five squares: one for each suit, and one that answers the ochre blazer.
  {
    group: "Pocket squares",
    slug: "silvano-2",
    colour: "navy",
    name: "Silvano Pocket Square",
    note: "Navy silk with a fine ivory foliate print, made in Italy. The square for a navy or charcoal suit when the occasion is not about the square.",
  },
  {
    group: "Pocket squares",
    slug: "paisley",
    colour: "black",
    name: "Paisley Pocket Square",
    note: "Black silk with a small ivory paisley, made in Italy. It finishes black tie and charcoal tailoring without raising its voice.",
  },
  {
    group: "Pocket squares",
    slug: "belagio-2",
    colour: "teal",
    name: "Belagio Pocket Square",
    note: "Deep teal paisley on near-black silk, made in Italy. Evening, and the one square here that reads as colour from across a room.",
  },
  {
    group: "Pocket squares",
    slug: "venez-2",
    colour: "orange",
    name: "Venez Pocket Square",
    note: "Copper baroque on black silk, made in Italy. It is the answer to the ochre blazer, and to brown tailoring generally.",
  },
  {
    group: "Pocket squares",
    slug: "serenata-2",
    colour: "blue",
    name: "Serenata Pocket Square",
    note: "Blue and ivory silk stripe, made in Italy. The square for a patterned jacket, where another pattern would be one too many.",
  },

  // The house stocks exactly one belt. The group grows when the store does.
  {
    group: "Belts",
    slug: "black-belt-2",
    colour: "black",
    name: "Black Leather Belt",
    // The store has this one in no category at all.
    category: "accessory",
    subcategory: "belt",
    note: "Black calf with a squared buckle. It is the belt the black and charcoal trousers ask for, and the only one the house stocks.",
  },
];

/** What each split part of a suit becomes in a wardrobe. */
const SUIT_PARTS = {
  jacket: { suffix: "jacket", label: "Jacket", category: "outerwear", subcategory: "suit jacket" },
  trousers: { suffix: "trousers", label: "Trousers", category: "bottom", subcategory: "suit trousers" },
  vest: { suffix: "vest", label: "Waistcoat", category: "vest", subcategory: "waistcoat" },
};

const SOURCE = path.resolve("research/nyoni/woo-products.json");
const TARGET = path.resolve("convex/shared/collection.ts");
const PUBLIC_DIR = path.resolve("public/collection");

/** WooCommerce category slug → [category, subcategory, formality, seasons]. Order matters: first match wins. */
const SEASONS_ALL = ["spring", "summer", "autumn", "winter"];

const CATEGORY_MAP = [
  ["tuxedo", ["suit", "tuxedo", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["three-piece-suit", ["suit", "three-piece suit", "formal", ["autumn", "winter", "spring"]]],
  ["double-breasted", ["suit", "double-breasted suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["two-piece", ["suit", "two-piece suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["suits", ["suit", "suit", "formal", ["spring", "summer", "autumn", "winter"]]],
  ["blazers", ["outerwear", "blazer", "smart-casual", ["spring", "autumn", "winter"]]],
  ["winter-coat", ["outerwear", "overcoat", "formal", ["autumn", "winter"]]],
  ["vest", ["vest", "waistcoat", "formal", ["autumn", "winter", "spring"]]],
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

function classify(product, entry) {
  for (const [slug, mapping] of CATEGORY_MAP) if (product.categories.includes(slug)) return mapping;
  // A handful of products are in no category on the store; the capsule entry says what they are.
  if (entry?.category) {
    return [entry.category, entry.subcategory ?? entry.category, entry.formality ?? "smart-casual", SEASONS_ALL];
  }
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

/** "Midnight Navy Three Piece Suit" + jacket -> "Midnight Navy Suit Jacket". */
function partName(suitName, part) {
  const tuxedo = /tuxedo|tux\b/i.test(suitName);
  const stem = suitName
    .replace(/\b(two|three)[\s-]piece\b/gi, "")
    .replace(/\b(suit|tuxedo|tux)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const garment = tuxedo ? "Tuxedo" : "Suit";
  if (part.suffix === "vest") return `${stem} Waistcoat`;
  return `${stem} ${garment} ${part.label}`;
}

const DESCRIPTION_MAX = 240;

/**
 * Product copy on the store trails off into spec-sheet fragments — "ACCESSORY: /// PACKAGING: box
 * covered with…" — which no member should read, and it is far longer than a card can hold. Cut the
 * spec sheet off, then end on a whole sentence where there is one within the cap and on a whole
 * word otherwise. A description that stops mid-word reads as broken, because it is.
 */
function cleanDescription(text, note) {
  if (note) return note;
  const prose = String(text ?? "")
    // Everything from the first shouted label onwards is a spec sheet, not a description.
    .split(/\s(?=[A-Z][A-Z ]{2,}:)|\s\/\/\/\s/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (prose.length <= DESCRIPTION_MAX) return prose;

  const head = prose.slice(0, DESCRIPTION_MAX + 1);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  // Only end on a sentence when doing so keeps most of the allowance; otherwise it reads as a stub.
  if (sentence >= DESCRIPTION_MAX * 0.6) return head.slice(0, sentence + 1).trim();

  const word = head.lastIndexOf(" ");
  return `${head.slice(0, word > 0 ? word : DESCRIPTION_MAX).replace(/[\s,;:—–-]+$/, "")}…`;
}

async function main() {
  const products = JSON.parse(await readFile(SOURCE, "utf8"));
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const localFiles = local && existsSync(PUBLIC_DIR) ? await readdir(PUBLIC_DIR) : [];
  /**
   * Each split part owns its own image file. Before the cutout pass those files are copies of the
   * suit's own photograph, so the wardrobe is usable while the parts wait for a photo of their own.
   */
  const imageFor = (pieceKey, remote) => {
    if (!local) return remote;
    const file = localFiles.find((name) => name.startsWith(`${pieceKey}.`));
    if (!file)
      throw new Error(`No photo in public/collection for ${pieceKey}; run scripts/fetch-collection-images.mjs.`);
    return `/collection/${file}`;
  };
  const pieces = [];
  for (const entry of CAPSULE) {
    const product = bySlug.get(entry.slug);
    if (!product) throw new Error(`${entry.slug} is not in the export; re-run scripts/capture-nyoni.mjs.`);
    if (!product.inStock) throw new Error(`${entry.slug} is out of stock; choose another piece for the capsule.`);
    const mapping = classify(product, entry);
    if (!mapping) throw new Error(`${entry.slug} has no wardrobe category: ${product.categories.join(", ")}.`);
    if (!product.images?.[0]?.src) throw new Error(`${entry.slug} has no product photo.`);
    const [category, subcategory, formality, season] = mapping;
    const text = `${product.name} ${product.shortDescription ?? ""} ${product.description ?? ""}`;
    const key = keyFor(product);
    const remote = product.images[0].src;
    const image = entry.parts ? remote : imageFor(key, remote);
    const displayName = cleanName(product.name, entry.name);
    const shared = {
      group: entry.group,
      productUrl: product.permalink,
      colours: colourOf(product.name, entry.colour),
      pattern: firstMatch(text, PATTERNS, "solid").replace("glenn plaid", "glen plaid"),
      material: firstMatch(text, MATERIALS, category === "shoes" ? "leather" : "wool"),
      season,
      formality,
      description: cleanDescription(product.shortDescription || product.description || product.name, entry.note),
    };

    if (entry.parts) {
      // One product, two or three wardrobe pieces. They keep the suit's link and carry `partOf` so a
      // screen can say what they belong to instead of printing the whole suit's price on a waistcoat.
      for (const name of entry.parts) {
        const part = SUIT_PARTS[name];
        if (!part) throw new Error(`${entry.slug}: unknown part "${name}".`);
        const partKey = `${key}-${part.suffix}`;
        pieces.push({
          ...shared,
          key: partKey,
          image: imageFor(partKey, image),
          partOf: { name: displayName, priceUsd: product.priceUsd },
          attributes: {
            name: partName(displayName, part),
            category: part.category,
            subcategory: part.subcategory,
            colours: shared.colours,
            pattern: shared.pattern,
            material: shared.material,
            season,
            formality,
            fit: part.suffix === "jacket" ? "slim" : undefined,
            brand: "Nyoni Couture",
            description: shared.description,
          },
        });
      }
      continue;
    }

    pieces.push({
      ...shared,
      key,
      priceUsd: product.priceUsd,
      image,
      attributes: {
        name: displayName,
        category,
        subcategory,
        colours: shared.colours,
        pattern: shared.pattern,
        material: shared.material,
        season,
        formality,
        fit: category === "suit" || subcategory === "blazer" ? "slim" : undefined,
        brand: "Nyoni Couture",
        description: shared.description,
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
    productUrl: ${tsString(piece.productUrl)},${piece.priceUsd !== undefined ? `\n    priceUsd: ${piece.priceUsd},` : ""}${
      piece.partOf ? `\n    partOf: { name: ${tsString(piece.partOf.name)}, priceUsd: ${piece.partOf.priceUsd} },` : ""
    }
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
  /** What the piece costs on its own. Absent when it is only sold as part of something. */
  priceUsd?: number;
  /** Set on a suit's jacket, trousers and waistcoat: the suit they are sold as, and its price. */
  partOf?: { name: string; priceUsd: number };
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
  console.log(`Wrote the ${pieces.length}-piece capsule to ${path.relative(process.cwd(), TARGET)}.`);
  console.log("Run `pnpm format` then `pnpm typecheck`; the seeder picks the new pieces up on the next seed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
