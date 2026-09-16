import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { appError } from "../lib/errors";
import { getByClerkId, upsertFromProfile } from "../model/users";
import { createBatch } from "../model/uploads";
import { startRenderJob } from "../model/renders";
import { createOutfit } from "../model/outfits";
import { toJobView, vJob } from "../jobs";
import { vItemView } from "../views";
import { listByUpload, toItemViews } from "../model/items";
import { listByJob } from "../model/renders";
import { vRenderQuality } from "../shared/validators";

/**
 * Dev-only helpers for exercising the pipelines without a browser or Clerk session.
 * They are `internal*`, so only the CLI / dashboard can call them:
 *
 *   npx convex run dev/smoke:seedUser '{"clerkId":"smoke"}'
 *   npx convex run dev/smoke:uploadUrl            → POST the photo there, keep the storageId
 *   npx convex run dev/smoke:ingest '{"clerkId":"smoke","storageId":"...","fileName":"a.png","mimeType":"image/png","sizeBytes":123}'
 *   npx convex run dev/smoke:job '{"jobId":"..."}'  (repeat until status is terminal)
 */

export const seedUser = internalMutation({
  args: { clerkId: v.string(), admin: v.optional(v.boolean()) },
  returns: v.id("users"),
  handler: async (ctx, { clerkId, admin }) => {
    const user = await upsertFromProfile(ctx, {
      clerkId,
      email: `${clerkId}@example.test`,
      name: `Smoke ${clerkId}`,
      role: admin ? "admin" : "user",
    });
    if (!user.onboardedAt) await ctx.db.patch(user._id, { onboardedAt: Date.now() });
    return user._id;
  },
});

export const uploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const addAvatar = internalMutation({
  args: { clerkId: v.string(), storageId: v.id("_storage") },
  returns: v.id("avatars"),
  handler: async (ctx, { clerkId, storageId }) => {
    const user = await requireSmokeUser(ctx, clerkId);
    const avatarId = await ctx.db.insert("avatars", {
      userId: user._id,
      storageId,
      label: "Smoke",
      isDefault: true,
      createdAt: Date.now(),
    });
    await ctx.db.patch(user._id, { defaultAvatarId: avatarId });
    return avatarId;
  },
});

export const ingest = internalMutation({
  args: {
    clerkId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
  },
  returns: v.object({
    batchId: v.string(),
    uploads: v.array(v.object({ uploadId: v.id("uploads"), jobId: v.id("jobs") })),
  }),
  handler: async (ctx, { clerkId, ...file }) => {
    const user = await requireSmokeUser(ctx, clerkId);
    return createBatch(ctx, user, [file]);
  },
});

export const job = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(vJob, v.null()),
  handler: async (ctx, { jobId }) => {
    const doc = await ctx.db.get(jobId);
    return doc ? toJobView(doc) : null;
  },
});

export const itemsOfUpload = internalQuery({
  args: { uploadId: v.id("uploads") },
  returns: v.array(vItemView),
  handler: async (ctx, { uploadId }) => toItemViews(ctx, await listByUpload(ctx, uploadId)),
});

/** Builds an outfit from the given items and renders it on the user's default avatar. */
export const render = internalMutation({
  args: {
    clerkId: v.string(),
    itemIds: v.array(v.id("items")),
    count: v.optional(v.number()),
    quality: v.optional(vRenderQuality),
  },
  returns: v.object({ outfitId: v.id("outfits"), jobId: v.id("jobs"), renderIds: v.array(v.id("renders")) }),
  handler: async (ctx, { clerkId, itemIds, count, quality }) => {
    const user = await requireSmokeUser(ctx, clerkId);
    const items = await Promise.all(itemIds.map((id) => ctx.db.get(id)));
    const slots = { accessories: [] as Id<"items">[] } as Parameters<typeof createOutfit>[2]["slots"];
    for (const item of items) {
      if (!item) continue;
      if (item.category === "outerwear" && !slots.outerwear) slots.outerwear = item._id;
      else if (item.category === "top" && !slots.top) slots.top = item._id;
      else if (item.category === "bottom" && !slots.bottom) slots.bottom = item._id;
      else if (item.category === "dress" && !slots.dress) slots.dress = item._id;
      else if (item.category === "shoes" && !slots.shoes) slots.shoes = item._id;
      else slots.accessories.push(item._id);
    }
    const outfitId = await createOutfit(ctx, user, { name: "Smoke outfit", slots });
    const started = await startRenderJob(ctx, user, {
      outfitIds: [outfitId],
      count: count ?? 1,
      quality: quality ?? "standard",
    });
    return { outfitId, ...started };
  },
});

export const rendersOfJob = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.array(
    v.object({
      renderId: v.id("renders"),
      status: v.string(),
      url: v.union(v.string(), v.null()),
      costUsd: v.optional(v.number()),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { jobId }) => {
    const renders = await listByJob(ctx, jobId);
    return Promise.all(
      renders.map(async (render) => ({
        renderId: render._id,
        status: render.status,
        url: render.storageId ? await ctx.storage.getUrl(render.storageId) : null,
        costUsd: render.costUsd,
        error: render.error,
      })),
    );
  },
});

async function requireSmokeUser(ctx: Parameters<typeof getByClerkId>[0], clerkId: string) {
  const user = await getByClerkId(ctx, clerkId);
  if (!user)
    throw appError("NOT_FOUND", `Seed the user first: npx convex run dev/smoke:seedUser '{"clerkId":"${clerkId}"}'`);
  return user;
}

/** Forces a share token onto a render so the public /share/[token] page can be exercised without a plan. */
export const share = internalMutation({
  args: { renderId: v.id("renders") },
  returns: v.string(),
  handler: async (ctx, { renderId }) => {
    const render = await ctx.db.get(renderId);
    if (!render) throw appError("NOT_FOUND", "Render not found.");
    const token = render.shareToken ?? crypto.randomUUID();
    await ctx.db.patch(renderId, { shareToken: token });
    return token;
  },
});
