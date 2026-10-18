import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  currentCatalogueVersion,
  ensureCatalogueSeeded,
  getEntry,
  listApproved,
  toEntryView,
} from "../model/atelier/catalogue";
import {
  confirmShade as confirmEntryShade,
  latestVersion,
  listEntries,
  listVersions as listVersionRows,
  publishVersion as publishCatalogueVersion,
  setEntryStatus,
  setStock as setEntryStock,
  sortBySortOrder,
  toStaffEntryView,
  toStaffEntryViews,
  toVersionViews,
  upsertEntry,
} from "../model/atelier/catalogue_staff";
import { vCatalogueKind, vCatalogueStatus, vClothPattern, vClothWeight, vOccasion } from "../shared/atelier/validators";
import { vSeason } from "../shared/validators";
import { requireStaff } from "./access";
import { vCatalogueEntryView } from "./views";

/**
 * The catalogue: the cloths, buttons and linings the house offers (C03, C04) and the operations tools
 * that approve, withdraw and publish them (O02, A02). Clients read approved entries without signing in;
 * every staff write needs the operations role and lands in the audit log.
 */

/** What staff send to create or edit an entry. `kind` + `code` identify it; status is set separately. */
export const vCatalogueEntryInput = v.object({
  kind: vCatalogueKind,
  code: v.string(),
  name: v.string(),
  mill: v.optional(v.string()),
  supplierRef: v.optional(v.string()),
  productUrl: v.optional(v.string()),
  productId: v.optional(v.number()),
  description: v.string(),
  composition: v.optional(v.string()),
  weight: v.optional(vClothWeight),
  pattern: vClothPattern,
  colour: v.string(),
  /** The representative shade; a changed shade is unconfirmed until a fitter confirms it again. */
  hex: v.string(),
  season: v.array(vSeason),
  occasions: v.array(vOccasion),
  priceUsd: v.optional(v.number()),
  /** Defaults to true on a new entry; use `setStock` for day-to-day changes. */
  inStock: v.optional(v.boolean()),
  sampleAvailable: v.optional(v.boolean()),
  /** The mill-book photograph: a path under public/ or a full URL. */
  image: v.optional(v.string()),
  sortOrder: v.optional(v.number()),
  /** Where the entry comes from; required on a new entry (O02: every option has provenance). */
  provenance: v.optional(v.string()),
});

/** The client view plus what operations need: provenance, who approved, and whether a publish is pending. */
export const vCatalogueStaffEntryView = vCatalogueEntryView.extend({
  productId: v.optional(v.number()),
  provenance: v.string(),
  approvedBy: v.union(v.id("users"), v.null()),
  approvedByName: v.union(v.string(), v.null()),
  approvedAt: v.union(v.number(), v.null()),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  /** Changed since the last published version; the next publish stamps it. */
  pendingPublish: v.boolean(),
});

export const vCatalogueVersionView = v.object({
  _id: v.id("atelierCatalogueVersions"),
  version: v.number(),
  publishedAt: v.number(),
  publishedByName: v.union(v.string(), v.null()),
  note: v.string(),
  isCurrent: v.boolean(),
});

export const vPublishResult = v.object({ version: v.number(), publishedAt: v.number(), stamped: v.number() });

export const vUpsertResult = v.object({ id: v.id("atelierCatalogueEntries"), created: v.boolean() });

/** Approved entries of one kind in catalogue order, for the cloth browser and the details step. */
export const list = query({
  args: { kind: vCatalogueKind },
  returns: v.array(vCatalogueEntryView),
  handler: async (ctx, { kind }) => {
    const entries = sortBySortOrder(await listApproved(ctx, kind));
    return Promise.all(entries.map((entry) => toEntryView(ctx, entry)));
  },
});

/** One entry in any status, so a draft can still name a cloth that has since been withdrawn. */
export const get = query({
  args: { kind: vCatalogueKind, code: v.string() },
  returns: v.union(vCatalogueEntryView, v.null()),
  handler: async (ctx, { kind, code }) => {
    const entry = await getEntry(ctx, kind, code);
    return entry ? toEntryView(ctx, entry) : null;
  },
});

/** The published catalogue version; 0 before the first seed. */
export const currentVersion = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => currentCatalogueVersion(ctx),
});

export const listAll = query({
  args: { kind: v.optional(vCatalogueKind) },
  returns: v.array(vCatalogueStaffEntryView),
  handler: async (ctx, { kind }) => {
    await requireStaff(ctx, "operations");
    const [entries, latest] = await Promise.all([listEntries(ctx, kind), latestVersion(ctx)]);
    return toStaffEntryViews(ctx, entries, latest);
  },
});

export const listVersions = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vCatalogueVersionView),
  handler: async (ctx, { limit }) => {
    await requireStaff(ctx, "operations");
    const rows = await listVersionRows(ctx, limit);
    return toVersionViews(ctx, rows, rows[0]?.version ?? 0);
  },
});

export const upsert = mutation({
  args: vCatalogueEntryInput.fields,
  returns: vUpsertResult,
  handler: async (ctx, input) => {
    const staff = await requireStaff(ctx, "operations");
    return upsertEntry(ctx, staff, input);
  },
});

export const setStatus = mutation({
  args: { id: v.id("atelierCatalogueEntries"), status: vCatalogueStatus },
  returns: vCatalogueStaffEntryView,
  handler: async (ctx, { id, status }) => {
    const staff = await requireStaff(ctx, "operations");
    return toStaffEntryView(ctx, await setEntryStatus(ctx, staff, id, status));
  },
});

export const confirmShade = mutation({
  args: { id: v.id("atelierCatalogueEntries"), hex: v.string() },
  returns: vCatalogueStaffEntryView,
  handler: async (ctx, { id, hex }) => {
    const staff = await requireStaff(ctx, ["fitter", "operations"]);
    return toStaffEntryView(ctx, await confirmEntryShade(ctx, staff, id, hex));
  },
});

export const setStock = mutation({
  args: { id: v.id("atelierCatalogueEntries"), inStock: v.boolean(), sampleAvailable: v.boolean() },
  returns: vCatalogueStaffEntryView,
  handler: async (ctx, { id, inStock, sampleAvailable }) => {
    const staff = await requireStaff(ctx, "operations");
    return toStaffEntryView(ctx, await setEntryStock(ctx, staff, id, { inStock, sampleAvailable }));
  },
});

export const publishVersion = mutation({
  args: { note: v.string() },
  returns: vPublishResult,
  handler: async (ctx, { note }) => {
    const staff = await requireStaff(ctx, "operations");
    return publishCatalogueVersion(ctx, staff, note);
  },
});

/** Seeds the house's range when the table is empty and returns the current version; safe to run again. */
export const seed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => ensureCatalogueSeeded(ctx),
});
