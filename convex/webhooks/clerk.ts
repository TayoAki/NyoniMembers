import { v } from "convex/values";
import { Webhook } from "svix";
import { internal } from "../_generated/api";
import { httpAction, internalMutation } from "../_generated/server";
import { requireEnv } from "../lib/env";
import { grantPlan } from "../model/credits";
import { getByClerkId, roleFromClerkMetadata, upsertFromProfile } from "../model/users";
import { isPlanId, type PlanId } from "../shared/credits";
import { vPlanId } from "../shared/validators";

/**
 * Clerk → Convex sync. svix runs in the Convex runtime, so the signature is verified inside the
 * HTTP action and the effects run as internal mutations. Plan grants are idempotent by the
 * `clerk:<svix-id>` ledger ref, so a redelivered event is a no-op.
 */
export const clerkWebhook = httpAction(async (ctx, request) => {
  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  let event: ClerkEvent;
  try {
    new Webhook(requireEnv("CLERK_WEBHOOK_SIGNING_SECRET")).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    event = JSON.parse(payload) as ClerkEvent;
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const data = event.data ?? {};
  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const clerkId = asString(data.id);
      if (!clerkId) break;
      await ctx.runMutation(internal.webhooks.clerk.syncUser, {
        clerkId,
        email: primaryEmail(data),
        name: fullName(data),
        imageUrl: asString(data.image_url),
        role: roleFromClerkMetadata(data.public_metadata),
      });
      break;
    }
    case "user.deleted": {
      const clerkId = asString(data.id);
      if (clerkId) await ctx.runMutation(internal.webhooks.clerk.purgeUser, { clerkId });
      break;
    }
    case "subscriptionItem.active": {
      const clerkUserId = payerUserId(data);
      if (!clerkUserId) break;
      await ctx.runMutation(internal.webhooks.clerk.applyPlan, {
        clerkUserId,
        plan: planFromItem(data),
        ref: `clerk:${svixId}`,
        planPeriodEnd: toMillis(data.period_end),
      });
      break;
    }
    case "subscriptionItem.ended": {
      const clerkUserId = payerUserId(data);
      if (!clerkUserId) break;
      await ctx.runMutation(internal.webhooks.clerk.applyPlan, {
        clerkUserId,
        plan: "free",
        ref: `clerk:${svixId}`,
      });
      break;
    }
    case "subscriptionItem.canceled":
    case "subscriptionItem.upcoming":
    case "subscriptionItem.pastDue":
    case "paymentAttempt.created":
    case "paymentAttempt.updated":
      // Nothing to settle: the ledger only moves on `active` (grant) and `ended` (downgrade).
      console.log(`Clerk ${event.type} for payer ${payerUserId(data) ?? "unknown"}`);
      break;
    default:
      break;
  }

  return new Response("OK", { status: 200 });
});

export const syncUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertFromProfile(ctx, args);
    return null;
  },
});

/** Clerk deleted the account: wipe everything we hold, in the same batched purge the user can trigger. */
export const purgeUser = internalMutation({
  args: { clerkId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkId }) => {
    const user = await getByClerkId(ctx, clerkId);
    if (!user) return null;
    await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId: user._id });
    return null;
  },
});

export const applyPlan = internalMutation({
  args: { clerkUserId: v.string(), plan: vPlanId, ref: v.string(), planPeriodEnd: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, { clerkUserId, plan, ref, planPeriodEnd }) => {
    const user = await getByClerkId(ctx, clerkUserId);
    if (!user) {
      console.warn(`Clerk plan event for unknown user ${clerkUserId}`);
      return false;
    }
    return grantPlan(ctx, user, plan, ref, planPeriodEnd);
  },
});

type ClerkEvent = { type?: string; data?: Record<string, unknown> };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function primaryEmail(data: Record<string, unknown>): string | undefined {
  const addresses = data.email_addresses;
  if (!Array.isArray(addresses)) return undefined;
  const first = addresses[0];
  if (typeof first !== "object" || first === null) return undefined;
  return asString((first as { email_address?: unknown }).email_address);
}

function fullName(data: Record<string, unknown>): string | undefined {
  const name = [asString(data.first_name), asString(data.last_name)].filter(Boolean).join(" ").trim();
  return name || undefined;
}

/** B2C only: Fitcheck bills users, never organizations. */
function payerUserId(data: Record<string, unknown>): string | undefined {
  const payer = data.payer;
  if (typeof payer !== "object" || payer === null) return undefined;
  return asString((payer as { user_id?: unknown }).user_id);
}

/** `subscriptionItem.*` carries its plan directly; Clerk's default `free_user` maps to our `free`. */
function planFromItem(data: Record<string, unknown>): PlanId {
  const plan = data.plan;
  const slug = typeof plan === "object" && plan !== null ? asString((plan as { slug?: unknown }).slug) : undefined;
  return slug && isPlanId(slug) ? slug : "free";
}

/** Clerk sends unix seconds on billing objects; everything in our schema is milliseconds. */
function toMillis(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
}
