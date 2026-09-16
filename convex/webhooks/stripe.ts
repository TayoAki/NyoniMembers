import { v } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction, internalMutation, internalQuery } from "../_generated/server";
import { getByClerkId } from "../model/users";
import { topup } from "../model/credits";

/**
 * Stripe → Convex. Signature verification needs the Node SDK, so the HTTP action (Convex runtime)
 * hands the raw body to the internal Node action in `webhooks/stripeNode.ts`. Idempotency is the
 * ledger ref `stripe:<session id>`, so a redelivered event tops nothing up twice.
 */
export const stripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });
  const body = await request.text();
  const verified: boolean = await ctx.runAction(internal.webhooks.stripeNode.handleEvent, { body, signature });
  return verified ? new Response("OK", { status: 200 }) : new Response("Invalid signature", { status: 400 });
});

export const applyTopup = internalMutation({
  args: { clerkUserId: v.string(), credits: v.number(), ref: v.string(), note: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { clerkUserId, credits, ref, note }) => {
    const user = await getByClerkId(ctx, clerkUserId);
    if (!user) {
      console.warn(`Stripe top-up for unknown user ${clerkUserId}`);
      return false;
    }
    return topup(ctx, user, credits, ref, note);
  },
});

/**
 * Lives here rather than in `billing.ts` because that file is `"use node"` and Node files
 * cannot export queries. `billing.createPackCheckout` calls it to confirm the buyer exists.
 */
export const userForCheckout = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(v.object({ userId: v.id("users"), email: v.optional(v.string()) }), v.null()),
  handler: async (ctx, { clerkId }) => {
    const user = await getByClerkId(ctx, clerkId);
    return user ? { userId: user._id, email: user.email } : null;
  },
});
