import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ClerkAPIResponseError } from "@clerk/backend/errors";

const fixtureKey = "__nyoniSubscriptionRefresh";
const f = `globalThis.${fixtureKey}`;
const sourceUrl = new URL("../convex/subscriptions.ts", import.meta.url).href;
const mocks = {
  "@clerk/backend": `export function createClerkClient(){return {billing:{getUserBillingSubscription:(id)=>${f}.read(id)}}}`,
  "./_generated/api":
    "export const api={agent:{getContext:'agent.getContext'}};export const internal={credits:{reconcileSubscription:'credits.reconcileSubscription',billingRefreshOwnerForJob:'credits.billingRefreshOwnerForJob'}}",
  "./_generated/server":
    "export const action=(definition)=>definition;export const internalAction=(definition)=>definition;",
  "./lib/env": "export function requireEnv(){return 'sk_test_fixture'}",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === sourceUrl && mocks[specifier]) {
      return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    }
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

const { refresh } = await import("../convex/subscriptions.ts");
const { isAppError } = await import("../convex/lib/errors.ts");

function fixture(read) {
  const mutations = [];
  globalThis[fixtureKey] = { read };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "user_1" }) },
    runMutation: async (reference, args) => {
      mutations.push([reference, args]);
      return true;
    },
    runQuery: async () => null,
  };
  return { ctx, mutations };
}

function clerkError(status, code, message) {
  return new ClerkAPIResponseError(message, { status, data: [{ code, message }] });
}

test("a Clerk instance with billing switched off reconciles the member as a client without a plan", async () => {
  const before = Date.now();
  const { ctx, mutations } = fixture(async () => {
    throw clerkError(403, "billing_not_enabled", "access denied");
  });

  await refresh.handler(ctx, {});

  assert.equal(mutations.length, 1);
  const [reference, { readStartedAt, ...snapshot }] = mutations[0];
  assert.equal(reference, "credits.reconcileSubscription");
  assert.deepEqual(snapshot, { clerkUserId: "user_1", plan: "free", features: [] });
  assert.ok(readStartedAt >= before && readStartedAt <= Date.now());
});

test("any other Clerk failure still asks the member to try again and leaves credits untouched", async () => {
  for (const failure of [clerkError(500, "internal_error", "boom"), new Error("socket hang up")]) {
    const { ctx, mutations } = fixture(async () => {
      throw failure;
    });

    await assert.rejects(
      refresh.handler(ctx, {}),
      (error) =>
        isAppError(error) &&
        error.data.code === "UPSTREAM_FAILED" &&
        error.data.message === "Clerk could not confirm your subscription. Please try again.",
    );
    assert.equal(mutations.length, 0);
  }
});

test("an active plan from Clerk still reconciles with its billing period", async () => {
  const now = Date.now();
  const { ctx, mutations } = fixture(async () => ({
    subscriptionItems: [
      {
        plan: { slug: "pro", features: [{ slug: "sharing" }, { slug: "unknown" }] },
        status: "active",
        periodStart: now - 1_000,
        periodEnd: now + 60_000,
      },
    ],
  }));

  await refresh.handler(ctx, {});

  const [, snapshot] = mutations[0];
  assert.equal(snapshot.plan, "pro");
  assert.deepEqual(snapshot.features, ["sharing"]);
  assert.equal(snapshot.periodStart, now - 1_000);
  assert.equal(snapshot.periodEnd, now + 60_000);
});
