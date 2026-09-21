import type { Infer } from "convex/values";
import type { vItemAttributes } from "./validators";

/**
 * The Nyoni Couture pieces every member's wardrobe starts with, so a new member can build a look
 * and preview it on their own photo before they have photographed a single garment of their own.
 *
 * `key` is stable across syncs (it is what `items.collectionKey` stores). `image` is an absolute
 * URL or a path under `public/` that the seed action fetches through SITE_URL; a piece whose image
 * cannot be fetched is skipped, never fatal, so the seed lights up as photos arrive.
 *
 * Regenerate from the live store with `node scripts/build-collection.mjs` after running
 * `scripts/capture-nyoni.mjs`. The entries below were hand-written from the store's indexed
 * catalogue; colours and materials are as described on the product pages.
 */
export type CollectionPiece = {
  key: string;
  productUrl: string;
  priceUsd?: number;
  image: string;
  attributes: Infer<typeof vItemAttributes>;
};

const BRAND = "Nyoni Couture";
const ALL_YEAR = ["spring", "summer", "autumn", "winter"] as const;
const COOL = ["autumn", "winter", "spring"] as const;
const WARM = ["spring", "summer"] as const;

export const COLLECTION: readonly CollectionPiece[] = [
  {
    key: "nyoni-armada-suit",
    productUrl: "https://nyonicouture.com/product/two-piece/armada-suit/",
    image: "/collection/nyoni-armada-suit.webp",
    attributes: {
      name: "Navy Armada two-piece suit",
      category: "suit",
      subcategory: "two-piece suit",
      colours: { primary: "navy", secondary: [], hex: ["#1F2A44"] },
      pattern: "solid",
      material: "wool",
      season: [...ALL_YEAR],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description:
        "A navy tailored-fit two-piece suit: single-breasted notch lapel jacket with matching flat-front trousers.",
    },
  },
  {
    key: "nyoni-nue-burg-suit",
    productUrl: "https://nyonicouture.com/product/three-piece-suit/nue-burg-suit/",
    image: "/collection/nyoni-nue-burg-suit.webp",
    attributes: {
      name: "Crimson three-piece suit",
      category: "suit",
      subcategory: "three-piece suit",
      colours: { primary: "crimson", secondary: [], hex: ["#A5122E"] },
      pattern: "solid",
      material: "Super 200s wool",
      season: [...COOL],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description:
        "A deep crimson three-piece suit in Super 200s wool: single-breasted notch lapel jacket, double-breasted waistcoat and matched trousers.",
    },
  },
  {
    key: "nyoni-dominico-suit",
    productUrl: "https://nyonicouture.com/product/double-breasted/dominico/",
    image: "/collection/nyoni-dominico-suit.webp",
    attributes: {
      name: "Onyx peak-lapel double-breasted suit",
      category: "suit",
      subcategory: "double-breasted suit",
      colours: { primary: "black", secondary: [], hex: ["#141414"] },
      pattern: "solid",
      material: "wool",
      season: [...ALL_YEAR],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description: "An onyx-black double-breasted power suit with peak lapels and matching trousers.",
    },
  },
  {
    key: "nyoni-fonda-azul-suit",
    productUrl: "https://nyonicouture.com/product/two-piece/fonda-azul-suit/",
    image: "/collection/nyoni-fonda-azul-suit.webp",
    attributes: {
      name: "Steel blue linen two-piece suit",
      category: "suit",
      subcategory: "two-piece suit",
      colours: { primary: "steel blue", secondary: [], hex: ["#4A6B8A"] },
      pattern: "solid",
      material: "linen",
      season: [...WARM],
      formality: "smart-casual",
      fit: "slim",
      brand: BRAND,
      description: "A breathable steel blue two-piece suit in 100% linen, cut for warm weather with formal authority.",
    },
  },
  {
    key: "nyoni-euforia-tuxedo",
    productUrl: "https://nyonicouture.com/product/tuxedo/nyoni-black-tux-tailored-fit-euforia/",
    image: "/collection/nyoni-euforia-tuxedo.webp",
    attributes: {
      name: "Onyx satin-panel tuxedo",
      category: "suit",
      subcategory: "tuxedo",
      colours: { primary: "black", secondary: [], hex: ["#0E0D0B"] },
      pattern: "solid",
      material: "wool with satin panels",
      season: [...ALL_YEAR],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description:
        "A black tailored-fit tuxedo with avant-garde geometric satin panels and matching trousers, for black tie.",
    },
  },
  {
    key: "nyoni-giorgio-glen-plaid-suit",
    productUrl: "https://nyonicouture.com/product/three-piece-suit/giorgio-light-grey-glenn-plaid-suit/",
    image: "/collection/nyoni-giorgio-glen-plaid-suit.webp",
    attributes: {
      name: "Giorgio light grey glen plaid suit",
      category: "suit",
      subcategory: "three-piece suit",
      colours: { primary: "light grey", secondary: ["white"], hex: ["#9A9A96"] },
      pattern: "glen plaid",
      material: "wool",
      season: [...COOL],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description: "A light grey glen plaid three-piece suit: jacket, waistcoat and trousers in a classic check.",
    },
  },
  {
    key: "nyoni-wynrooi-suit",
    productUrl: "https://nyonicouture.com/product/two-piece/wynrooi-suit/",
    image: "/collection/nyoni-wynrooi-suit.webp",
    attributes: {
      name: "French fuchsia two-piece suit",
      category: "suit",
      subcategory: "two-piece suit",
      colours: { primary: "fuchsia", secondary: [], hex: ["#C2288A"] },
      pattern: "solid",
      material: "wool",
      season: ["spring", "summer", "autumn"],
      formality: "formal",
      fit: "slim",
      brand: BRAND,
      description: "A bold French fuchsia two-piece suit with a single-breasted jacket and matching trousers.",
    },
  },
  {
    key: "nyoni-arno-shirt",
    productUrl: "https://nyonicouture.com/product/dress-shirts/arno/",
    image: "/collection/nyoni-arno-shirt.webp",
    attributes: {
      name: "Pink cutaway-collar shirt",
      category: "top",
      subcategory: "dress shirt",
      colours: { primary: "pink", secondary: [], hex: ["#E8B7C0"] },
      pattern: "solid",
      material: "cotton",
      season: [...ALL_YEAR],
      formality: "formal",
      brand: BRAND,
      description: "A crisp pink 100% cotton dress shirt with a cutaway collar, button placket and French cuffs.",
    },
  },
  {
    key: "nyoni-genteel-tux-shirt",
    productUrl: "https://nyonicouture.com/product/dress-shirts/genteel-tux-shirt/",
    image: "/collection/nyoni-genteel-tux-shirt.webp",
    attributes: {
      name: "Genteel tuxedo shirt",
      category: "top",
      subcategory: "tuxedo shirt",
      colours: { primary: "white", secondary: [], hex: ["#F7F5F0"] },
      pattern: "solid",
      material: "cotton",
      season: [...ALL_YEAR],
      formality: "formal",
      brand: BRAND,
      description: "A white 100% cotton tuxedo shirt with a spread collar and French cuffs, made for black tie.",
    },
  },
  {
    key: "nyoni-cavalera-geo-shirt",
    productUrl: "https://nyonicouture.com/product/dress-shirts/cavalera-geo-shirt/",
    image: "/collection/nyoni-cavalera-geo-shirt.webp",
    attributes: {
      name: "Cavalera geo shirt",
      category: "top",
      subcategory: "dress shirt",
      colours: { primary: "white", secondary: ["navy"], hex: ["#F4F1EA", "#1F2A44"] },
      pattern: "geometric",
      material: "cotton",
      season: [...ALL_YEAR],
      formality: "smart-casual",
      brand: BRAND,
      description: "A cotton dress shirt with a fine geometric print, spread collar and interchangeable cuffs.",
    },
  },
  {
    key: "nyoni-die-caprie-dress-pant",
    productUrl: "https://nyonicouture.com/product/trousers/die-caprie-dress-pants/",
    image: "/collection/nyoni-die-caprie-dress-pant.webp",
    attributes: {
      name: "Die Caprie dress trousers",
      category: "bottom",
      subcategory: "dress trousers",
      colours: { primary: "grey", secondary: [], hex: ["#6B6B68"] },
      pattern: "solid",
      material: "wool",
      season: [...ALL_YEAR],
      formality: "formal",
      brand: BRAND,
      description: "Mid-rise flat-front dress-cut trousers with a button and zip fly and belt loops.",
    },
  },
  {
    key: "nyoni-tuxedo-pant",
    productUrl: "https://nyonicouture.com/product/trousers/tuxedo-pants/",
    image: "/collection/nyoni-tuxedo-pant.webp",
    attributes: {
      name: "Tuxedo trousers",
      category: "bottom",
      subcategory: "tuxedo trousers",
      colours: { primary: "black", secondary: [], hex: ["#0E0D0B"] },
      pattern: "solid",
      material: "wool",
      season: [...ALL_YEAR],
      formality: "formal",
      brand: BRAND,
      description: "Black flat-front tuxedo trousers with a satin side stripe.",
    },
  },
  {
    key: "nyoni-ochre-blazer",
    productUrl: "https://nyonicouture.com/product/blazers/ochre-blazer/",
    image: "/collection/nyoni-ochre-blazer.webp",
    attributes: {
      name: "Ochre tailored-fit blazer",
      category: "outerwear",
      subcategory: "blazer",
      colours: { primary: "ochre", secondary: [], hex: ["#C7791E"] },
      pattern: "solid",
      material: "wool",
      season: ["spring", "autumn"],
      formality: "smart-casual",
      fit: "slim",
      brand: BRAND,
      description: "An orange-ochre tailored-fit single-breasted blazer with notch lapels.",
    },
  },
  {
    key: "nyoni-navy-aztec-blazer",
    productUrl: "https://nyonicouture.com/product/blazers/navy-aztec-blazer/",
    image: "/collection/nyoni-navy-aztec-blazer.webp",
    attributes: {
      name: "Navy Aztec blazer",
      category: "outerwear",
      subcategory: "blazer",
      colours: { primary: "navy", secondary: ["gold"], hex: ["#1F2A44", "#B8925A"] },
      pattern: "aztec jacquard",
      material: "wool blend",
      season: [...COOL],
      formality: "smart-casual",
      fit: "slim",
      brand: BRAND,
      description: "A navy single-breasted blazer in an Aztec-patterned jacquard, for evening and events.",
    },
  },
  {
    key: "nyoni-grey-overcoat",
    productUrl: "https://nyonicouture.com/product/winter-coat/grey-overcoat/",
    priceUsd: 595,
    image: "/collection/nyoni-grey-overcoat.webp",
    attributes: {
      name: "Grey cashmere overcoat",
      category: "outerwear",
      subcategory: "overcoat",
      colours: { primary: "grey", secondary: [], hex: ["#7D7B76"] },
      pattern: "solid",
      material: "cashmere",
      season: ["autumn", "winter"],
      formality: "formal",
      brand: BRAND,
      description: "A grey 100% cashmere overcoat that sits over a suit for winter.",
    },
  },
  {
    key: "nyoni-red-overcoat",
    productUrl: "https://nyonicouture.com/product/winter-coat/red-overcoat/",
    priceUsd: 595,
    image: "/collection/nyoni-red-overcoat.webp",
    attributes: {
      name: "Red cashmere overcoat",
      category: "outerwear",
      subcategory: "overcoat",
      colours: { primary: "red", secondary: [], hex: ["#9E1B2A"] },
      pattern: "solid",
      material: "cashmere",
      season: ["autumn", "winter"],
      formality: "formal",
      brand: BRAND,
      description: "A statement red 100% cashmere overcoat, cut long to layer over tailoring.",
    },
  },
  {
    key: "nyoni-verona-tassel-loafer",
    productUrl: "https://nyonicouture.com/product/loafers/verona-tassel-loafer/",
    image: "/collection/nyoni-verona-tassel-loafer.webp",
    attributes: {
      name: "Verona tassel loafers",
      category: "shoes",
      subcategory: "tassel loafers",
      colours: { primary: "black", secondary: [], hex: ["#141414"] },
      pattern: "solid",
      material: "calfskin leather",
      season: [...ALL_YEAR],
      formality: "formal",
      brand: BRAND,
      description:
        "Black calfskin tassel loafers with leather soles, made in Italy for the Bismack Biyombo luxury line.",
    },
  },
  {
    key: "nyoni-hamburg-wing-tip",
    productUrl: "https://nyonicouture.com/product/boots/hamburg-wing-tip/",
    image: "/collection/nyoni-hamburg-wing-tip.webp",
    attributes: {
      name: "Hamburg wing-tip boots",
      category: "shoes",
      subcategory: "wing-tip boots",
      colours: { primary: "brown", secondary: [], hex: ["#5A3A24"] },
      pattern: "brogue",
      material: "calfskin leather",
      season: [...COOL],
      formality: "smart-casual",
      brand: BRAND,
      description: "Brown calfskin wing-tip boots with leather soles and linings, made in Italy.",
    },
  },
  {
    key: "nyoni-messenger-bag-brown",
    productUrl: "https://nyonicouture.com/product/nyoni-messenger-bag-brown/",
    image: "/collection/nyoni-messenger-bag-brown.webp",
    attributes: {
      name: "Brown messenger bag",
      category: "bag",
      subcategory: "messenger bag",
      colours: { primary: "brown", secondary: [], hex: ["#6B4A2F"] },
      pattern: "solid",
      material: "leather",
      season: [...ALL_YEAR],
      formality: "smart-casual",
      brand: BRAND,
      description: "A brown leather messenger bag with a flap front and shoulder strap.",
    },
  },
];

export function collectionPiece(key: string): CollectionPiece | undefined {
  return COLLECTION.find((piece) => piece.key === key);
}
