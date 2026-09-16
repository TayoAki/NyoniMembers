import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { toOutfitView } from "./model/outfits";
import {
  createThread,
  linkSession as linkThreadSession,
  listForUser,
  listProposals,
  removeThread,
  requireThread,
  toThreadView,
} from "./model/threads";
import { vOutfitView, vThreadView } from "./views";

export const list = query({
  args: {},
  returns: v.array(vThreadView),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return (await listForUser(ctx, user._id)).map(toThreadView);
  },
});

export const get = query({
  args: { threadId: v.id("threads") },
  returns: v.union(vThreadView, v.null()),
  handler: async (ctx, { threadId }) => {
    const user = await requireUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return null;
    return toThreadView(thread);
  },
});

export const create = mutation({
  args: { title: v.optional(v.string()) },
  returns: v.id("threads"),
  handler: async (ctx, { title }) => {
    const user = await requireUser(ctx);
    return createThread(ctx, user, { title });
  },
});

/** Called from `useEveAgent`'s `onSessionChange` so a reload can resume the durable eve session. */
export const linkSession = mutation({
  args: { threadId: v.id("threads"), eveSessionId: v.string(), streamIndex: v.number() },
  returns: v.null(),
  handler: async (ctx, { threadId, eveSessionId, streamIndex }) => {
    const user = await requireUser(ctx);
    const thread = await requireThread(ctx, user, threadId);
    await linkThreadSession(ctx, thread, eveSessionId, streamIndex);
    return null;
  },
});

export const rename = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId, title }) => {
    const user = await requireUser(ctx);
    const thread = await requireThread(ctx, user, threadId);
    await ctx.db.patch(thread._id, { title: title.trim() || thread.title });
    return null;
  },
});

export const remove = mutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const user = await requireUser(ctx);
    const thread = await requireThread(ctx, user, threadId);
    await removeThread(ctx, thread);
    return null;
  },
});

/** Outfits the stylist proposed in this thread, newest first, with any render job attached. */
export const proposals = query({
  args: { threadId: v.id("threads") },
  returns: v.array(
    v.object({ _id: v.id("proposals"), outfit: vOutfitView, jobId: v.optional(v.id("jobs")), createdAt: v.number() }),
  ),
  handler: async (ctx, { threadId }) => {
    const user = await requireUser(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) return [];
    const rows = await listProposals(ctx, thread._id);
    const views = await Promise.all(
      rows.map(async (row) => {
        const outfit = await ctx.db.get(row.outfitId);
        if (!outfit || outfit.userId !== user._id) return null;
        return { _id: row._id, outfit: await toOutfitView(ctx, outfit), jobId: row.jobId, createdAt: row.createdAt };
      }),
    );
    return views.filter((view): view is NonNullable<typeof view> => view !== null);
  },
});
