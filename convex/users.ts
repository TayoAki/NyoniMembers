import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import { getBalance } from "./model/credits";
import { profileFromIdentity, purgeUserBatch, upsertFromProfile } from "./model/users";
import { vFeature, vPlanId, vPrefs } from "./shared/validators";

export const vBalance = v.object({
  plan: vPlanId,
  planCredits: v.number(),
  packCredits: v.number(),
  total: v.number(),
  planPeriodEnd: v.optional(v.number()),
  features: v.array(vFeature),
  dailyRemaining: v.number(),
  lowBalance: v.boolean(),
});

export const vMe = v.object({
  _id: v.id("users"),
  clerkId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  role: v.union(v.literal("user"), v.literal("admin")),
  onboardedAt: v.optional(v.number()),
  defaultAvatarId: v.optional(v.id("avatars")),
  prefs: vPrefs,
  balance: vBalance,
  createdAt: v.number(),
});

/** The signed-in user with their live balance, or null while signed out / not yet stored. */
export const me = query({
  args: {},
  returns: v.union(vMe, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      role: user.role,
      onboardedAt: user.onboardedAt,
      defaultAvatarId: user.defaultAvatarId,
      prefs: user.prefs,
      balance: getBalance(user),
      createdAt: user.createdAt,
    };
  },
});

/** Idempotent: called by the client after sign-in so the user exists before any other call. */
export const ensure = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("UNAUTHENTICATED", "Sign in to continue.");
    const user = await upsertFromProfile(ctx, profileFromIdentity(identity));
    return user._id;
  },
});

export const updatePrefs = mutation({
  args: { prefs: vPrefs },
  returns: v.null(),
  handler: async (ctx, { prefs }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { prefs });
    return null;
  },
});

/** Finish onboarding once at least one avatar exists. */
export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const avatar = await ctx.db
      .query("avatars")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!avatar) throw appError("INVALID_INPUT", "Add at least one photo of yourself first.");
    if (!user.onboardedAt) await ctx.db.patch(user._id, { onboardedAt: Date.now() });
    return null;
  },
});

/** Wipes every document and file the user owns, then the user itself. Runs in scheduled batches so a big wardrobe fits. */
export const deleteAllData = mutation({
  args: { confirm: v.literal("DELETE") },
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId: user._id });
    return null;
  },
});

/** One transaction's worth of deletion, rescheduling itself until nothing of the user is left. */
export const purgeUserData = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const done = await purgeUserBatch(ctx, userId);
    if (done) {
      await ctx.db.delete("users", userId);
    } else {
      await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId });
    }
    return null;
  },
});
