import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "../lib/errors";
import { COLLECTION, type CollectionPiece } from "../shared/collection";
import { buildSearchText, removeItems } from "./items";
import { listActive } from "./jobs";
import { slotItemIds } from "./outfits";

export type CollectionFile = { key: string; storageId: Id<"_storage"> };

/** Generous: the collection can grow past the wardrobe grid's first page without being cut off here. */
const COLLECTION_READ_LIMIT = 500;

async function listCollectionItems(ctx: QueryCtx | MutationCtx, user: Doc<"users">): Promise<Doc<"items">[]> {
  return ctx.db
    .query("items")
    .withIndex("by_user_collectionKey", (q) => q.eq("userId", user._id).gt("collectionKey", ""))
    .take(COLLECTION_READ_LIMIT);
}

/** The pieces this member does not have yet, and the items whose key has left the collection. */
export async function collectionDiff(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<{ existing: Doc<"items">[]; missing: CollectionPiece[]; stale: Doc<"items">[] }> {
  const existing = await listCollectionItems(ctx, user);
  const missing = COLLECTION.filter((piece) => !existing.some((item) => item.collectionKey === piece.key));
  const stale = existing.filter((item) => !COLLECTION.some((piece) => piece.key === item.collectionKey));
  return { existing, missing, stale };
}

/**
 * Adds the fetched pieces and retires the ones no longer in the collection. Additive for the member's
 * own garments: nothing without a collection key is touched.
 */
export async function reconcileCollectionItems(
  ctx: MutationCtx,
  user: Doc<"users">,
  files: CollectionFile[],
): Promise<{ added: number; removed: number }> {
  const byKey = new Map(COLLECTION.map((piece) => [piece.key, piece]));
  if (new Set(files.map((file) => file.key)).size !== files.length || files.some((file) => !byKey.has(file.key))) {
    throw appError("INVALID_INPUT", "Unknown collection piece.");
  }
  const { existing, stale } = await collectionDiff(ctx, user);
  if (stale.length > 0) {
    const staleIds = new Set(stale.map((item) => item._id));
    const jobs = (await listActive(ctx, user._id)).filter((job) => job.type === "render");
    const outfitIds = [...new Set(jobs.flatMap((job) => job.outfitIds ?? []))];
    const outfits = await Promise.all(outfitIds.map((id) => ctx.db.get(id)));
    if (
      stale.some((item) => item.pendingJobId) ||
      outfits.some((outfit) => outfit && slotItemIds(outfit.slots).some((id) => staleIds.has(id)))
    ) {
      throw appError("ITEM_BUSY", "Wait for your current preview to finish before the collection is updated.");
    }
    await removeItems(
      ctx,
      user,
      stale.map((item) => item._id),
    );
  }

  let added = 0;
  const now = Date.now();
  for (const file of files) {
    const piece = byKey.get(file.key);
    if (!piece) continue;
    const retained = existing.find((item) => item.collectionKey === piece.key);
    if (retained) {
      // Two seeds can race (onboarding plus the wardrobe button); only one keeps its file.
      if (retained.storageId !== file.storageId) await ctx.storage.delete(file.storageId);
      continue;
    }
    await ctx.db.insert("items", {
      userId: user._id,
      collectionKey: piece.key,
      storageId: file.storageId,
      ...piece.attributes,
      searchText: buildSearchText(piece.attributes),
      status: "ready",
      wearCount: 0,
      costUsd: 0,
      createdAt: now,
      updatedAt: now,
    });
    added += 1;
  }
  return { added, removed: stale.length };
}
