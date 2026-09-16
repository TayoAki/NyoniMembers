"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { requireEnv } from "../lib/env";
import { isPackId, PACKS } from "../shared/credits";

/**
 * Verifies the Stripe signature and applies the one effect we care about: a paid checkout session
 * becomes pack credits. Returns false only for a bad signature so the HTTP action can answer 400;
 * everything else is a 200 (Stripe should not retry events we deliberately ignore).
 */
export const handleEvent = internalAction({
  args: { body: v.string(), signature: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { body, signature }) => {
    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
    } catch (error) {
      console.error("Stripe webhook verification failed", error);
      return false;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const clerkUserId = session.metadata?.clerkUserId ?? session.client_reference_id ?? undefined;
        const packId = session.metadata?.packId;
        const pack = packId && isPackId(packId) ? PACKS[packId] : undefined;
        const credits = Number(session.metadata?.credits ?? pack?.credits ?? 0);
        if (clerkUserId && Number.isFinite(credits) && credits > 0) {
          await ctx.runMutation(internal.webhooks.stripe.applyTopup, {
            clerkUserId,
            credits,
            ref: `stripe:${session.id}`,
            note: `Pack ${pack?.name ?? "credits"}`,
          });
        } else {
          console.warn(`Stripe session ${session.id} had no usable credit metadata`);
        }
      }
    }

    return true;
  },
});
