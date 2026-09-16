import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertOwner } from "../lib/auth";
import type { ThreadView } from "../views";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_THREAD_TITLE = "New chat";

export function toThreadView(thread: Doc<"threads">): ThreadView {
  return {
    _id: thread._id,
    title: thread.title,
    eveSessionId: thread.eveSessionId,
    streamIndex: thread.streamIndex,
    lastMessageAt: thread.lastMessageAt,
    createdAt: thread.createdAt,
  };
}

export async function listForUser(ctx: Ctx, userId: Id<"users">): Promise<Doc<"threads">[]> {
  const threads = await ctx.db
    .query("threads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

export async function requireThread(ctx: Ctx, user: Doc<"users">, threadId: Id<"threads">): Promise<Doc<"threads">> {
  return assertOwner(await ctx.db.get(threadId), user, "conversation");
}

export async function createThread(
  ctx: MutationCtx,
  user: Doc<"users">,
  input: { title?: string; eveSessionId?: string } = {},
): Promise<Id<"threads">> {
  const now = Date.now();
  return ctx.db.insert("threads", {
    userId: user._id,
    title: input.title?.trim() || DEFAULT_THREAD_TITLE,
    eveSessionId: input.eveSessionId,
    lastMessageAt: now,
    createdAt: now,
  });
}

/** The thread behind a durable eve session, created on first message. */
export async function resolveByEveSession(
  ctx: MutationCtx,
  user: Doc<"users">,
  eveSessionId: string,
  title?: string,
): Promise<Id<"threads">> {
  const threads = await listForUser(ctx, user._id);
  const existing = threads.find((thread) => thread.eveSessionId === eveSessionId);
  if (existing) {
    await ctx.db.patch(existing._id, { lastMessageAt: Date.now() });
    return existing._id;
  }
  return createThread(ctx, user, { title, eveSessionId });
}

export async function linkSession(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  eveSessionId: string,
  streamIndex: number,
): Promise<void> {
  await ctx.db.patch(thread._id, { eveSessionId, streamIndex, lastMessageAt: Date.now() });
}

export async function removeThread(ctx: MutationCtx, thread: Doc<"threads">): Promise<void> {
  const proposals = await listProposals(ctx, thread._id);
  for (const proposal of proposals) await ctx.db.delete("proposals", proposal._id);
  await ctx.db.delete("threads", thread._id);
}

export async function listProposals(ctx: Ctx, threadId: Id<"threads">): Promise<Doc<"proposals">[]> {
  const proposals = await ctx.db
    .query("proposals")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .order("desc")
    .collect();
  return proposals.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addProposal(
  ctx: MutationCtx,
  user: Doc<"users">,
  threadId: Id<"threads">,
  outfitId: Id<"outfits">,
): Promise<Id<"proposals">> {
  return ctx.db.insert("proposals", { threadId, userId: user._id, outfitId, createdAt: Date.now() });
}
