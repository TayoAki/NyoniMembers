import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

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

const {
  MEASUREMENT_FIELDS,
  MEASUREMENT_GROUP_LABELS,
  UNITS,
  formatMeasurement,
  fromCm,
  implausibleFields,
  measurementField,
  missingRequiredFields,
  roundMeasurement,
  toCm,
} = await import("../convex/shared/atelier/measurements.ts");

const REQUIRED_KEYS = MEASUREMENT_FIELDS.filter((field) => field.required).map((field) => field.key);
const OPTIONAL_KEYS = MEASUREMENT_FIELDS.filter((field) => !field.required).map((field) => field.key);

/** A plausible sheet: every field at the middle of its range. */
function completeSheet() {
  return Object.fromEntries(MEASUREMENT_FIELDS.map((field) => [field.key, (field.minCm + field.maxCm) / 2]));
}

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ""} expected ${expected}, got ${actual}`.trim());
}

test("the two units are centimetres and inches", () => {
  assert.deepEqual(UNITS, ["cm", "in"]);
});

test("centimetres pass through toCm and fromCm unchanged", () => {
  for (const value of [0, 0.5, 42, 99.9, 180]) {
    assert.equal(toCm(value, "cm"), value);
    assert.equal(fromCm(value, "cm"), value);
  }
});

test("inches convert at 2.54 centimetres and round-trip through toCm and fromCm", () => {
  assert.equal(toCm(1, "in"), 2.54);
  assert.equal(toCm(10, "in"), 25.4);
  closeTo(fromCm(25.4, "in"), 10);
  closeTo(fromCm(2.54, "in"), 1);
  for (const inches of [0, 0.25, 1, 15.75, 32, 40.5, 72]) {
    closeTo(fromCm(toCm(inches, "in"), "in"), inches, `${inches} in`);
  }
  for (const cm of [0, 0.5, 38, 101.5, 180]) {
    closeTo(toCm(fromCm(cm, "in"), "in"), cm, `${cm} cm`);
  }
});

test("roundMeasurement rounds centimetres to the nearest half", () => {
  assert.equal(roundMeasurement(1.24, "cm"), 1);
  assert.equal(roundMeasurement(1.26, "cm"), 1.5);
  assert.equal(roundMeasurement(1.74, "cm"), 1.5);
  assert.equal(roundMeasurement(1.76, "cm"), 2);
  assert.equal(roundMeasurement(100, "cm"), 100);
  assert.equal(roundMeasurement(100.5, "cm"), 100.5);
  assert.equal(roundMeasurement(99.9, "cm"), 100);
});

test("roundMeasurement rounds inches to the nearest quarter", () => {
  assert.equal(roundMeasurement(10.12, "in"), 10);
  assert.equal(roundMeasurement(10.13, "in"), 10.25);
  assert.equal(roundMeasurement(10.4, "in"), 10.5);
  assert.equal(roundMeasurement(10.6, "in"), 10.5);
  assert.equal(roundMeasurement(10.9, "in"), 11);
  assert.equal(roundMeasurement(10.75, "in"), 10.75);
  assert.equal(roundMeasurement(32, "in"), 32);
});

test("rounding a value that has already been rounded leaves it unchanged", () => {
  for (const unit of UNITS) {
    for (let tenths = 0; tenths <= 2000; tenths += 1) {
      const value = tenths / 10 + 0.03;
      const once = roundMeasurement(value, unit);
      assert.equal(roundMeasurement(once, unit), once, `${value} ${unit}`);
    }
  }
});

test("formatMeasurement writes whole centimetres without a decimal and half centimetres with one", () => {
  assert.equal(formatMeasurement(100, "cm"), "100 cm");
  assert.equal(formatMeasurement(100.5, "cm"), "100.5 cm");
  assert.equal(formatMeasurement(101.3, "cm"), "101.5 cm");
  assert.equal(formatMeasurement(100.2, "cm"), "100 cm");
  assert.equal(formatMeasurement(38.74, "cm"), "38.5 cm");
  assert.equal(formatMeasurement(0, "cm"), "0 cm");
});

test("formatMeasurement converts stored centimetres to inches and trims trailing zeros", () => {
  assert.equal(formatMeasurement(254, "in"), "100 in");
  assert.equal(formatMeasurement(2.54 * 10.25, "in"), "10.25 in");
  assert.equal(formatMeasurement(2.54 * 10.5, "in"), "10.5 in");
  assert.equal(formatMeasurement(2.54 * 10.75, "in"), "10.75 in");
  assert.equal(formatMeasurement(2.54 * 10.1, "in"), "10 in");
  assert.equal(formatMeasurement(2.54 * 10.2, "in"), "10.25 in");
  assert.equal(formatMeasurement(0, "in"), "0 in");
  assert.equal(formatMeasurement(2.54 * 20, "in"), "20 in");
});

test("implausibleFields flags values outside the plausible range and leaves the boundaries alone", () => {
  const height = measurementField("height");
  assert.deepEqual(implausibleFields({ height: height.minCm - 1 }), ["height"]);
  assert.deepEqual(implausibleFields({ height: height.minCm }), []);
  assert.deepEqual(implausibleFields({ height: height.maxCm }), []);
  assert.deepEqual(implausibleFields({ height: height.maxCm + 1 }), ["height"]);
  assert.deepEqual(implausibleFields({ height: 180, chest: 100 }), []);
  assert.deepEqual(implausibleFields({ chest: 20, height: 180, waist: 500 }), ["chest", "waist"]);
  assert.deepEqual(implausibleFields(completeSheet()), []);
  assert.deepEqual(implausibleFields({}), []);
});

test("implausibleFields flags keys the sheet does not know", () => {
  assert.deepEqual(implausibleFields({ height: 180, hatSize: 58 }), ["hatSize"]);
  assert.deepEqual(implausibleFields({ Height: 180 }), ["Height"], "keys are case-sensitive");
  assert.deepEqual(implausibleFields({ "": 1 }), [""]);
});

test("missingRequiredFields lists the required keys not yet entered, in sheet order", () => {
  assert.deepEqual(missingRequiredFields({}), REQUIRED_KEYS);
  assert.deepEqual(REQUIRED_KEYS, [
    "height",
    "chest",
    "waist",
    "seat",
    "shoulder",
    "sleeve",
    "jacketLength",
    "trouserWaist",
    "inseam",
    "thigh",
  ]);
  const partial = { chest: 100, inseam: 80, height: 180 };
  assert.deepEqual(
    missingRequiredFields(partial),
    REQUIRED_KEYS.filter((key) => !(key in partial)),
  );
  assert.deepEqual(missingRequiredFields(completeSheet()), []);
});

test("missingRequiredFields ignores optional fields and counts a zero as entered", () => {
  const optionalOnly = Object.fromEntries(OPTIONAL_KEYS.map((key) => [key, 40]));
  assert.deepEqual(missingRequiredFields(optionalOnly), REQUIRED_KEYS);
  const requiredOnly = Object.fromEntries(REQUIRED_KEYS.map((key) => [key, 0]));
  assert.deepEqual(missingRequiredFields(requiredOnly), []);
  const nonsense = { ...completeSheet(), height: -5, hatSize: 58 };
  assert.deepEqual(missingRequiredFields(nonsense), [], "a wrong value is the fitter's business, not a missing one");
});

test("the sheet's fields have unique keys, sane ranges, guide text and a labelled group", () => {
  const keys = MEASUREMENT_FIELDS.map((field) => field.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(REQUIRED_KEYS.length >= 8);
  for (const field of MEASUREMENT_FIELDS) {
    assert.ok(field.minCm > 0 && field.minCm < field.maxCm, `${field.key}: ${field.minCm}–${field.maxCm} cm`);
    assert.ok(field.label.length > 0 && field.guide.length > 10, `${field.key} is explained`);
    assert.ok(field.group in MEASUREMENT_GROUP_LABELS, `${field.key}: ${field.group} is a labelled group`);
    assert.equal(measurementField(field.key), field);
  }
  assert.equal(measurementField("hatSize"), undefined);
  assert.deepEqual(Object.keys(MEASUREMENT_GROUP_LABELS), ["body", "jacket", "trousers"]);
});
