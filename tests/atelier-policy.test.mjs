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

const { CONSENT_VERSION, HOUSE_POLICY, PHOTO_CONSENT, PROVIDER_DISCLOSURE_VERSION, eventReadiness } =
  await import("../convex/shared/atelier/policy.ts");
const { ATELIER_LIMITS } = await import("../convex/shared/atelier/enums.ts");

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 18, 12);
const daysOut = (days) => NOW + days * DAY;
const BUFFER = ATELIER_LIMITS.eventBufferDays;

test("an event ninety days out is comfortable, counted in weeks, and quotes the house lead time", () => {
  const readiness = eventReadiness(daysOut(90), NOW);
  assert.equal(readiness.state, "comfortable");
  assert.equal(readiness.daysLeft, 90);
  assert.ok(readiness.copy.startsWith("About 13 weeks until your date."), readiness.copy);
  assert.ok(readiness.copy.endsWith(HOUSE_POLICY.verified.leadTime), readiness.copy);
});

test("an event forty-five days out is tight, counted in days, and asks for a first fitting soon", () => {
  const readiness = eventReadiness(daysOut(45), NOW);
  assert.equal(readiness.state, "tight");
  assert.equal(readiness.daysLeft, 45);
  assert.ok(readiness.copy.startsWith("45 days until your date. A first fitting is needed soon; "), readiness.copy);
  assert.ok(
    readiness.copy.endsWith("rush timelines can sometimes be arranged for weddings and special events."),
    readiness.copy,
  );
  assert.ok(!readiness.copy.includes("; Rush"), "the house's rush sentence is lowered to continue the clause");
});

test("an event ten days out is unlikely and says it sits inside the usual six weeks", () => {
  const readiness = eventReadiness(daysOut(10), NOW);
  assert.equal(readiness.state, "unlikely");
  assert.equal(readiness.daysLeft, 10);
  assert.equal(
    readiness.copy,
    "10 days until your date is inside the usual six weeks. Your concierge will tell you honestly what is possible before anything is promised.",
  );
});

test("no event date means no readiness state, no day count and no copy", () => {
  assert.deepEqual(eventReadiness(undefined, NOW), { state: "none", daysLeft: null, copy: "" });
});

test("the readiness thresholds sit two weeks above and one week below the six-week buffer", () => {
  assert.equal(BUFFER, 42);
  assert.equal(eventReadiness(daysOut(BUFFER + 14), NOW).state, "comfortable");
  assert.equal(eventReadiness(daysOut(BUFFER + 13), NOW).state, "tight");
  assert.equal(eventReadiness(daysOut(BUFFER), NOW).state, "tight");
  assert.equal(eventReadiness(daysOut(BUFFER - 7), NOW).state, "tight");
  assert.equal(eventReadiness(daysOut(BUFFER - 8), NOW).state, "unlikely");
  assert.equal(eventReadiness(daysOut(0), NOW).state, "unlikely");
});

test("part days are counted up, so an event later today still shows one day", () => {
  assert.equal(eventReadiness(NOW + 3_600_000, NOW).daysLeft, 1);
  assert.equal(eventReadiness(daysOut(45) - 1, NOW).daysLeft, 45);
  assert.equal(eventReadiness(daysOut(45) + 1, NOW).daysLeft, 46);
});

test("the comfortable copy rounds the weeks to the nearest whole week", () => {
  assert.ok(eventReadiness(daysOut(56), NOW).copy.startsWith("About 8 weeks"));
  assert.ok(eventReadiness(daysOut(60), NOW).copy.startsWith("About 9 weeks"));
  assert.ok(eventReadiness(daysOut(365), NOW).copy.startsWith("About 52 weeks"));
});

test("the consent version and provider disclosure version are set, non-empty strings", () => {
  assert.equal(typeof CONSENT_VERSION, "string");
  assert.ok(CONSENT_VERSION.trim().length > 0);
  assert.equal(typeof PROVIDER_DISCLOSURE_VERSION, "string");
  assert.ok(PROVIDER_DISCLOSURE_VERSION.trim().length > 0);
  assert.notEqual(CONSENT_VERSION, PROVIDER_DISCLOSURE_VERSION);
});

test("the proposed policy numbers are the shared limits, and the consent copy quotes the retention period", () => {
  assert.equal(HOUSE_POLICY.proposed.photoRetentionDays, ATELIER_LIMITS.previewResultDays);
  assert.equal(HOUSE_POLICY.proposed.quoteValidDays, ATELIER_LIMITS.quoteValidDays);
  assert.equal(HOUSE_POLICY.proposed.eventBufferDays, ATELIER_LIMITS.eventBufferDays);
  assert.ok(PHOTO_CONSENT.retention.includes(`${ATELIER_LIMITS.previewResultDays} days`), PHOTO_CONSENT.retention);
});

test("every verified house fact and every consent line is non-empty copy", () => {
  for (const [key, value] of Object.entries(HOUSE_POLICY.verified)) {
    assert.ok(typeof value === "string" && value.trim().length > 0, `verified.${key}`);
  }
  for (const key of ["title", "what", "provider", "retention", "notUsedFor"]) {
    assert.ok(PHOTO_CONSENT[key].trim().length > 0, key);
  }
  for (const key of ["limits", "suitable", "unsuitable"]) {
    assert.ok(PHOTO_CONSENT[key].length > 0, key);
    for (const item of PHOTO_CONSENT[key]) assert.ok(item.trim().length > 0, key);
  }
  assert.ok(HOUSE_POLICY.verified.leadTime.includes("six weeks"));
  assert.ok(PHOTO_CONSENT.provider.includes("OpenAI"));
});
