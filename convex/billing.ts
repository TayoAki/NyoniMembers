"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireEnv } from "./lib/env";
import { appError } from "./lib/errors";
import { PACKS } from "./shared/credits";
import { vPackId } from "./shared/validators";

/**
 * Creates a Stripe Checkout session for a credit pack (PACKS[packId]) with
 * metadata { clerkUserId, packId, credits } and success/cancel URLs on SITE_URL/billing.
 * The whole file runs in Node because the Stripe SDK needs it; the buyer is looked up through
 * `internal.webhooks.stripe.userForCheckout` since a Node file cannot export queries.
 */
export const createPackCheckout = action({
  args: { packId: vPackId },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { packId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("UNAUTHENTICATED", "Sign in to continue.");
    const buyer = await ctx.runQuery(internal.webhooks.stripe.userForCheckout, { clerkId: identity.subject });
    if (!buyer) throw appError("UNAUTHENTICATED", "Your account is still being set up. Try again in a moment.");

    const pack = PACKS[packId];
    const siteUrl = requireEnv("SITE_URL").replace(/\/$/, "");
    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pack.priceUsd * 100),
            product_data: { name: `${pack.name} — ${pack.credits} Fitcheck credits` },
          },
        },
      ],
      metadata: { clerkUserId: identity.subject, packId, credits: String(pack.credits) },
      client_reference_id: identity.subject,
      ...(buyer.email ? { customer_email: buyer.email } : {}),
      success_url: `${siteUrl}/billing?checkout=success`,
      cancel_url: `${siteUrl}/billing?checkout=cancelled`,
    });

    if (!session.url) throw appError("UPSTREAM_FAILED", "Stripe didn't return a checkout link. Try again.");
    return { url: session.url };
  },
});
