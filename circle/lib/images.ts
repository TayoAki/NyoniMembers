/**
 * Metro resolves `require` at build time, so every photo is named here rather than built from a
 * key at runtime. These are Nyoni Couture's own product photographs, copied from the web app.
 */

export const pieceImages = {
  "nyoni-cascata-2": require("../assets/collection/nyoni-cascata-2.webp"),
  "nyoni-grayson": require("../assets/collection/nyoni-grayson.webp"),
  "nyoni-kijivu-suit": require("../assets/collection/nyoni-kijivu-suit.webp"),
  "nyoni-isabella-bleu-pin-suit": require("../assets/collection/nyoni-isabella-bleu-pin-suit.webp"),
  "nyoni-opel-black-tux": require("../assets/collection/nyoni-opel-black-tux.webp"),
  "nyoni-cobalt-blazer-2": require("../assets/collection/nyoni-cobalt-blazer-2.webp"),
  "nyoni-grey-overcoat": require("../assets/collection/nyoni-grey-overcoat.webp"),
  "nyoni-classic-side-adjuster-dress-pants": require("../assets/collection/nyoni-classic-side-adjuster-dress-pants.webp"),
  "nyoni-midnight-glen-plaid-pant": require("../assets/collection/nyoni-midnight-glen-plaid-pant.webp"),
  "nyoni-taupe-flat-front-tailored-dress-pants": require("../assets/collection/nyoni-taupe-flat-front-tailored-dress-pants.webp"),
  "nyoni-cavalera-formal": require("../assets/collection/nyoni-cavalera-formal.webp"),
  "nyoni-elna-blu": require("../assets/collection/nyoni-elna-blu.webp"),
  "nyoni-sable-black-spread-collar-shirt": require("../assets/collection/nyoni-sable-black-spread-collar-shirt.webp"),
  "nyoni-navy-turtleneck": require("../assets/collection/nyoni-navy-turtleneck.webp"),
  "nyoni-kenzie": require("../assets/collection/nyoni-kenzie.webp"),
  "nyoni-oxford": require("../assets/collection/nyoni-oxford.webp"),
  "nyoni-monaco-cap-toe": require("../assets/collection/nyoni-monaco-cap-toe.webp"),
  "nyoni-florence-ii-penny-loafer": require("../assets/collection/nyoni-florence-ii-penny-loafer.webp"),
  "nyoni-obinna": require("../assets/collection/nyoni-obinna.webp"),
  "nyoni-granito-2": require("../assets/collection/nyoni-granito-2.webp"),
  "nyoni-brittan-2": require("../assets/collection/nyoni-brittan-2.webp"),
  "nyoni-silvano-2": require("../assets/collection/nyoni-silvano-2.webp"),
} as const;

export type PieceImageKey = keyof typeof pieceImages;

export function pieceImage(key: string) {
  return pieceImages[key as PieceImageKey];
}
