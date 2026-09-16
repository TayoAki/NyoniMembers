import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import {
  createOutfit,
  listForUser,
  markOutfitWorn,
  removeOutfit,
  requireOutfit,
  toOutfitView,
  updateOutfit,
  validateSlots,
} from "./model/outfits";
import { vOutfitSlots } from "./shared/validators";
import { vOutfitView } from "./views";

export const list = query({
  args: { source: v.optional(v.union(v.literal("manual"), v.literal("agent"))) },
  returns: v.array(vOutfitView),
  handler: async (ctx, { source }) => {
    const user = await requireUser(ctx);
    const outfits = await listForUser(ctx, user._id, source);
    return Promise.all(outfits.map((outfit) => toOutfitView(ctx, outfit)));
  },
});

export const get = query({
  args: { outfitId: v.id("outfits") },
  returns: v.union(vOutfitView, v.null()),
  handler: async (ctx, { outfitId }) => {
    const user = await requireUser(ctx);
    const outfit = await ctx.db.get(outfitId);
    if (!outfit || outfit.userId !== user._id) return null;
    return toOutfitView(ctx, outfit);
  },
});

/** Validates every slot id belongs to the user and matches the slot's categories (SLOT_CATEGORIES). */
export const create = mutation({
  args: { name: v.string(), slots: vOutfitSlots, occasion: v.optional(v.string()) },
  returns: v.id("outfits"),
  handler: async (ctx, { name, slots, occasion }) => {
    const user = await requireUser(ctx);
    await validateSlots(ctx, user, slots);
    return createOutfit(ctx, user, { name, slots, occasion });
  },
});

export const update = mutation({
  args: {
    outfitId: v.id("outfits"),
    patch: v.object({
      name: v.optional(v.string()),
      slots: v.optional(vOutfitSlots),
      occasion: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { outfitId, patch }) => {
    const user = await requireUser(ctx);
    const outfit = await requireOutfit(ctx, user, outfitId);
    if (patch.slots) await validateSlots(ctx, user, patch.slots);
    await updateOutfit(ctx, outfit, patch);
    return null;
  },
});

/** Deletes the outfit and its renders (files included). */
export const remove = mutation({
  args: { outfitId: v.id("outfits") },
  returns: v.null(),
  handler: async (ctx, { outfitId }) => {
    const user = await requireUser(ctx);
    const outfit = await requireOutfit(ctx, user, outfitId);
    await removeOutfit(ctx, outfit);
    return null;
  },
});

/** Adds a worn date and bumps wearCount / lastWornAt on every item in the outfit. */
export const markWorn = mutation({
  args: { outfitId: v.id("outfits"), wornAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { outfitId, wornAt }) => {
    const user = await requireUser(ctx);
    const outfit = await requireOutfit(ctx, user, outfitId);
    await markOutfitWorn(ctx, outfit, wornAt ?? Date.now());
    return null;
  },
});
