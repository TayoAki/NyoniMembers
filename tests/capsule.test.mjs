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

/**
 * Slots the capsule deliberately cannot fill, each with the reason. A slot that goes quiet for any
 * other reason should fail this suite rather than be discovered by a member with nothing to wear.
 */
const UNSTOCKED = {
  dress: "menswear only",
  suit: "suits are held as their parts, so no piece is category 'suit'",
  top: "the house has not chosen the shirts for this capsule yet",
};

test("the capsule stays a capsule: a curated set, not the catalogue", () => {
  assert.ok(COLLECTION.length >= 30 && COLLECTION.length <= 60, `${COLLECTION.length} pieces is not a capsule`);
  assert.equal(new Set(COLLECTION.map((piece) => piece.key)).size, COLLECTION.length, "duplicate keys");
  // Parts of one suit share its product URL, so distinct products is the number that matters.
  const products = new Set(COLLECTION.map((piece) => piece.productUrl));
  assert.ok(products.size >= 25, `only ${products.size} distinct products`);
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
    assert.doesNotMatch(description, /[a-z,;:]$/, `${piece.key} stops mid-sentence: …${description.slice(-40)}`);
    assert.equal(brand, "Nyoni Couture");
  }
});

test("a suit is held as the pieces a wardrobe actually wears", () => {
  const parts = COLLECTION.filter((piece) => piece.partOf);
  assert.ok(parts.length >= 8, `only ${parts.length} suit parts`);

  for (const part of parts) {
    // A waistcoat must never carry the whole suit's price as if it were its own.
    assert.equal(part.priceUsd, undefined, `${part.key} prices a part as though it were the suit`);
    assert.ok(part.partOf.priceUsd > 0, `${part.key} has no suit price`);
    assert.match(part.key, /-(jacket|trousers|vest)$/, part.key);
  }

  const bySuit = new Map();
  for (const part of parts) bySuit.set(part.partOf.name, [...(bySuit.get(part.partOf.name) ?? []), part]);
  for (const [suit, group] of bySuit) {
    const suffixes = group.map((part) => part.key.split("-").at(-1)).sort();
    assert.ok(
      suffixes.join() === "jacket,trousers" || suffixes.join() === "jacket,trousers,vest",
      `${suit} splits into ${suffixes.join(", ")}`,
    );
    assert.equal(new Set(group.map((part) => part.productUrl)).size, 1, `${suit}'s parts disagree on the product`);
  }
  assert.ok(
    [...bySuit.values()].some((group) => group.length === 3),
    "no three-piece suit yields its waistcoat",
  );
});

test("the capsule fills every slot a look needs, and says which it cannot", () => {
  const fills = (slot) =>
    COLLECTION.filter((piece) => SLOT_CATEGORIES[slot].includes(piece.attributes.category)).length;
  for (const slot of SLOTS) {
    if (slot in UNSTOCKED) {
      assert.equal(fills(slot), 0, `${slot} is stocked after all — take it out of UNSTOCKED`);
      continue;
    }
    assert.ok(fills(slot) > 0, `nothing to put in the ${slot} slot`);
  }

  const jackets = COLLECTION.filter((piece) => piece.attributes.category === "outerwear");
  assert.ok(jackets.length >= 5, "too few jackets to dress a week");
  assert.ok(
    jackets.some((piece) => /tuxedo/i.test(piece.attributes.name)),
    "no tuxedo jacket for black tie",
  );
  assert.ok(
    COLLECTION.some((piece) => piece.attributes.category === "bottom" && /tuxedo/i.test(piece.attributes.name)),
    "no tuxedo trouser for black tie",
  );
  assert.ok(
    COLLECTION.some((piece) => piece.attributes.category === "shoes"),
    "nothing to put on the feet",
  );
});
