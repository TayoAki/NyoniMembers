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
const { membershipOf, setMembership } = await import("../convex/model/users.ts");
const { DEFAULT_MEMBERSHIP, MEMBERSHIP_TIERS, SUITS_PER_YEAR, TIER_BENEFITS, TIER_BLURBS, TIER_LABELS } =
  await import("../convex/shared/membership.ts");

function fixture() {
  const patches = [];
  return { patches, ctx: { db: { patch: async (id, patch) => patches.push([id, patch]) } } };
}

test("an account without a recorded membership is a client from the day it was created", () => {
  assert.deepEqual(membershipOf({ _id: "u1", createdAt: 5 }), { ...DEFAULT_MEMBERSHIP, updatedAt: 5 });
  const recorded = { tier: "prestige", status: "active", since: 1, updatedAt: 9 };
  assert.deepEqual(membershipOf({ _id: "u1", createdAt: 5, membership: recorded }), recorded);
});

test("every tier is described for the member", () => {
  for (const tier of MEMBERSHIP_TIERS) {
    assert.ok(TIER_LABELS[tier].length > 0);
    assert.ok(TIER_BLURBS[tier].length > 20);
    assert.ok(TIER_BENEFITS[tier].length >= 3, `${tier} lists its benefits`);
    assert.ok(tier in SUITS_PER_YEAR);
  }
  assert.equal(SUITS_PER_YEAR.signature, 2);
  assert.equal(SUITS_PER_YEAR.prestige, 4);
});

test("setMembership writes the tier once, trims the note and drops unset dates", async () => {
  const f = fixture();
  const result = await setMembership(
    f.ctx,
    { _id: "u1", createdAt: 5 },
    { tier: "signature", status: "active", since: 10, renewsAt: 20, note: "  paid in Charlotte " },
    99,
  );
  assert.deepEqual(result, {
    tier: "signature",
    status: "active",
    since: 10,
    renewsAt: 20,
    note: "paid in Charlotte",
    updatedAt: 99,
  });
  assert.deepEqual(f.patches, [["u1", { membership: result }]]);

  const bare = await setMembership(f.ctx, { _id: "u1", createdAt: 5 }, { tier: "client", status: "active" }, 100);
  assert.deepEqual(bare, { tier: "client", status: "active", updatedAt: 100 });
});

test("a renewal before the start date is rejected without writing", async () => {
  const f = fixture();
  await assert.rejects(
    setMembership(f.ctx, { _id: "u1", createdAt: 5 }, { tier: "prestige", status: "active", since: 20, renewsAt: 10 }),
    (error) => error.data?.code === "INVALID_INPUT",
  );
  assert.deepEqual(f.patches, []);
});
