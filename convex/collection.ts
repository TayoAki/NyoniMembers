import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { requireEnv } from "./lib/env";
import { appError } from "./lib/errors";
import { collectionDiff, reconcileCollectionItems, type CollectionFile } from "./model/collection";
import { COLLECTION } from "./shared/collection";

/**
 * Every member's wardrobe starts with the Nyoni capsule (`shared/collection.ts`). Seeding runs
 * automatically after onboarding and again from the wardrobe's "Add the Nyoni capsule" button,
 * which also restores pieces a member removed and retires pieces the house has taken out of the
 * capsule. It never charges credits.
 */

const vSeedResult = v.object({ added: v.number(), removed: v.number(), skipped: v.number() });
type SeedResult = { added: number; removed: number; skipped: number };

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const me = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => (await requireUser(ctx))._id,
});

export const pending = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({ missing: v.array(v.string()), stale: v.number() }),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw appError("NOT_FOUND", "Member not found.");
    const { missing, stale } = await collectionDiff(ctx, user);
    return { missing: missing.map((piece) => piece.key), stale: stale.length };
  },
});

export const insert = internalMutation({
  args: { userId: v.id("users"), files: v.array(v.object({ key: v.string(), storageId: v.id("_storage") })) },
  returns: v.object({ added: v.number(), removed: v.number() }),
  handler: async (ctx, { userId, files }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw appError("NOT_FOUND", "Member not found.");
    return reconcileCollectionItems(ctx, user, files);
  },
});

/** Scheduled by `users.completeOnboarding`, so the wardrobe is dressed before the member reaches it. */
export const seedMember = internalAction({
  args: { userId: v.id("users") },
  returns: vSeedResult,
  handler: async (ctx, { userId }): Promise<SeedResult> => seedCollection(ctx, userId),
});

/** The wardrobe button: idempotent, and the way back for a member who removed a collection piece. */
export const seed = action({
  args: {},
  returns: vSeedResult,
  handler: async (ctx): Promise<SeedResult> => {
    const userId = await ctx.runQuery(internal.collection.me, {});
    return seedCollection(ctx, userId);
  },
});

async function seedCollection(ctx: ActionCtx, userId: Id<"users">): Promise<SeedResult> {
  const todo = await ctx.runQuery(internal.collection.pending, { userId });
  if (todo.missing.length === 0 && todo.stale === 0) return { added: 0, removed: 0, skipped: 0 };
  const siteUrl = requireEnv("SITE_URL");
  const files: CollectionFile[] = [];
  let skipped = 0;
  try {
    for (const piece of COLLECTION.filter((entry) => todo.missing.includes(entry.key))) {
      const image = await fetchImage(new URL(piece.image, siteUrl));
      if (!image) {
        skipped += 1;
        continue;
      }
      files.push({ key: piece.key, storageId: await ctx.storage.store(image) });
    }
    const result = await ctx.runMutation(internal.collection.insert, { userId, files });
    return { ...result, skipped };
  } catch (error) {
    await Promise.allSettled(files.map((file) => ctx.storage.delete(file.storageId)));
    throw error;
  }
}

/** Null when the photo is missing or not an image, so one absent product shot never blocks the rest. */
async function fetchImage(url: URL): Promise<Blob | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!ACCEPTED_TYPES.includes(blob.type) || blob.size > MAX_IMAGE_BYTES) return null;
    return blob;
  } catch {
    return null;
  }
}
