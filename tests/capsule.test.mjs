import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
      for (const extension of [".ts", ".js"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});

const { COLLECTION, collectionPiece } = await import("../convex/shared/collection.ts");
const { CATEGORIES, SLOTS, SLOT_CATEGORIES } = await import("../convex/shared/wardrobe.ts");

const photoDir = new URL("../public/collection/", import.meta.url);
const photos = new Set(
  readdirSync(fileURLToPath(photoDir))
    .filter((file) => file !== "README.md")
    .map((file) => `/collection/${file}`),
);

test("the capsule stays a capsule: a curated set, not the catalogue", () => {
  assert.ok(COLLECTION.length >= 15 && COLLECTION.length <= 30, `${COLLECTION.length} pieces is not a capsule`);
  assert.equal(new Set(COLLECTION.map((piece) => piece.key)).size, COLLECTION.length);
  assert.equal(new Set(COLLECTION.map((piece) => piece.productUrl)).size, COLLECTION.length);
});

test("every piece ships with its own photo and a real product link", () => {
  for (const piece of COLLECTION) {
    assert.ok(photos.has(piece.image), `no photo on disk for ${piece.key}: ${piece.image}`);
    assert.match(piece.productUrl, /^https:\/\/nyonicouture\.com\/product\//, piece.key);
    assert.equal(collectionPiece(piece.key), piece);
  }
});

test("every piece is described well enough for the concierge to style it", () => {
  for (const piece of COLLECTION) {
    const { name, category, colours, description, brand } = piece.attributes;
    assert.ok(CATEGORIES.includes(category), `${piece.key}: ${category}`);
    assert.ok(name.length > 3 && name === name.trim(), `${piece.key}: ${name}`);
    assert.doesNotMatch(name, /^[\s–—-]|nyoni couture$/i, `${piece.key}: ${name}`);
    assert.notEqual(colours.primary, "unknown", `${piece.key} has no colour`);
    assert.ok(description.length >= 40, `${piece.key} has a ${description.length}-character description`);
    assert.equal(brand, "Nyoni Couture");
  }
});

test("the capsule fills every slot a look needs, in both black tie and separates", () => {
  const fills = (slot) =>
    COLLECTION.filter((piece) => SLOT_CATEGORIES[slot].includes(piece.attributes.category)).length;
  for (const slot of SLOTS) {
    if (slot === "dress") continue; // menswear only: the dress slot is deliberately empty
    assert.ok(fills(slot) > 0, `nothing to put in the ${slot} slot`);
  }
  const suits = COLLECTION.filter((piece) => piece.attributes.category === "suit");
  assert.ok(
    suits.some((piece) => piece.attributes.subcategory === "tuxedo"),
    "no tuxedo for black tie",
  );
  assert.ok(suits.length >= 3, "too few suits to dress a week");
  const tops = COLLECTION.filter((piece) => piece.attributes.category === "top");
  assert.ok(
    tops.some((piece) => piece.attributes.colours.primary === "white"),
    "no white shirt",
  );
  assert.ok(
    COLLECTION.some((piece) => piece.attributes.category === "shoes" && piece.attributes.formality === "formal"),
    "no formal shoe",
  );
});
