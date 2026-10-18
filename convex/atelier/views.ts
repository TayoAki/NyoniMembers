import { v, type Infer } from "convex/values";
import {
  vCatalogueKind,
  vCatalogueStatus,
  vClothPattern,
  vClothWeight,
  vConflict,
  vDescribedLine,
  vOccasion,
  vRevisionReason,
  vSuitSpec,
} from "../shared/atelier/validators";
import { vSeason } from "../shared/validators";

/**
 * Cross-domain return shapes for the Atelier. Each domain module (`convex/atelier/<domain>.ts`) exports
 * its own `v<Thing>View` next to its functions; only shapes two or more domains return live here.
 */

/** Client-facing catalogue entry: no storage ids, the image path or URL ready for `<img>`. */
export const vCatalogueEntryView = v.object({
  _id: v.id("atelierCatalogueEntries"),
  kind: vCatalogueKind,
  code: v.string(),
  name: v.string(),
  mill: v.optional(v.string()),
  supplierRef: v.optional(v.string()),
  productUrl: v.optional(v.string()),
  description: v.string(),
  composition: v.optional(v.string()),
  weight: v.optional(vClothWeight),
  pattern: vClothPattern,
  colour: v.string(),
  hex: v.string(),
  shadeConfirmed: v.boolean(),
  season: v.array(vSeason),
  occasions: v.array(vOccasion),
  priceUsd: v.optional(v.number()),
  inStock: v.boolean(),
  sampleAvailable: v.boolean(),
  /** The mill-book photograph (a `/atelier/cloth/*.webp` path or URL), or null. */
  imageUrl: v.union(v.string(), v.null()),
  /** A staff-photographed swatch when one exists. */
  swatchUrl: v.union(v.string(), v.null()),
  status: vCatalogueStatus,
  version: v.number(),
});
export type CatalogueEntryView = Infer<typeof vCatalogueEntryView>;

/** Enough of a cloth to label a design anywhere: lists, stage captions, receipts. */
export const vClothSummary = v.object({
  code: v.string(),
  name: v.string(),
  mill: v.optional(v.string()),
  hex: v.string(),
  pattern: vClothPattern,
  shadeConfirmed: v.boolean(),
  status: vCatalogueStatus,
  inStock: v.boolean(),
  imageUrl: v.union(v.string(), v.null()),
});
export type ClothSummary = Infer<typeof vClothSummary>;

export const vRevisionSummary = v.object({
  _id: v.id("atelierRevisions"),
  revision: v.number(),
  specHash: v.string(),
  reason: vRevisionReason,
  createdAt: v.number(),
  spec: vSuitSpec,
  lines: v.array(vDescribedLine),
});
export type RevisionSummary = Infer<typeof vRevisionSummary>;

/** Why a draft needs the client's attention before it can be submitted or quoted (C03, C19, C26). */
export const vDraftWarning = v.object({
  code: v.union(
    v.literal("cloth_withdrawn"),
    v.literal("cloth_out_of_stock"),
    v.literal("catalogue_changed"),
    v.literal("event_tight"),
    v.literal("event_unlikely"),
    v.literal("preview_stale"),
  ),
  message: v.string(),
});
export type DraftWarning = Infer<typeof vDraftWarning>;

export const vApplyResult = v.object({ spec: vSuitSpec, conflicts: v.array(vConflict) });

/** Args every client read of an owned row accepts. */
export const ownerArgs = { guestKey: v.optional(v.string()) };
