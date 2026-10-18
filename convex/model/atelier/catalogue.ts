import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { CatalogueEntryView, ClothSummary } from "../../atelier/views";
import { CLOTH_SEED } from "../../shared/atelier/cloths";
import type { CatalogueKind } from "../../shared/atelier/enums";
import { BUTTON_SEED, LINING_SEED, MATERIAL_PROVENANCE, type MaterialSeed } from "../../shared/atelier/materials";
import type { SpecNames, SuitSpec } from "../../shared/atelier/spec";

type Ctx = QueryCtx | MutationCtx;

/**
 * Catalogue core, shared by every Atelier domain: the current version, seeding on first use, and the
 * lookups a draft, a preview or a quote needs to name its materials. Staff approval and editing live in
 * `convex/atelier/catalogue.ts`.
 */

export const CLOTH_PROVENANCE = "WooCommerce Store API export of nyonicouture.com, 21 September 2026; curated 18 October 2026.";

export async function currentCatalogueVersion(ctx: Ctx): Promise<number> {
  const latest = await ctx.db.query("atelierCatalogueVersions").withIndex("by_version").order("desc").first();
  return latest?.version ?? 0;
}

export async function getEntry(ctx: Ctx, kind: CatalogueKind, code: string): Promise<Doc<"atelierCatalogueEntries"> | null> {
  return ctx.db
    .query("atelierCatalogueEntries")
    .withIndex("by_kind_code", (q) => q.eq("kind", kind).eq("code", code))
    .unique();
}

/** Entries of a kind a client may choose from. The range is a few dozen; the cap keeps the read bounded. */
export const CATALOGUE_READ_MAX = 500;

export async function listApproved(ctx: Ctx, kind: CatalogueKind): Promise<Doc<"atelierCatalogueEntries">[]> {
  return ctx.db
    .query("atelierCatalogueEntries")
    .withIndex("by_kind_status", (q) => q.eq("kind", kind).eq("status", "approved"))
    .take(CATALOGUE_READ_MAX);
}

export async function toEntryView(ctx: Ctx, doc: Doc<"atelierCatalogueEntries">): Promise<CatalogueEntryView> {
  return {
    _id: doc._id,
    kind: doc.kind,
    code: doc.code,
    name: doc.name,
    mill: doc.mill,
    supplierRef: doc.supplierRef,
    productUrl: doc.productUrl,
    description: doc.description,
    composition: doc.composition,
    weight: doc.weight,
    pattern: doc.pattern,
    colour: doc.colour,
    hex: doc.hex,
    shadeConfirmed: doc.shadeConfirmed,
    season: doc.season,
    occasions: doc.occasions,
    priceUsd: doc.priceUsd,
    inStock: doc.inStock,
    sampleAvailable: doc.sampleAvailable,
    imageUrl: doc.image ?? null,
    swatchUrl: doc.swatchStorageId ? await ctx.storage.getUrl(doc.swatchStorageId) : null,
    status: doc.status,
    version: doc.version,
  };
}

export function toClothSummary(doc: Doc<"atelierCatalogueEntries">): ClothSummary {
  return {
    code: doc.code,
    name: doc.name,
    mill: doc.mill,
    hex: doc.hex,
    pattern: doc.pattern,
    shadeConfirmed: doc.shadeConfirmed,
    status: doc.status,
    inStock: doc.inStock,
    imageUrl: doc.image ?? null,
  };
}

export async function clothSummary(ctx: Ctx, code: string | null | undefined): Promise<ClothSummary | null> {
  if (!code) return null;
  const doc = await getEntry(ctx, "cloth", code);
  return doc ? toClothSummary(doc) : null;
}

/** The names `describeSpec` prints for the cloth, buttons and lining a spec refers to. */
export async function specNames(ctx: Ctx, spec: SuitSpec): Promise<SpecNames> {
  const [cloth, button, lining] = await Promise.all([
    spec.clothCode ? getEntry(ctx, "cloth", spec.clothCode) : null,
    spec.buttonCode ? getEntry(ctx, "button", spec.buttonCode) : null,
    spec.liningCode ? getEntry(ctx, "lining", spec.liningCode) : null,
  ]);
  return {
    cloth: cloth ? { name: cloth.name, mill: cloth.mill, code: cloth.code } : null,
    button: button ? { name: button.name, code: button.code } : null,
    lining: lining ? { name: lining.name, code: lining.code } : null,
  };
}

function materialRow(kind: "button" | "lining", seed: MaterialSeed, version: number, now: number) {
  return {
    kind,
    code: seed.code,
    name: seed.name,
    supplierRef: seed.supplierRef,
    description: seed.description,
    pattern: "solid" as const,
    colour: seed.colour,
    hex: seed.hex,
    shadeConfirmed: false,
    season: ["spring", "summer", "autumn", "winter"] as Doc<"atelierCatalogueEntries">["season"],
    occasions: [] as Doc<"atelierCatalogueEntries">["occasions"],
    inStock: true,
    sampleAvailable: false,
    status: "approved" as const,
    version,
    provenance: MATERIAL_PROVENANCE,
    sortOrder: seed.sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seeds the catalogue from the shared constants when the table is empty, publishing version 1. Safe to
 * call on every draft creation: it reads one row and returns the current version when seeded already.
 */
export async function ensureCatalogueSeeded(ctx: MutationCtx, now: number = Date.now()): Promise<number> {
  const existing = await currentCatalogueVersion(ctx);
  if (existing > 0) return existing;
  const version = 1;
  await ctx.db.insert("atelierCatalogueVersions", {
    version,
    publishedAt: now,
    note: "Initial catalogue from the house's bespoke cloth range and standard buttons and linings.",
  });
  for (const cloth of CLOTH_SEED) {
    await ctx.db.insert("atelierCatalogueEntries", {
      kind: "cloth",
      code: cloth.code,
      name: cloth.name,
      mill: cloth.mill,
      supplierRef: cloth.supplierRef,
      productUrl: cloth.productUrl,
      productId: cloth.productId,
      description: cloth.description,
      composition: cloth.composition,
      weight: cloth.weight,
      pattern: cloth.pattern,
      colour: cloth.colour,
      hex: cloth.hex,
      shadeConfirmed: false,
      season: cloth.season,
      occasions: cloth.occasions,
      priceUsd: cloth.priceUsd,
      inStock: cloth.inStock,
      sampleAvailable: true,
      image: cloth.image,
      status: "approved",
      version,
      provenance: CLOTH_PROVENANCE,
      sortOrder: cloth.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const button of BUTTON_SEED) await ctx.db.insert("atelierCatalogueEntries", materialRow("button", button, version, now));
  for (const lining of LINING_SEED) await ctx.db.insert("atelierCatalogueEntries", materialRow("lining", lining, version, now));
  return version;
}

export type EntryId = Id<"atelierCatalogueEntries">;
