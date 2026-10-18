import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
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
  BREASTS,
  BUTTON_STANCES,
  CANVASES,
  DEFAULT_SPEC,
  DEFAULT_WAISTCOAT,
  DOUBLE_STANCES,
  GARMENTS,
  HEMS,
  LAPELS,
  LAPEL_WIDTHS,
  MONOGRAM_FONTS,
  MONOGRAM_PLACEMENTS,
  MONOGRAM_THREADS,
  PLEATS,
  POCKETS,
  RISES,
  SHOULDERS,
  SINGLE_STANCES,
  SLEEVE_BUTTONS,
  TROUSER_FITS,
  VENTS,
  WAISTBANDS,
  WAISTCOAT_BACKS,
  WAISTCOAT_LAPELS,
  WAISTCOAT_STYLES,
  allowedOptions,
  applyChange,
  canonicalSpec,
  completedStepsFor,
  describeSpec,
  specHash,
  specSummary,
  validateSpec,
} = await import("../convex/shared/atelier/spec.ts");
const { LOOKS, lookByKey, looksForOccasion } = await import("../convex/shared/atelier/looks.ts");
const { CLOTH_SEED, clothSeedByCode } = await import("../convex/shared/atelier/cloths.ts");
const { BUTTON_SEED, LINING_SEED } = await import("../convex/shared/atelier/materials.ts");
const { ATELIER_LIMITS, CLOTH_PATTERNS, CLOTH_WEIGHTS, OCCASIONS } = await import("../convex/shared/atelier/enums.ts");
const { SEASONS } = await import("../convex/shared/wardrobe.ts");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLOTH = "taveller-4-seasons";
const MONOGRAM = { text: "N.S.", placement: "inside_pocket", thread: "gold", font: "script" };

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

/** A complete, valid two-piece in a real cloth; `jacket` and `trousers` overrides merge field by field. */
function suit(overrides = {}) {
  return {
    ...DEFAULT_SPEC,
    clothCode: CLOTH,
    ...overrides,
    jacket: { ...DEFAULT_SPEC.jacket, ...(overrides.jacket ?? {}) },
    trousers: { ...DEFAULT_SPEC.trousers, ...(overrides.trousers ?? {}) },
  };
}

function doubleBreasted(overrides = {}) {
  return suit({
    ...overrides,
    jacket: { breast: "double", buttons: "six_by_two", lapel: "peak", ...(overrides.jacket ?? {}) },
  });
}

/** The dot paths a patch names, in the engine's own convention. */
function touchedFields(patch) {
  const touched = new Set();
  for (const key of ["garment", "clothCode", "buttonCode", "liningCode", "monogram", "waistcoat"]) {
    if (patch[key] !== undefined) touched.add(key);
  }
  for (const key of Object.keys(patch.jacket ?? {})) touched.add(`jacket.${key}`);
  for (const key of Object.keys(patch.trousers ?? {})) touched.add(`trousers.${key}`);
  return touched;
}

/** Contract §3 rules 1 to 5, checked directly rather than through the engine. */
function assertManufacturable(spec, context) {
  const { garment, jacket, trousers, waistcoat } = spec;
  if (jacket.breast === "double") {
    assert.ok(DOUBLE_STANCES.includes(jacket.buttons), `${context}: a double-breasted stance`);
    assert.ok(
      jacket.lapel === "peak" || (jacket.lapel === "shawl" && garment === "tuxedo"),
      `${context}: a double-breasted jacket has a peak lapel, or a shawl on a tuxedo`,
    );
  } else {
    assert.ok(SINGLE_STANCES.includes(jacket.buttons), `${context}: a single-breasted stance`);
  }
  if (jacket.lapel === "shawl") {
    assert.ok(
      garment === "tuxedo" || (jacket.breast === "single" && jacket.buttons === "one"),
      `${context}: a shawl lapel belongs to a tuxedo or a one-button single-breasted jacket`,
    );
  }
  if (garment === "tuxedo") {
    assert.equal(jacket.pockets, "jetted", `${context}: tuxedo pockets`);
    assert.equal(jacket.ticketPocket, false, `${context}: tuxedo ticket pocket`);
    assert.ok(["none", "double"].includes(jacket.vents), `${context}: tuxedo vents`);
    assert.equal(trousers.hem, "plain", `${context}: tuxedo hem`);
  }
  assert.equal(waistcoat !== null, garment === "three_piece", `${context}: a waistcoat only on a three-piece`);
}

/**
 * Runs applyChange against a deep-frozen copy and checks what every call must guarantee: the input is
 * untouched, the result validates, obeys the contract, needs no further resolution, and no conflict names
 * a field the patch itself set.
 */
function apply(spec, patch) {
  const frozen = deepFreeze(structuredClone(spec));
  const before = JSON.stringify(frozen);
  const result = applyChange(frozen, patch);
  assert.equal(JSON.stringify(frozen), before, "applyChange must not mutate its input");
  assert.deepEqual(validateSpec(result.spec), [], "the resolved spec passes validateSpec");
  assertManufacturable(result.spec, JSON.stringify(patch));
  const settled = applyChange(result.spec, {});
  assert.deepEqual(settled.conflicts, [], "the resolved spec needs no further resolution");
  assert.deepEqual(settled.spec, result.spec);
  const touched = touchedFields(patch);
  for (const conflict of result.conflicts) {
    // A conflict on a field the patch set means the engine refused the requested value: it is reported, not silent.
    if (touched.has(conflict.field)) assert.notEqual(conflict.from, conflict.to, `${conflict.field} reported without a change`);
  }
  return result;
}

function fieldsMoved(result) {
  return result.conflicts.map((conflict) => conflict.field);
}

// Rule 1: breast, stance and lapel.

test("switching the front to double-breasted moves the stance to six-by-two and the lapel to peak, and reports both", () => {
  const { spec, conflicts } = apply(suit(), { jacket: { breast: "double" } });
  assert.equal(spec.jacket.breast, "double");
  assert.equal(spec.jacket.buttons, "six_by_two");
  assert.equal(spec.jacket.lapel, "peak");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.buttons",
      label: "Button stance",
      from: "two",
      to: "six_by_two",
      reason: "A double-breasted jacket closes with two of its buttons.",
    },
    {
      field: "jacket.lapel",
      label: "Lapel",
      from: "notch",
      to: "peak",
      reason: "A double-breasted jacket is cut with a peak lapel.",
    },
  ]);
});

test("switching a six-by-two jacket back to single-breasted moves the stance to two buttons and keeps the peak lapel", () => {
  const { spec, conflicts } = apply(doubleBreasted(), { jacket: { breast: "single" } });
  assert.equal(spec.jacket.buttons, "two");
  assert.equal(spec.jacket.lapel, "peak");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.buttons",
      label: "Button stance",
      from: "six_by_two",
      to: "two",
      reason: "A single-breasted jacket has one, two or three buttons.",
    },
  ]);
});

test("a double-breasted jacket that already has a double stance and a peak lapel is left alone", () => {
  const { conflicts } = apply(suit(), { jacket: { breast: "double", buttons: "four_by_two", lapel: "peak" } });
  assert.deepEqual(conflicts, []);
});

// Rule 2: the shawl lapel.

test("choosing a shawl lapel on a two-button day jacket moves the stance to one button", () => {
  const { spec, conflicts } = apply(suit(), { jacket: { lapel: "shawl" } });
  assert.equal(spec.jacket.lapel, "shawl");
  assert.equal(spec.jacket.buttons, "one");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.buttons",
      label: "Button stance",
      from: "two",
      to: "one",
      reason: "A shawl lapel is cut with a single button.",
    },
  ]);
});

test("moving the stance away from one button on a shawl-lapel day jacket moves the lapel back to notch", () => {
  const { spec, conflicts } = apply(suit({ jacket: { lapel: "shawl", buttons: "one" } }), {
    jacket: { buttons: "two" },
  });
  assert.equal(spec.jacket.buttons, "two");
  assert.equal(spec.jacket.lapel, "notch");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.lapel",
      label: "Lapel",
      from: "shawl",
      to: "notch",
      reason: "A shawl lapel is cut with a single button.",
    },
  ]);
});

test("a one-button shawl-lapel day jacket is already manufacturable", () => {
  const { conflicts } = apply(suit({ jacket: { lapel: "shawl", buttons: "one" } }), {});
  assert.deepEqual(conflicts, []);
});

test("a tuxedo keeps its shawl lapel at any stance, single or double-breasted", () => {
  const single = apply(suit({ garment: "tuxedo", jacket: { lapel: "shawl", pockets: "jetted" } }), {
    jacket: { buttons: "two" },
  });
  assert.equal(single.spec.jacket.lapel, "shawl");
  assert.deepEqual(single.conflicts, []);
  const double = apply(suit({ garment: "tuxedo", jacket: { lapel: "shawl", pockets: "jetted" } }), {
    jacket: { breast: "double", buttons: "six_by_two" },
  });
  assert.equal(double.spec.jacket.lapel, "shawl");
  assert.deepEqual(double.conflicts, []);
});

test("a double-breasted shawl tuxedo that becomes a two-piece is given a peak lapel", () => {
  const tuxedo = doubleBreasted({ garment: "tuxedo", jacket: { lapel: "shawl", pockets: "jetted", vents: "none" } });
  const { spec, conflicts } = apply(tuxedo, { garment: "two_piece" });
  assert.equal(spec.jacket.lapel, "peak");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.lapel",
      label: "Lapel",
      from: "shawl",
      to: "peak",
      reason: "A shawl lapel is cut on a tuxedo or a one-button single-breasted jacket.",
    },
  ]);
});

test("a two-button shawl tuxedo that becomes a two-piece is given a notch lapel, because the stance was not touched", () => {
  const tuxedo = suit({
    garment: "tuxedo",
    jacket: { lapel: "shawl", buttons: "two", pockets: "jetted", vents: "none" },
  });
  const { spec, conflicts } = apply(tuxedo, { garment: "two_piece" });
  assert.equal(spec.jacket.lapel, "notch");
  assert.equal(spec.jacket.buttons, "two");
  assert.deepEqual(fieldsMoved({ conflicts }), ["jacket.lapel"]);
});

// Rules 3 and 5: the tuxedo's details.

test("switching to a tuxedo forces jetted pockets, no ticket pocket, no vent and a plain hem, and reports each", () => {
  const day = suit({ jacket: { vents: "single", ticketPocket: true, pockets: "flap" }, trousers: { hem: "cuffed" } });
  const { spec, conflicts } = apply(day, { garment: "tuxedo" });
  assert.equal(spec.jacket.pockets, "jetted");
  assert.equal(spec.jacket.ticketPocket, false);
  assert.equal(spec.jacket.vents, "none");
  assert.equal(spec.trousers.hem, "plain");
  assert.deepEqual(conflicts, [
    {
      field: "jacket.pockets",
      label: "Pockets",
      from: "flap",
      to: "jetted",
      reason: "A tuxedo is finished with jetted pockets.",
    },
    {
      field: "jacket.ticketPocket",
      label: "Ticket pocket",
      from: "true",
      to: "false",
      reason: "A tuxedo has no ticket pocket.",
    },
    {
      field: "jacket.vents",
      label: "Vents",
      from: "single",
      to: "none",
      reason: "A tuxedo is cut without a vent or with side vents.",
    },
    {
      field: "trousers.hem",
      label: "Trouser hem",
      from: "cuffed",
      to: "plain",
      reason: "Tuxedo trousers are finished with a plain hem.",
    },
  ]);
});

test("a tuxedo keeps double vents and a plain hem without comment", () => {
  const { spec, conflicts } = apply(suit({ jacket: { vents: "double", pockets: "jetted" } }), { garment: "tuxedo" });
  assert.equal(spec.jacket.vents, "double");
  assert.deepEqual(conflicts, []);
});

test("a cuffed hem on a day suit is left alone", () => {
  const { spec, conflicts } = apply(suit(), { trousers: { hem: "cuffed" } });
  assert.equal(spec.trousers.hem, "cuffed");
  assert.deepEqual(conflicts, []);
});

test("patch pockets on a day suit drop the ticket pocket and say why", () => {
  const { spec, conflicts } = apply(suit({ jacket: { ticketPocket: true } }), { jacket: { pockets: "patch" } });
  assert.equal(spec.jacket.ticketPocket, false);
  assert.deepEqual(conflicts, [
    {
      field: "jacket.ticketPocket",
      label: "Ticket pocket",
      from: "true",
      to: "false",
      reason: "Patch pockets are cut without a ticket pocket.",
    },
  ]);
});

// Rule 4: the waistcoat.

test("a three-piece adds the house waistcoat and reports it as a conflict", () => {
  const { spec, conflicts } = apply(suit(), { garment: "three_piece" });
  assert.deepEqual(spec.waistcoat, DEFAULT_WAISTCOAT);
  assert.notEqual(spec.waistcoat, DEFAULT_WAISTCOAT, "the waistcoat is a copy, not the shared default");
  assert.deepEqual(conflicts, [
    {
      field: "waistcoat",
      label: "Waistcoat",
      from: "none",
      to: "Single-breasted, five buttons",
      reason: "A three-piece includes a waistcoat.",
    },
  ]);
});

test("a two-piece removes the waistcoat and reports it as a conflict", () => {
  const threePiece = suit({ garment: "three_piece", waistcoat: { ...DEFAULT_WAISTCOAT } });
  const { spec, conflicts } = apply(threePiece, { garment: "two_piece" });
  assert.equal(spec.waistcoat, null);
  assert.deepEqual(conflicts, [
    {
      field: "waistcoat",
      label: "Waistcoat",
      from: "Single-breasted, five buttons",
      to: "none",
      reason: "A two-piece has no waistcoat.",
    },
  ]);
});

test("a tuxedo removes the waistcoat and names the garment in the reason", () => {
  const threePiece = suit({ garment: "three_piece", waistcoat: { style: "double", lapel: "shawl", back: "cloth" } });
  const { spec, conflicts } = apply(threePiece, { garment: "tuxedo", jacket: { pockets: "jetted" } });
  assert.equal(spec.waistcoat, null);
  assert.deepEqual(conflicts, [
    {
      field: "waistcoat",
      label: "Waistcoat",
      from: "Double-breasted",
      to: "none",
      reason: "A tuxedo has no waistcoat.",
    },
  ]);
});

test("a waistcoat chosen in the same patch as the three-piece is kept as given and not reported", () => {
  const { spec, conflicts } = apply(suit(), {
    garment: "three_piece",
    waistcoat: { style: "single_six", back: "cloth" },
  });
  assert.deepEqual(spec.waistcoat, { style: "single_six", lapel: "none", back: "cloth" });
  assert.deepEqual(conflicts, []);
});

test("a partial waistcoat patch on a three-piece merges field by field", () => {
  const threePiece = suit({ garment: "three_piece", waistcoat: { style: "double", lapel: "shawl", back: "cloth" } });
  const { spec, conflicts } = apply(threePiece, { waistcoat: { back: "lining" } });
  assert.deepEqual(spec.waistcoat, { style: "double", lapel: "shawl", back: "lining" });
  assert.deepEqual(conflicts, []);
});

// Behaviour every call shares.

test("fields the client set in the patch are applied as asked and never reported as conflicts", () => {
  const { spec, conflicts } = apply(
    suit({ jacket: { ticketPocket: true, vents: "single" }, trousers: { hem: "cuffed" } }),
    {
      garment: "tuxedo",
      jacket: { pockets: "jetted", ticketPocket: false, vents: "none" },
      trousers: { hem: "plain" },
    },
  );
  assert.equal(spec.garment, "tuxedo");
  assert.deepEqual(conflicts, []);

  const doubled = apply(suit(), { jacket: { breast: "double", buttons: "six_by_two", lapel: "peak" } });
  assert.deepEqual(doubled.conflicts, []);
});

test("a no-op patch returns an equal spec and no conflicts", () => {
  for (const spec of [suit(), doubleBreasted(), ...LOOKS.map((look) => look.spec)]) {
    const result = apply(spec, {});
    assert.deepEqual(result.spec, spec);
    assert.deepEqual(result.conflicts, []);
  }
});

test("patching a field to the value it already has is a no-op", () => {
  const result = apply(suit(), { garment: "two_piece", jacket: { lapel: "notch" }, trousers: { hem: "plain" } });
  assert.deepEqual(result.spec, suit());
  assert.deepEqual(result.conflicts, []);
});

test("top-level codes and the monogram replace rather than merge", () => {
  const start = suit({ buttonCode: "btn-horn-dark", liningCode: "lin-tonal", monogram: MONOGRAM });
  const { spec, conflicts } = apply(start, {
    clothCode: "jorgecarli-a1-super-140s",
    buttonCode: null,
    liningCode: "lin-bemberg-navy",
    monogram: null,
  });
  assert.equal(spec.clothCode, "jorgecarli-a1-super-140s");
  assert.equal(spec.buttonCode, null);
  assert.equal(spec.liningCode, "lin-bemberg-navy");
  assert.equal(spec.monogram, null);
  assert.deepEqual(conflicts, []);
});

test("applyChange never mutates its input, even when every rule fires", () => {
  const start = deepFreeze(
    suit({
      garment: "three_piece",
      waistcoat: { ...DEFAULT_WAISTCOAT },
      jacket: { vents: "single", ticketPocket: true, lapel: "shawl", buttons: "one" },
      trousers: { hem: "cuffed" },
    }),
  );
  const before = JSON.stringify(start);
  const patches = [
    { garment: "tuxedo" },
    { garment: "two_piece", jacket: { breast: "double" } },
    { jacket: { buttons: "three" } },
    { waistcoat: null },
    { waistcoat: { style: "double" } },
    { monogram: MONOGRAM, clothCode: null },
  ];
  for (const patch of patches) {
    assert.doesNotThrow(() => applyChange(start, patch), `patch ${JSON.stringify(patch)} wrote into a frozen spec`);
  }
  assert.equal(JSON.stringify(start), before);
});

test("every combination of garment and jacket options resolves to a manufacturable spec", () => {
  let runs = 0;
  for (const base of [suit(), lookByKey("dominico").spec]) {
    for (const garment of GARMENTS)
      for (const breast of BREASTS)
        for (const buttons of BUTTON_STANCES)
          for (const lapel of LAPELS)
            for (const pockets of POCKETS)
              for (const vents of VENTS)
                for (const ticketPocket of [true, false])
                  for (const hem of HEMS) {
                    apply(base, {
                      garment,
                      jacket: { breast, buttons, lapel, pockets, vents, ticketPocket },
                      trousers: { hem },
                    });
                    runs += 1;
                  }
  }
  assert.equal(runs, 2 * 3 * 2 * 5 * 3 * 3 * 3 * 2 * 2);
});

test("every single-field change from a valid spec resolves to a manufacturable spec", () => {
  const starts = [suit(), doubleBreasted(), ...LOOKS.map((look) => look.spec)];
  const jacketFields = {
    breast: BREASTS,
    buttons: BUTTON_STANCES,
    lapel: LAPELS,
    vents: VENTS,
    pockets: POCKETS,
    ticketPocket: [true, false],
  };
  for (const start of starts) {
    for (const garment of GARMENTS) apply(start, { garment });
    for (const [key, values] of Object.entries(jacketFields))
      for (const value of values) apply(start, { jacket: { [key]: value } });
    for (const hem of HEMS) apply(start, { trousers: { hem } });
    apply(start, { waistcoat: null });
    apply(start, { waistcoat: { style: "double" } });
  }
});

// allowedOptions.

test("a tuxedo offers only jetted pockets, no or double vents and a plain hem; a two-piece offers everything", () => {
  const tuxedo = allowedOptions(suit({ garment: "tuxedo", jacket: { pockets: "jetted" } }));
  assert.deepEqual(tuxedo.pockets, ["jetted"]);
  assert.deepEqual(tuxedo.vents, ["none", "double"]);
  assert.deepEqual(tuxedo.hems, ["plain"]);
  assert.ok(!tuxedo.pockets.includes("patch"), "patch pockets are never offered on a tuxedo");

  const twoPiece = allowedOptions(suit());
  assert.deepEqual(twoPiece.pockets, POCKETS);
  assert.deepEqual(twoPiece.vents, VENTS);
  assert.deepEqual(twoPiece.hems, HEMS);
  assert.deepEqual(allowedOptions(suit({ garment: "three_piece", waistcoat: DEFAULT_WAISTCOAT })).pockets, POCKETS);
});

test("a double-breasted jacket offers only double stances and a peak lapel, with shawl added on a tuxedo", () => {
  const day = allowedOptions(doubleBreasted());
  assert.deepEqual(day.buttons, DOUBLE_STANCES);
  assert.deepEqual(day.lapels, ["peak"]);

  const tuxedo = allowedOptions(doubleBreasted({ garment: "tuxedo", jacket: { pockets: "jetted" } }));
  assert.deepEqual(tuxedo.buttons, DOUBLE_STANCES);
  assert.deepEqual(tuxedo.lapels, ["peak", "shawl"]);

  const single = allowedOptions(suit());
  assert.deepEqual(single.buttons, SINGLE_STANCES);
  assert.deepEqual(single.lapels, LAPELS);
  assert.deepEqual(allowedOptions(suit({ garment: "tuxedo", jacket: { pockets: "jetted" } })).lapels, LAPELS);
});

// validateSpec.

test("a spec without a cloth cannot be committed, and the default spec says so", () => {
  assert.deepEqual(validateSpec(DEFAULT_SPEC), ["Choose a cloth."]);
  assert.deepEqual(validateSpec(suit({ clothCode: null })), ["Choose a cloth."]);
  assert.deepEqual(validateSpec(suit({ clothCode: "" })), ["Choose a cloth."]);
  assert.deepEqual(validateSpec(suit()), []);
});

test("a monogram must be one to four capital letters or full stops, and blank text is an error", () => {
  const withText = (text) => validateSpec(suit({ monogram: { ...MONOGRAM, text } }));
  assert.deepEqual(withText("N"), []);
  assert.deepEqual(withText("NCS"), []);
  assert.deepEqual(withText("N.S."), []);
  assert.deepEqual(withText(" NS "), [], "surrounding spaces are trimmed before the rules apply");
  assert.deepEqual(withText(""), ["Enter the monogram letters or remove the monogram."]);
  assert.deepEqual(withText("   "), ["Enter the monogram letters or remove the monogram."]);
  assert.deepEqual(withText("NCSAB"), [`A monogram is at most ${ATELIER_LIMITS.monogramMaxChars} characters.`]);
  assert.deepEqual(withText("N.S.X"), [`A monogram is at most ${ATELIER_LIMITS.monogramMaxChars} characters.`]);
  const characters = "A monogram uses capital letters A to Z and full stops only.";
  assert.deepEqual(withText("ncs"), [characters]);
  assert.deepEqual(withText("N S"), [characters]);
  assert.deepEqual(withText("N-S"), [characters]);
  assert.deepEqual(withText("N1"), [characters]);
  assert.deepEqual(withText("ÉN"), [characters]);
  assert.deepEqual(validateSpec(suit({ monogram: null })), []);
});

test("a three-piece needs a waistcoat and nothing else may have one", () => {
  assert.deepEqual(validateSpec(suit({ garment: "three_piece" })), ["A three-piece includes a waistcoat."]);
  assert.deepEqual(validateSpec(suit({ garment: "three_piece", waistcoat: DEFAULT_WAISTCOAT })), []);
  assert.deepEqual(validateSpec(suit({ waistcoat: DEFAULT_WAISTCOAT })), ["Only a three-piece has a waistcoat."]);
  assert.deepEqual(
    validateSpec(suit({ garment: "tuxedo", waistcoat: DEFAULT_WAISTCOAT, jacket: { pockets: "jetted" } })),
    ["Only a three-piece has a waistcoat."],
  );
});

test("the stance must match the front", () => {
  assert.deepEqual(validateSpec(suit({ jacket: { breast: "double", buttons: "two", lapel: "peak" } })), [
    "Double-breasted stance is not valid.",
  ]);
  assert.deepEqual(validateSpec(suit({ jacket: { buttons: "six_by_two" } })), ["Single-breasted stance is not valid."]);
  assert.deepEqual(validateSpec(doubleBreasted()), []);
});

test("validateSpec reports every problem at once", () => {
  const errors = validateSpec({ ...DEFAULT_SPEC, garment: "three_piece", monogram: { ...MONOGRAM, text: "" } });
  assert.deepEqual(errors, [
    "Choose a cloth.",
    "Enter the monogram letters or remove the monogram.",
    "A three-piece includes a waistcoat.",
  ]);
});

// canonicalSpec and specHash.

function reversedKeys(value) {
  if (Array.isArray(value)) return value.map(reversedKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((key) => [key, reversedKeys(value[key])]),
    );
  }
  return value;
}

const FULL = suit({
  garment: "three_piece",
  waistcoat: { style: "double", lapel: "shawl", back: "cloth" },
  jacket: { breast: "double", buttons: "six_by_two", lapel: "peak" },
  buttonCode: "btn-horn-dark",
  liningCode: "lin-bemberg-gold",
  monogram: MONOGRAM,
});

test("the same spec hashes identically whatever order its keys were written in", () => {
  const shuffled = reversedKeys(FULL);
  assert.notEqual(JSON.stringify(shuffled), JSON.stringify(FULL), "the fixture really does differ in key order");
  assert.equal(canonicalSpec(shuffled), canonicalSpec(FULL));
  assert.equal(specHash(shuffled), specHash(FULL));
  assert.equal(specHash(structuredClone(FULL)), specHash(FULL));
});

test("the canonical form sorts keys at every level and round-trips through JSON", () => {
  const canonical = canonicalSpec(FULL);
  const parsed = JSON.parse(canonical);
  assert.deepEqual(parsed, FULL);
  const check = (value) => {
    if (!value || typeof value !== "object") return;
    const keys = Object.keys(value);
    assert.deepEqual(keys, [...keys].sort());
    for (const key of keys) check(value[key]);
  };
  check(parsed);
});

test("the hash is sixteen lowercase hex characters", () => {
  for (const spec of [DEFAULT_SPEC, FULL, ...LOOKS.map((look) => look.spec)]) {
    assert.match(specHash(spec), /^[0-9a-f]{16}$/);
  }
});

test("changing any single field changes the hash, and no two single-field changes collide", () => {
  const alternative = (options, current) => options.find((option) => option !== current);
  const jacketFields = {
    breast: BREASTS,
    buttons: BUTTON_STANCES,
    lapel: LAPELS,
    lapelWidth: LAPEL_WIDTHS,
    vents: VENTS,
    pockets: POCKETS,
    ticketPocket: [true, false],
    canvas: CANVASES,
    shoulder: SHOULDERS,
    sleeveButtons: SLEEVE_BUTTONS,
    workingCuffs: [true, false],
  };
  const trouserFields = { fit: TROUSER_FITS, pleats: PLEATS, rise: RISES, hem: HEMS, waistband: WAISTBANDS };
  const waistcoatFields = { style: WAISTCOAT_STYLES, lapel: WAISTCOAT_LAPELS, back: WAISTCOAT_BACKS };
  const monogramFields = { placement: MONOGRAM_PLACEMENTS, thread: MONOGRAM_THREADS, font: MONOGRAM_FONTS };

  const variants = new Map();
  variants.set("garment", { ...FULL, garment: alternative(GARMENTS, FULL.garment) });
  variants.set("clothCode", { ...FULL, clothCode: "loop-summer" });
  variants.set("clothCode→null", { ...FULL, clothCode: null });
  variants.set("buttonCode", { ...FULL, buttonCode: "btn-mop" });
  variants.set("buttonCode→null", { ...FULL, buttonCode: null });
  variants.set("liningCode", { ...FULL, liningCode: "lin-tonal" });
  variants.set("waistcoat→null", { ...FULL, waistcoat: null });
  variants.set("monogram→null", { ...FULL, monogram: null });
  variants.set("monogram.text", { ...FULL, monogram: { ...MONOGRAM, text: "NCS" } });
  for (const [key, options] of Object.entries(jacketFields)) {
    variants.set(`jacket.${key}`, {
      ...FULL,
      jacket: { ...FULL.jacket, [key]: alternative(options, FULL.jacket[key]) },
    });
  }
  for (const [key, options] of Object.entries(trouserFields)) {
    variants.set(`trousers.${key}`, {
      ...FULL,
      trousers: { ...FULL.trousers, [key]: alternative(options, FULL.trousers[key]) },
    });
  }
  for (const [key, options] of Object.entries(waistcoatFields)) {
    variants.set(`waistcoat.${key}`, {
      ...FULL,
      waistcoat: { ...FULL.waistcoat, [key]: alternative(options, FULL.waistcoat[key]) },
    });
  }
  for (const [key, options] of Object.entries(monogramFields)) {
    variants.set(`monogram.${key}`, {
      ...FULL,
      monogram: { ...FULL.monogram, [key]: alternative(options, FULL.monogram[key]) },
    });
  }

  const baseline = specHash(FULL);
  const seen = new Map([[baseline, "unchanged"]]);
  for (const [name, variant] of variants) {
    assert.notDeepEqual(variant, FULL, `${name}: the variant really differs`);
    const hash = specHash(variant);
    assert.notEqual(hash, baseline, `${name}: changing the field changes the hash`);
    assert.ok(!seen.has(hash), `${name} collides with ${seen.get(hash)}`);
    seen.set(hash, name);
  }
  assert.equal(variants.size, 9 + 11 + 5 + 3 + 3);
});

// describeSpec.

const SECTIONS = ["Garment", "Cloth", "Jacket", "Trousers", "Waistcoat", "Details"];
const FULL_NAMES = {
  cloth: { name: "Zegna Traveller Four Seasons 243", mill: "Ermenegildo Zegna", code: CLOTH },
  button: { name: "Dark horn", code: "btn-horn-dark" },
  lining: { name: "Antique gold Bemberg", code: "lin-bemberg-gold" },
};

function line(lines, section, label) {
  const found = lines.find((candidate) => candidate.section === section && candidate.label === label);
  assert.ok(found, `${section} › ${label} is described`);
  return found;
}

test("every order-book line names a section, a label and a value", () => {
  for (const [spec, names] of [
    [FULL, FULL_NAMES],
    [DEFAULT_SPEC, {}],
    [suit(), undefined],
  ]) {
    const lines = describeSpec(spec, names);
    assert.equal(
      lines.length,
      21 + (spec.waistcoat ? 3 : 0),
      "garment, cloth, eleven jacket, five trouser and three detail lines",
    );
    for (const described of lines) {
      assert.ok(SECTIONS.includes(described.section), `${described.section} is a known section`);
      assert.ok(typeof described.label === "string" && described.label.length > 0);
      assert.ok(typeof described.value === "string" && described.value.length > 0, `${described.label} has a value`);
    }
  }
});

test("every option line carries the production id of the chosen option", () => {
  const lines = describeSpec(FULL, FULL_NAMES);
  const expected = {
    "Garment › Garment": ["Three-piece", "GARMENT_3PC"],
    "Jacket › Front": ["Double-breasted", "BREAST_DB"],
    "Jacket › Buttons": ["Six buttons, two to close", "STANCE_6X2"],
    "Jacket › Lapel": ["Peak lapel", "LAPEL_PEAK"],
    "Jacket › Lapel width": ["Standard", "LAPELW_STD"],
    "Jacket › Vents": ["Double vents", "VENT_DOUBLE"],
    "Jacket › Pockets": ["Flap pockets", "PKT_FLAP"],
    "Jacket › Ticket pocket": ["No", "TKT_NO"],
    "Jacket › Construction": ["Half canvas", "CANVAS_HALF"],
    "Jacket › Shoulder": ["Natural shoulder", "SHLD_NATURAL"],
    "Jacket › Sleeve buttons": ["Four buttons", "CUFF_4"],
    "Jacket › Working cuffs": ["Yes", "CUFF_WORKING"],
    "Trousers › Fit": ["Tailored", "TRS_TAILORED"],
    "Trousers › Front": ["Flat front", "PLEAT_FLAT"],
    "Trousers › Rise": ["Mid rise", "RISE_MID"],
    "Trousers › Hem": ["Plain hem", "HEM_PLAIN"],
    "Trousers › Waistband": ["Side adjusters", "WB_ADJUSTERS"],
    "Waistcoat › Style": ["Double-breasted", "WC_DB"],
    "Waistcoat › Lapel": ["Shawl lapel", "WCL_SHAWL"],
    "Waistcoat › Back": ["Cloth back", "WCB_CLOTH"],
  };
  for (const [path, [value, productionId]] of Object.entries(expected)) {
    const [section, label] = path.split(" › ");
    const described = line(lines, section, label);
    assert.equal(described.value, value, path);
    assert.equal(described.productionId, productionId, path);
  }
  for (const described of lines) {
    assert.ok(
      typeof described.productionId === "string" && described.productionId.length > 0,
      `${described.label} has a production id`,
    );
  }
  const booleans = describeSpec(suit({ jacket: { ticketPocket: true, workingCuffs: false } }));
  assert.equal(line(booleans, "Jacket", "Ticket pocket").productionId, "TKT_YES");
  assert.equal(line(booleans, "Jacket", "Working cuffs").productionId, "CUFF_FIXED");
});

test("a chosen cloth, button and lining are named from the catalogue, with the mill after the cloth", () => {
  const lines = describeSpec(FULL, FULL_NAMES);
  assert.deepEqual(line(lines, "Cloth", "Cloth"), {
    section: "Cloth",
    label: "Cloth",
    value: "Zegna Traveller Four Seasons 243 · Ermenegildo Zegna",
    productionId: CLOTH,
  });
  assert.deepEqual(line(lines, "Details", "Buttons"), {
    section: "Details",
    label: "Buttons",
    value: "Dark horn",
    productionId: "btn-horn-dark",
  });
  assert.deepEqual(line(lines, "Details", "Lining"), {
    section: "Details",
    label: "Lining",
    value: "Antique gold Bemberg",
    productionId: "lin-bemberg-gold",
  });
  const noMill = describeSpec(FULL, { cloth: { name: "Plaid 508", code: "plaid-508" } });
  assert.equal(line(noMill, "Cloth", "Cloth").value, "Plaid 508");
  assert.equal(line(noMill, "Cloth", "Cloth").productionId, "plaid-508");
});

test("codes without catalogue names are shown as the codes themselves", () => {
  const lines = describeSpec(suit({ buttonCode: "btn-mop", liningCode: "lin-tonal" }));
  assert.equal(line(lines, "Cloth", "Cloth").value, CLOTH);
  assert.equal(line(lines, "Cloth", "Cloth").productionId, CLOTH);
  assert.equal(line(lines, "Details", "Buttons").value, "btn-mop");
  assert.equal(line(lines, "Details", "Buttons").productionId, "btn-mop");
  assert.equal(line(lines, "Details", "Lining").value, "lin-tonal");
  assert.equal(line(lines, "Details", "Lining").productionId, "lin-tonal");
});

test("an unchosen cloth reads Not yet chosen, unchosen materials read House choice at fitting, no monogram reads None", () => {
  const lines = describeSpec(DEFAULT_SPEC);
  assert.deepEqual(line(lines, "Cloth", "Cloth"), {
    section: "Cloth",
    label: "Cloth",
    value: "Not yet chosen",
    productionId: undefined,
  });
  assert.equal(line(lines, "Details", "Buttons").value, "House choice at fitting");
  assert.equal(line(lines, "Details", "Buttons").productionId, undefined);
  assert.equal(line(lines, "Details", "Lining").value, "House choice at fitting");
  assert.equal(line(lines, "Details", "Lining").productionId, undefined);
  assert.deepEqual(line(lines, "Details", "Monogram"), {
    section: "Details",
    label: "Monogram",
    value: "None",
    productionId: "MONO_NONE",
  });
});

test("the monogram line carries the text, placement, thread and font, and a combined production id", () => {
  const lines = describeSpec(suit({ monogram: MONOGRAM }));
  assert.deepEqual(line(lines, "Details", "Monogram"), {
    section: "Details",
    label: "Monogram",
    value: "N.S. · Inside pocket · Gold · Script",
    productionId: "MONO_POCKET+THR_GOLD+FONT_SCRIPT",
  });
  const cuff = describeSpec(suit({ monogram: { text: "NCS", placement: "cuff", thread: "tonal", font: "block" } }));
  assert.equal(line(cuff, "Details", "Monogram").value, "NCS · Cuff · Tonal · Block");
  assert.equal(line(cuff, "Details", "Monogram").productionId, "MONO_CUFF+THR_TONAL+FONT_BLOCK");
});

test("waistcoat lines appear only on a three-piece and the sections run in order-book order", () => {
  const twoPiece = describeSpec(suit());
  assert.equal(twoPiece.filter((described) => described.section === "Waistcoat").length, 0);
  const threePiece = describeSpec(FULL);
  assert.deepEqual(
    threePiece.filter((described) => described.section === "Waistcoat").map((described) => described.label),
    ["Style", "Lapel", "Back"],
  );
  const order = [...new Set(threePiece.map((described) => described.section))];
  assert.deepEqual(order, SECTIONS);
  assert.equal(threePiece.length, twoPiece.length + 3);
});

// specSummary and completedStepsFor.

test("specSummary names the garment, the front when double-breasted, the lapel and the cloth", () => {
  assert.equal(specSummary(DEFAULT_SPEC), "Two-piece · notch lapel · no cloth yet");
  assert.equal(specSummary(suit()), `Two-piece · notch lapel · ${CLOTH}`);
  assert.equal(specSummary(suit(), "Loro Piana 365"), "Two-piece · notch lapel · Loro Piana 365");
  assert.equal(specSummary(suit(), null), `Two-piece · notch lapel · ${CLOTH}`);
  assert.equal(
    specSummary(FULL, "Zegna 15 Milmil 15"),
    "Three-piece · double-breasted · peak lapel · Zegna 15 Milmil 15",
  );
  assert.equal(
    specSummary(
      suit({ garment: "tuxedo", jacket: { lapel: "shawl", buttons: "one", pockets: "jetted" } }),
      "Jorgecarli A1",
    ),
    "Tuxedo · shawl lapel · Jorgecarli A1",
  );
});

test("completedStepsFor always counts style, counts cloth and details from the spec, and the rest from the draft facts", () => {
  const nothing = { occasionSet: false, previewDone: false, fitRouteSet: false };
  const everything = { occasionSet: true, previewDone: true, fitRouteSet: true };
  assert.deepEqual(completedStepsFor(DEFAULT_SPEC, nothing), ["style"]);
  assert.deepEqual(completedStepsFor(suit(), nothing), ["cloth", "style"]);
  assert.deepEqual(completedStepsFor(suit({ buttonCode: "btn-mop" }), nothing), ["cloth", "style", "details"]);
  assert.deepEqual(completedStepsFor(suit({ liningCode: "lin-tonal" }), nothing), ["cloth", "style", "details"]);
  assert.deepEqual(completedStepsFor(suit({ monogram: MONOGRAM }), nothing), ["cloth", "style", "details"]);
  assert.deepEqual(completedStepsFor(DEFAULT_SPEC, everything), ["occasion", "style", "preview", "fit"]);
  assert.deepEqual(completedStepsFor(FULL, everything), ["occasion", "cloth", "style", "details", "preview", "fit"]);
  assert.ok(
    !completedStepsFor(FULL, everything).includes("review"),
    "review is never marked complete by the spec alone",
  );
});

// looks.ts

test("every recommended look is a complete, valid spec that the engine would not change", () => {
  assert.ok(LOOKS.length >= 5);
  for (const look of LOOKS) {
    assert.deepEqual(validateSpec(look.spec), [], `${look.key} validates`);
    assertManufacturable(look.spec, look.key);
    const { spec, conflicts } = applyChange(look.spec, {});
    assert.deepEqual(conflicts, [], `${look.key} is already manufacturable`);
    assert.deepEqual(spec, look.spec);
    assert.ok(look.name.length > 0 && look.properName.length > 0 && look.why.length > 20, `${look.key} is explained`);
  }
});

test("every look's cloth, buttons and lining exist in the seeds and suit the look's garment", () => {
  for (const look of LOOKS) {
    assert.ok(clothSeedByCode(look.spec.clothCode), `${look.key}: cloth ${look.spec.clothCode} is in CLOTH_SEED`);
    const button = BUTTON_SEED.find((seed) => seed.code === look.spec.buttonCode);
    assert.ok(button, `${look.key}: button ${look.spec.buttonCode} is in BUTTON_SEED`);
    const lining = LINING_SEED.find((seed) => seed.code === look.spec.liningCode);
    assert.ok(lining, `${look.key}: lining ${look.spec.liningCode} is in LINING_SEED`);
    for (const material of [button, lining]) {
      if (material.garments.length > 0) {
        assert.ok(
          material.garments.includes(look.spec.garment),
          `${look.key}: ${material.code} is offered on a ${look.spec.garment}`,
        );
      }
    }
  }
});

test("look keys are unique and every look names at least one real occasion", () => {
  const keys = LOOKS.map((look) => look.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const look of LOOKS) {
    assert.ok(look.occasions.length > 0, `${look.key} names an occasion`);
    for (const occasion of look.occasions)
      assert.ok(OCCASIONS.includes(occasion), `${look.key}: ${occasion} is an occasion`);
  }
  assert.equal(lookByKey("armada")?.properName, "Armada");
  assert.equal(lookByKey("no-such-look"), undefined);
});

test("looksForOccasion returns only the looks for that occasion, and all of them when nothing or no occasion matches", () => {
  for (const occasion of OCCASIONS) {
    const matching = looksForOccasion(occasion);
    assert.ok(matching.length > 0, `${occasion} has a look`);
    for (const look of matching) assert.ok(look.occasions.includes(occasion), `${look.key} is for ${occasion}`);
    const expected = LOOKS.filter((look) => look.occasions.includes(occasion)).map((look) => look.key);
    assert.deepEqual(
      matching.map((look) => look.key),
      expected,
    );
  }
  assert.deepEqual(
    looksForOccasion("black_tie").map((look) => look.key),
    ["euforia", "dominico"],
  );
  assert.equal(looksForOccasion(undefined), LOOKS);
  assert.equal(looksForOccasion("gala"), LOOKS, "an occasion no look is made for falls back to all of them");
});

// cloths.ts

test("cloth codes are unique and sort orders do not repeat", () => {
  assert.ok(CLOTH_SEED.length >= 20);
  const codes = CLOTH_SEED.map((cloth) => cloth.code);
  assert.equal(new Set(codes).size, codes.length);
  const orders = CLOTH_SEED.map((cloth) => cloth.sortOrder);
  assert.equal(new Set(orders).size, orders.length);
  assert.equal(clothSeedByCode(CLOTH)?.name, "Zegna Traveller Four Seasons 243");
  assert.equal(clothSeedByCode("no-such-cloth"), undefined);
});

test("every cloth hex is a seven-character colour", () => {
  for (const cloth of CLOTH_SEED) {
    assert.equal(cloth.hex.length, 7, `${cloth.code}: ${cloth.hex}`);
    assert.match(cloth.hex, /^#[0-9A-Fa-f]{6}$/, `${cloth.code}: ${cloth.hex}`);
  }
});

test("every cloth's seasons, occasions, weight and pattern come from the shared enums", () => {
  for (const cloth of CLOTH_SEED) {
    assert.ok(cloth.season.length > 0, `${cloth.code} has a season`);
    for (const season of cloth.season)
      assert.ok(SEASONS.includes(season), `${cloth.code}: ${season} is a wardrobe season`);
    assert.ok(cloth.occasions.length > 0, `${cloth.code} has an occasion`);
    for (const occasion of cloth.occasions) assert.ok(OCCASIONS.includes(occasion), `${cloth.code}: ${occasion}`);
    assert.ok(CLOTH_WEIGHTS.includes(cloth.weight), `${cloth.code}: ${cloth.weight}`);
    assert.ok(CLOTH_PATTERNS.includes(cloth.pattern), `${cloth.code}: ${cloth.pattern}`);
  }
});

test("every cloth photograph lives under public/atelier/cloth and the file exists", () => {
  for (const cloth of CLOTH_SEED) {
    assert.ok(cloth.image.startsWith("/atelier/cloth/"), `${cloth.code}: ${cloth.image}`);
    assert.ok(existsSync(join(ROOT, "public", cloth.image)), `${cloth.code}: public${cloth.image} exists`);
  }
});
