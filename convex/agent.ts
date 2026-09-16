import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { vQuote } from "./credits";
import { requireServiceUser } from "./lib/auth";
import { listForUser as listAvatars } from "./model/avatars";
import { getBalance } from "./model/credits";
import { listForUser as listItems } from "./model/items";
import { createOutfit, requireOutfit, resolveSlotItems, toItemSummary, validateSlots } from "./model/outfits";
import { startRenderJob } from "./model/renders";
import { addProposal, resolveByEveSession } from "./model/threads";
import { bumpUsageCounter } from "./model/users";
import { LIMITS, renderCreditCost } from "./shared/credits";
import { vCategory, vOutfitSlots, vPrefs, vRenderQuality, vSeason } from "./shared/validators";
import { vBalance } from "./users";
import { vItemSummary, type ItemSummary } from "./views";

/**
 * Service surface for the eve stylist. Every function takes `serviceKey` (AGENT_SERVICE_KEY) and
 * the Clerk user id the agent acts for; `requireServiceUser` verifies both. Nothing here is
 * callable from the browser without the key, and every read/write is scoped to that user.
 */
const vService = { serviceKey: v.string(), clerkUserId: v.string() };

/** Compact wardrobe for the model's context window. */
export const vWardrobeItem = v.object({
  id: v.id("items"),
  name: v.string(),
  category: vCategory,
  subcategory: v.string(),
  colours: v.array(v.string()),
  pattern: v.string(),
  material: v.string(),
  season: v.array(vSeason),
  formality: v.string(),
  wearCount: v.number(),
  lastWornAt: v.optional(v.number()),
});

export const getWardrobe = query({
  args: { ...vService, category: v.optional(vCategory), season: v.optional(vSeason) },
  returns: v.array(vWardrobeItem),
  handler: async (ctx, { serviceKey, clerkUserId, category, season }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    const items = await listItems(ctx, user._id, { status: "ready", category });
    return items
      .filter((item) => !season || item.season.includes(season))
      .map((item) => ({
        id: item._id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        colours: [item.colours.primary, ...item.colours.secondary].filter(Boolean),
        pattern: item.pattern,
        material: item.material,
        season: item.season,
        formality: item.formality,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
      }));
  },
});

export const getContext = query({
  args: vService,
  returns: v.object({ name: v.optional(v.string()), prefs: vPrefs, balance: vBalance, avatarCount: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireServiceUser(ctx, args);
    const avatars = await listAvatars(ctx, user._id);
    return { name: user.name, prefs: user.prefs, balance: getBalance(user), avatarCount: avatars.length };
  },
});

/** Finds or creates the Convex thread for an eve session so proposals and renders attach to it. */
export const resolveThread = mutation({
  args: { ...vService, eveSessionId: v.string(), title: v.optional(v.string()) },
  returns: v.id("threads"),
  handler: async (ctx, { serviceKey, clerkUserId, eveSessionId, title }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    return resolveByEveSession(ctx, user, eveSessionId, title);
  },
});

/**
 * Validates the model's picks (ownership, one item per slot, slot/category match) and stores them
 * as `outfits` with source "agent" plus a `proposals` row. Invalid outfits come back with `problems`.
 */
export const composeOutfits = mutation({
  args: {
    ...vService,
    threadId: v.id("threads"),
    brief: v.string(),
    outfits: v.array(
      v.object({ name: v.string(), slots: vOutfitSlots, reasoning: v.string(), occasion: v.optional(v.string()) }),
    ),
  },
  returns: v.array(
    v.object({
      outfitId: v.union(v.id("outfits"), v.null()),
      name: v.string(),
      items: v.array(vItemSummary),
      problems: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { serviceKey, clerkUserId, threadId, brief, outfits }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      return outfits.map((outfit) => ({
        outfitId: null,
        name: outfit.name,
        items: [] as ItemSummary[],
        problems: ["that conversation doesn't exist"],
      }));
    }

    const results: Array<{ outfitId: Id<"outfits"> | null; name: string; items: ItemSummary[]; problems: string[] }> =
      [];
    for (const candidate of outfits) {
      const problems = await validateSlots(ctx, user, candidate.slots, true);
      const map = await resolveSlotItems(ctx, candidate.slots);
      const items = await Promise.all([...map.values()].map((item) => toItemSummary(ctx, item)));
      if (problems.length > 0) {
        results.push({ outfitId: null, name: candidate.name, items: [], problems });
        continue;
      }
      const outfitId = await createOutfit(ctx, user, {
        name: candidate.name,
        slots: candidate.slots,
        occasion: candidate.occasion,
        brief,
        reasoning: candidate.reasoning,
        source: "agent",
        threadId: thread._id,
      });
      await addProposal(ctx, user, thread._id, outfitId);
      await ctx.db.patch(thread._id, { lastMessageAt: Date.now() });
      results.push({ outfitId, name: candidate.name, items, problems: [] });
    }
    return results;
  },
});

export const quoteRenders = query({
  args: { ...vService, outfitIds: v.array(v.id("outfits")), perOutfit: v.number(), quality: vRenderQuality },
  returns: vQuote,
  handler: async (ctx, { serviceKey, clerkUserId, outfitIds, perOutfit, quality }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    const { total, dailyRemaining } = getBalance(user);
    const outfits = Math.max(1, new Set(outfitIds).size);
    const credits = renderCreditCost(quality, Math.max(1, Math.trunc(perOutfit)), outfits);
    const available = Math.min(total, dailyRemaining);
    const shortfall = Math.max(0, credits - available);
    return { credits, available, shortfall, canAfford: shortfall === 0 };
  },
});

/** Same rules as renders.start, attaches the job to the thread's proposals. */
export const startRenders = mutation({
  args: {
    ...vService,
    threadId: v.id("threads"),
    outfitIds: v.array(v.id("outfits")),
    perOutfit: v.number(),
    quality: vRenderQuality,
  },
  returns: v.object({ jobId: v.id("jobs"), renderIds: v.array(v.id("renders")) }),
  handler: async (ctx, { serviceKey, clerkUserId, threadId, outfitIds, perOutfit, quality }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    const thread = await ctx.db.get(threadId);
    return startRenderJob(ctx, user, {
      outfitIds,
      count: perOutfit,
      quality,
      threadId: thread && thread.userId === user._id ? thread._id : undefined,
    });
  },
});

/** Promotes an agent proposal to a saved outfit (source stays "agent", but it now shows in /outfits). */
export const saveOutfit = mutation({
  args: { ...vService, outfitId: v.id("outfits"), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { serviceKey, clerkUserId, outfitId, name }) => {
    const user = await requireServiceUser(ctx, { serviceKey, clerkUserId });
    const outfit = await requireOutfit(ctx, user, outfitId);
    await ctx.db.patch(outfit._id, { name: name?.trim() || outfit.name, updatedAt: Date.now() });
    return null;
  },
});

/** Bumps the stylist message counter; throws RATE_LIMITED past LIMITS.stylistMessagesPerDay. */
export const recordMessage = mutation({
  args: vService,
  returns: v.object({ remainingToday: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireServiceUser(ctx, args);
    const remainingToday = await bumpUsageCounter(ctx, user._id, "stylist", LIMITS.stylistMessagesPerDay);
    return { remainingToday };
  },
});
