import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertOwner } from "../lib/auth";
import { usageToUsd, type TokenUsage } from "../shared/credits";
import type { vItemAttributes } from "../shared/validators";
import { CATEGORY_LABELS, type Category } from "../shared/wardrobe";
import type { ItemView } from "../views";
import { removeItemsFromOutfits } from "./outfits";

type Ctx = QueryCtx | MutationCtx;
export type ItemAttributes = Infer<typeof vItemAttributes>;

/** What full-text search matches on. Recomputed whenever attributes change. */
export function buildSearchText(attrs: ItemAttributes): string {
  return [
    attrs.name,
    attrs.subcategory,
    CATEGORY_LABELS[attrs.category],
    attrs.category,
    attrs.colours.primary,
    ...attrs.colours.secondary,
    attrs.pattern,
    attrs.material,
    ...attrs.season,
    attrs.formality,
    attrs.fit ?? "",
    attrs.brand ?? "",
    attrs.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function attributesOf(item: Doc<"items">): ItemAttributes {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colours,
    pattern: item.pattern,
    material: item.material,
    season: item.season,
    formality: item.formality,
    fit: item.fit,
    brand: item.brand,
    description: item.description,
  };
}

export async function toItemView(ctx: Ctx, item: Doc<"items">): Promise<ItemView> {
  const url = item.storageId ? await ctx.storage.getUrl(item.storageId) : null;
  return {
    _id: item._id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colours,
    pattern: item.pattern,
    material: item.material,
    season: item.season,
    formality: item.formality,
    fit: item.fit,
    brand: item.brand,
    notes: item.notes,
    description: item.description,
    status: item.status,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt,
    duplicateOfId: item.duplicateOfId,
    uploadId: item.uploadId,
    url,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function toItemViews(ctx: Ctx, items: Doc<"items">[]): Promise<ItemView[]> {
  return Promise.all(items.map((item) => toItemView(ctx, item)));
}

/** Insert a detected-but-not-yet-extracted item. Status is `extracting` or `needsCredits`. */
export async function insertDetectedItem(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    uploadId: Id<"uploads">;
    attrs: ItemAttributes;
    bbox?: number[];
    status: Extract<Doc<"items">["status"], "extracting" | "needsCredits">;
  },
): Promise<Id<"items">> {
  const now = Date.now();
  return ctx.db.insert("items", {
    userId: input.userId,
    uploadId: input.uploadId,
    sourceBbox: input.bbox,
    ...input.attrs,
    searchText: buildSearchText(input.attrs),
    status: input.status,
    wearCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function markItemReady(
  ctx: MutationCtx,
  itemId: Id<"items">,
  result: { storageId: Id<"_storage">; thumbStorageId?: Id<"_storage">; hex?: string[]; usage?: TokenUsage },
): Promise<void> {
  const item = await ctx.db.get(itemId);
  if (!item) return;
  await ctx.db.patch(itemId, {
    storageId: result.storageId,
    thumbStorageId: result.thumbStorageId,
    colours: result.hex ? { ...item.colours, hex: result.hex } : item.colours,
    usage: result.usage,
    costUsd: result.usage ? usageToUsd(result.usage) : item.costUsd,
    status: "ready",
    updatedAt: Date.now(),
  });
}

export async function markItemFailed(ctx: MutationCtx, itemId: Id<"items">): Promise<void> {
  const item = await ctx.db.get(itemId);
  if (!item) return;
  await ctx.db.patch(itemId, { status: "failed", updatedAt: Date.now() });
}

export async function setItemEmbedding(
  ctx: MutationCtx,
  itemId: Id<"items">,
  embedding: number[],
  duplicateOfId?: Id<"items">,
): Promise<void> {
  await ctx.db.patch(itemId, { embedding, duplicateOfId, updatedAt: Date.now() });
}

export async function updateAttributes(
  ctx: MutationCtx,
  item: Doc<"items">,
  patch: Partial<ItemAttributes> & { notes?: string },
): Promise<void> {
  const { notes, ...attrPatch } = patch;
  const attrs = { ...attributesOf(item), ...attrPatch };
  await ctx.db.patch(item._id, {
    ...attrPatch,
    ...(notes !== undefined ? { notes } : {}),
    searchText: buildSearchText(attrs),
    updatedAt: Date.now(),
  });
}

export async function listByStatus(
  ctx: Ctx,
  userId: Id<"users">,
  status: Doc<"items">["status"],
): Promise<Doc<"items">[]> {
  return ctx.db
    .query("items")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
    .order("desc")
    .collect();
}

export async function requireItem(ctx: Ctx, user: Doc<"users">, itemId: Id<"items">): Promise<Doc<"items">> {
  return assertOwner(await ctx.db.get(itemId), user, "item");
}

/** Wardrobe listing: newest first, `ready` unless another status is asked for. */
export async function listForUser(
  ctx: Ctx,
  userId: Id<"users">,
  filters: { status?: Doc<"items">["status"]; category?: Category } = {},
): Promise<Doc<"items">[]> {
  const status = filters.status ?? "ready";
  const category = filters.category;
  const items = category
    ? (
        await ctx.db
          .query("items")
          .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("category", category))
          .order("desc")
          .collect()
      ).filter((item) => item.status === status)
    : await ctx.db
        .query("items")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
        .order("desc")
        .collect();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function searchForUser(ctx: Ctx, userId: Id<"users">, text: string, limit = 50): Promise<Doc<"items">[]> {
  const term = text.trim();
  if (!term) return [];
  return ctx.db
    .query("items")
    .withSearchIndex("search_text", (q) => q.search("searchText", term.toLowerCase()).eq("userId", userId))
    .take(Math.min(Math.max(limit, 1), 100));
}

export async function listByUpload(ctx: Ctx, uploadId: Id<"uploads">): Promise<Doc<"items">[]> {
  return ctx.db
    .query("items")
    .withIndex("by_upload", (q) => q.eq("uploadId", uploadId))
    .collect();
}

export async function setStatus(
  ctx: MutationCtx,
  user: Doc<"users">,
  itemIds: Id<"items">[],
  status: Extract<Doc<"items">["status"], "hidden" | "ready">,
): Promise<void> {
  for (const itemId of itemIds) {
    const item = await requireItem(ctx, user, itemId);
    await ctx.db.patch(item._id, { status, updatedAt: Date.now() });
  }
}

export async function setCategory(
  ctx: MutationCtx,
  user: Doc<"users">,
  itemIds: Id<"items">[],
  category: Category,
): Promise<void> {
  for (const itemId of itemIds) {
    const item = await requireItem(ctx, user, itemId);
    await updateAttributes(ctx, item, { category });
  }
}

export async function markWorn(ctx: MutationCtx, item: Doc<"items">, wornAt: number): Promise<void> {
  await ctx.db.patch(item._id, { wearCount: item.wearCount + 1, lastWornAt: wornAt, updatedAt: Date.now() });
}

/** Deletes items with their cutout files and unhooks them from every outfit slot that used them. */
export async function removeItems(ctx: MutationCtx, user: Doc<"users">, itemIds: Id<"items">[]): Promise<void> {
  const items = await Promise.all(itemIds.map((itemId) => requireItem(ctx, user, itemId)));
  for (const item of items) {
    if (item.storageId) await ctx.storage.delete(item.storageId);
    if (item.thumbStorageId) await ctx.storage.delete(item.thumbStorageId);
    await ctx.db.delete("items", item._id);
  }
  await removeItemsFromOutfits(
    ctx,
    user._id,
    items.map((item) => item._id),
  );
}
