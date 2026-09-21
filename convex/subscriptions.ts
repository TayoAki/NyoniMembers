"use node";

import { createClerkClient, type BillingSubscription } from "@clerk/backend";
import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireEnv } from "./lib/env";
import { appError } from "./lib/errors";
import { FEATURES, isPlanId, PLANS, type Feature, type PlanId } from "./shared/credits";

/** Clerk is authoritative; clients cannot supply a plan, features, allowance or billing period. */
export const refresh = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("UNAUTHENTICATED", "Sign in to refresh your subscription.");
    await refreshUserSubscription(ctx, identity.subject);
    return null;
  },
});

export const refreshForAgent = action({
  args: { serviceKey: v.string(), clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(api.agent.getContext, args);
    await refreshUserSubscription(ctx, args.clerkUserId);
    return null;
  },
});

export const refreshForJob = internalAction({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const clerkUserId = await ctx.runQuery(internal.credits.billingRefreshOwnerForJob, { jobId });
    if (clerkUserId) await refreshUserSubscription(ctx, clerkUserId);
    return null;
  },
});

/**
 * Membership is set by the house, so billing stays switched off on the Clerk instance and Clerk
 * answers every subscription read with `billing_not_enabled`. That is "no subscription", not an outage.
 */
function isBillingDisabled(error: unknown): boolean {
  return isClerkAPIResponseError(error) && error.errors.some((item) => item.code === "billing_not_enabled");
}

async function refreshUserSubscription(ctx: ActionCtx, clerkUserId: string): Promise<void> {
  const readStartedAt = Date.now();
  const clerk = createClerkClient({ secretKey: requireEnv("CLERK_SECRET_KEY") });
  let subscription: BillingSubscription | null;
  try {
    subscription = await clerk.billing.getUserBillingSubscription(clerkUserId);
  } catch (error) {
    if (!isBillingDisabled(error)) {
      throw appError("UPSTREAM_FAILED", "Clerk could not confirm your subscription. Please try again.");
    }
    subscription = null;
  }
  const now = Date.now();
  const current = (subscription?.subscriptionItems ?? [])
    .filter((item) => {
      const slug = item.plan?.slug;
      return (
        slug !== undefined &&
        isPlanId(slug) &&
        slug !== "free" &&
        (item.status === "active" || item.status === "canceled") &&
        item.periodStart <= now &&
        (item.periodEnd === null || item.periodEnd > now)
      );
    })
    .sort((a, b) => {
      const aSlug = a.plan?.slug;
      const bSlug = b.plan?.slug;
      const aPrice = aSlug && isPlanId(aSlug) ? PLANS[aSlug].priceUsd : 0;
      const bPrice = bSlug && isPlanId(bSlug) ? PLANS[bSlug].priceUsd : 0;
      return bPrice - aPrice || b.periodStart - a.periodStart;
    })[0];
  const slug = current?.plan?.slug;
  const plan: PlanId = slug && isPlanId(slug) ? slug : "free";
  if (current && (!current.periodEnd || !Number.isFinite(current.periodStart))) {
    throw appError("UPSTREAM_FAILED", "Clerk returned an incomplete billing period. Please try again.");
  }
  const features: Feature[] = (current?.plan?.features ?? [])
    .map((feature) => feature.slug)
    .filter((feature): feature is Feature => FEATURES.some((known) => known === feature));
  await ctx.runMutation(internal.credits.reconcileSubscription, {
    clerkUserId,
    readStartedAt,
    plan,
    features,
    ...(current ? { periodStart: current.periodStart, periodEnd: current.periodEnd ?? undefined } : {}),
  });
}
