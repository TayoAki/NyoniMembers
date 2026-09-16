import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { getBalance } from "./model/credits";
import { extractionCreditCost, renderCreditCost } from "./shared/credits";
import { vRenderQuality } from "./shared/validators";
import { vBalance } from "./users";

export const balance = query({
  args: {},
  returns: vBalance,
  handler: async (ctx) => getBalance(await requireUser(ctx)),
});

export const vQuote = v.object({
  credits: v.number(),
  available: v.number(),
  shortfall: v.number(),
  canAfford: v.boolean(),
});

/** How many credits an action would cost against the current balance and daily cap. */
export const quote = query({
  args: {
    request: v.union(
      v.object({
        kind: v.literal("render"),
        quality: vRenderQuality,
        count: v.number(),
        outfits: v.optional(v.number()),
      }),
      v.object({ kind: v.literal("extract"), items: v.number() }),
    ),
  },
  returns: vQuote,
  handler: async (ctx, { request }) => {
    const user = await requireUser(ctx);
    const { total, dailyRemaining } = getBalance(user);
    const credits =
      request.kind === "render"
        ? renderCreditCost(request.quality, request.count, request.outfits ?? 1)
        : extractionCreditCost(request.items);
    const available = Math.min(total, dailyRemaining);
    const shortfall = Math.max(0, credits - available);
    return { credits, available, shortfall, canAfford: shortfall === 0 };
  },
});

export const ledger = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("creditLedger"),
        delta: v.number(),
        bucket: v.union(v.literal("plan"), v.literal("pack")),
        kind: v.string(),
        jobId: v.optional(v.id("jobs")),
        note: v.optional(v.string()),
        balanceAfter: v.number(),
        createdAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const user = await requireUser(ctx);
    const result = await ctx.db
      .query("creditLedger")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((line) => ({
        _id: line._id,
        delta: line.delta,
        bucket: line.bucket,
        kind: line.kind,
        jobId: line.jobId,
        note: line.note,
        balanceAfter: line.balanceAfter,
        createdAt: line.createdAt,
      })),
    };
  },
});
