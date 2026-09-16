import { httpRouter } from "convex/server";
import { clerkWebhook } from "./webhooks/clerk";
import { stripeWebhook } from "./webhooks/stripe";

/**
 * Webhook entry points. Signature verification and idempotent ledger writes live in
 * webhooks/clerk.ts and webhooks/stripe.ts; the routes stay thin.
 */
const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: clerkWebhook,
});

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: stripeWebhook,
});

export default http;
