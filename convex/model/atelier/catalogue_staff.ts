import type { Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit } from "../../atelier/access";
import type { vCatalogueEntryInput, vCatalogueStaffEntryView, vCatalogueVersionView } from "../../atelier/catalogue";
import { appError } from "../../lib/errors";
import { CATALOGUE_KINDS, type CatalogueKind, type CatalogueStatus } from "../../shared/atelier/enums";
import { ensureCatalogueSeeded, getEntry, toEntryView } from "./catalogue";

type Ctx = QueryCtx | MutationCtx;
type Entry = Doc<"atelierCatalogueEntries">;
type VersionRow = Doc<"atelierCatalogueVersions">;
type Staff = Doc<"users">;

export type CatalogueEntryInput = Infer<typeof vCatalogueEntryInput>;
export type CatalogueStaffEntryView = Infer<typeof vCatalogueStaffEntryView>;
export type CatalogueVersionView = Infer<typeof vCatalogueVersionView>;
export type EntryId = Id<"atelierCatalogueEntries">;

/**
 * Staff side of the catalogue (O02, A02): editing entries, approving and withdrawing them, confirming
 * the representative shade against the real cloth, recording stock, and publishing a version. Nothing
 * here touches a draft: a withdrawn cloth stays named by the drafts that chose it and they revalidate
 * themselves against the new version.
 */

/** Every read of a whole kind is bounded by this; the house's range is a few dozen entries. */
export const CATALOGUE_READ_MAX = 500;
export const VERSIONS_READ_MAX = 50;

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** `draft → approved → withdrawn`, with a way back for a cloth that returns to the range. */
export const CATALOGUE_TRANSITIONS: Record<CatalogueStatus, readonly CatalogueStatus[]> = {
  draft: ["approved", "withdrawn"],
  approved: ["withdrawn"],
  withdrawn: ["approved", "draft"],
};

export function canTransition(from: CatalogueStatus, to: CatalogueStatus): boolean {
  return CATALOGUE_TRANSITIONS[from].includes(to);
}

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  if (!HEX_PATTERN.test(trimmed)) {
    throw appError("INVALID_INPUT", "A shade is six hex digits after a #, like #1F2538.", { hex });
  }
  return trimmed.toUpperCase();
}

export function normalizeCode(code: string): string {
  const slug = code.trim().toLowerCase();
  if (!CODE_PATTERN.test(slug)) {
    throw appError("INVALID_INPUT", "A code is lowercase letters, digits and hyphens, like loro-piana-365.", { code });
  }
  return slug;
}

export function sortBySortOrder<T extends { sortOrder: number; code: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Entries written after the last publish; the next publish stamps them with its version. */
export function changedSince(entries: readonly Entry[], publishedAt: number): Entry[] {
  return entries.filter((entry) => entry.updatedAt > publishedAt);
}

export async function latestVersion(ctx: Ctx): Promise<VersionRow | null> {
  return ctx.db.query("atelierCatalogueVersions").withIndex("by_version").order("desc").first();
}

export async function listVersions(ctx: Ctx, limit: number = 20): Promise<VersionRow[]> {
  const bounded = Math.max(1, Math.min(Math.floor(limit), VERSIONS_READ_MAX));
  return ctx.db.query("atelierCatalogueVersions").withIndex("by_version").order("desc").take(bounded);
}

/** Every entry of one kind in any status, in catalogue order. */
export async function listKind(ctx: Ctx, kind: CatalogueKind): Promise<Entry[]> {
  const rows = await ctx.db
    .query("atelierCatalogueEntries")
    .withIndex("by_kind_status", (q) => q.eq("kind", kind))
    .take(CATALOGUE_READ_MAX);
  return sortBySortOrder(rows);
}

export async function listEntries(ctx: Ctx, kind?: CatalogueKind): Promise<Entry[]> {
  if (kind) return listKind(ctx, kind);
  const perKind = await Promise.all(CATALOGUE_KINDS.map((k) => listKind(ctx, k)));
  return perKind.flat();
}

export async function requireEntry(ctx: Ctx, id: EntryId): Promise<Entry> {
  const entry = await ctx.db.get(id);
  if (!entry) throw appError("NOT_FOUND", "That catalogue entry doesn't exist.");
  return entry;
}

async function reread(ctx: MutationCtx, id: EntryId): Promise<Entry> {
  const entry = await ctx.db.get(id);
  if (!entry) throw appError("NOT_FOUND", "That catalogue entry doesn't exist.");
  return entry;
}

function requireText(value: string | undefined, field: string, message: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw appError("INVALID_INPUT", message, { field });
  return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalUrl(value: string | undefined): string | undefined {
  const trimmed = optionalText(value);
  if (!trimmed) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw appError("INVALID_INPUT", "The product link must be a full web address.", { field: "productUrl" });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw appError("INVALID_INPUT", "The product link must be a full web address.", { field: "productUrl" });
  }
  return parsed.toString();
}

function optionalAmount(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw appError("INVALID_INPUT", "An amount is zero or more.", { field });
  }
  return value;
}

type EntryFields = Omit<Entry, "_id" | "_creationTime">;

/** The editable fields, cleaned; omitted optional fields come back `undefined` so a patch clears them. */
function cleanInput(input: CatalogueEntryInput) {
  return {
    kind: input.kind,
    code: normalizeCode(input.code),
    name: requireText(input.name, "name", "Give the entry a name."),
    mill: optionalText(input.mill),
    supplierRef: optionalText(input.supplierRef),
    productUrl: optionalUrl(input.productUrl),
    productId: optionalAmount(input.productId, "productId"),
    description: requireText(input.description, "description", "Describe the entry for the client."),
    composition: optionalText(input.composition),
    weight: input.weight,
    pattern: input.pattern,
    colour: requireText(input.colour, "colour", "Name the colour."),
    hex: normalizeHex(input.hex),
    season: [...new Set(input.season)],
    occasions: [...new Set(input.occasions)],
    priceUsd: optionalAmount(input.priceUsd, "priceUsd"),
    image: optionalText(input.image),
  };
}

/**
 * Creates or updates an entry by kind and code. A new entry starts as a `draft` with `version: 0`
 * (never published) and needs provenance; an update keeps status, approval, swatch and version. A
 * changed representative shade is unconfirmed again until a fitter confirms it.
 */
export async function upsertEntry(
  ctx: MutationCtx,
  staff: Staff,
  input: CatalogueEntryInput,
  now: number = Date.now(),
): Promise<{ id: EntryId; created: boolean }> {
  const fields = cleanInput(input);
  const sortOrder = optionalAmount(input.sortOrder, "sortOrder");
  const provenance = optionalText(input.provenance);
  const existing = await getEntry(ctx, fields.kind, fields.code);

  if (!existing) {
    if (!provenance) {
      throw appError("INVALID_INPUT", "Record where this entry comes from before adding it.", { field: "provenance" });
    }
    const siblings = await listKind(ctx, fields.kind);
    const nextSortOrder = siblings.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);
    const row: EntryFields = {
      ...fields,
      shadeConfirmed: false,
      inStock: input.inStock ?? true,
      sampleAvailable: input.sampleAvailable ?? false,
      status: "draft",
      version: 0,
      provenance,
      sortOrder: sortOrder ?? nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };
    const id = await ctx.db.insert("atelierCatalogueEntries", row);
    await audit(
      ctx,
      {
        actor: staff,
        action: "catalogue.create",
        targetTable: "atelierCatalogueEntries",
        targetId: id,
        meta: { kind: row.kind, code: row.code, name: row.name },
      },
      now,
    );
    return { id, created: true };
  }

  const shadeChanged = fields.hex !== existing.hex;
  const patch: Partial<EntryFields> = {
    ...fields,
    ...(shadeChanged ? { shadeConfirmed: false } : {}),
    ...(input.inStock !== undefined ? { inStock: input.inStock } : {}),
    ...(input.sampleAvailable !== undefined ? { sampleAvailable: input.sampleAvailable } : {}),
    ...(provenance ? { provenance } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    updatedAt: now,
  };
  await ctx.db.patch(existing._id, patch);
  await audit(
    ctx,
    {
      actor: staff,
      action: "catalogue.update",
      targetTable: "atelierCatalogueEntries",
      targetId: existing._id,
      meta: { kind: existing.kind, code: existing.code, shadeChanged },
    },
    now,
  );
  return { id: existing._id, created: false };
}

/** Moves an entry along `CATALOGUE_TRANSITIONS`; approving records who approved and when. */
export async function setEntryStatus(
  ctx: MutationCtx,
  staff: Staff,
  id: EntryId,
  status: CatalogueStatus,
  now: number = Date.now(),
): Promise<Entry> {
  const entry = await requireEntry(ctx, id);
  if (entry.status === status) {
    throw appError("INVALID_STATE", `${entry.name} is already ${status}.`, { from: entry.status, to: status });
  }
  if (!canTransition(entry.status, status)) {
    throw appError("INVALID_STATE", `${entry.name} cannot go from ${entry.status} to ${status}.`, {
      from: entry.status,
      to: status,
    });
  }
  await ctx.db.patch(entry._id, {
    status,
    ...(status === "approved" ? { approvedBy: staff._id, approvedAt: now } : {}),
    updatedAt: now,
  });
  await audit(
    ctx,
    {
      actor: staff,
      action: "catalogue.status",
      targetTable: "atelierCatalogueEntries",
      targetId: entry._id,
      meta: { kind: entry.kind, code: entry.code, from: entry.status, to: status },
    },
    now,
  );
  return reread(ctx, entry._id);
}

/** A fitter has held the cloth against the shade: records the confirmed hex and who confirmed it. */
export async function confirmShade(
  ctx: MutationCtx,
  staff: Staff,
  id: EntryId,
  hex: string,
  now: number = Date.now(),
): Promise<Entry> {
  const confirmed = normalizeHex(hex);
  const entry = await requireEntry(ctx, id);
  await ctx.db.patch(entry._id, {
    hex: confirmed,
    shadeConfirmed: true,
    approvedBy: staff._id,
    approvedAt: now,
    updatedAt: now,
  });
  await audit(
    ctx,
    {
      actor: staff,
      action: "catalogue.shade",
      targetTable: "atelierCatalogueEntries",
      targetId: entry._id,
      meta: { kind: entry.kind, code: entry.code, from: entry.hex, to: confirmed },
    },
    now,
  );
  return reread(ctx, entry._id);
}

/** Records what the house can supply today. Setting the values already recorded writes nothing. */
export async function setStock(
  ctx: MutationCtx,
  staff: Staff,
  id: EntryId,
  stock: { inStock: boolean; sampleAvailable: boolean },
  now: number = Date.now(),
): Promise<Entry> {
  const entry = await requireEntry(ctx, id);
  if (entry.inStock === stock.inStock && entry.sampleAvailable === stock.sampleAvailable) return entry;
  await ctx.db.patch(entry._id, { inStock: stock.inStock, sampleAvailable: stock.sampleAvailable, updatedAt: now });
  await audit(
    ctx,
    {
      actor: staff,
      action: "catalogue.stock",
      targetTable: "atelierCatalogueEntries",
      targetId: entry._id,
      meta: {
        kind: entry.kind,
        code: entry.code,
        inStock: stock.inStock,
        sampleAvailable: stock.sampleAvailable,
        wasInStock: entry.inStock,
        wasSampleAvailable: entry.sampleAvailable,
      },
    },
    now,
  );
  return reread(ctx, entry._id);
}

export type PublishResult = { version: number; publishedAt: number; stamped: number };

/**
 * Publishes the next catalogue version and stamps every entry changed since the last publish with it.
 * Drafts compare their `catalogueVersion` to this number and revalidate themselves. On a deployment that
 * has never been seeded, publishing is the seed: version 1 with the house's range, credited to the staff
 * member who pressed the button.
 */
export async function publishVersion(
  ctx: MutationCtx,
  staff: Staff,
  note: string,
  now: number = Date.now(),
): Promise<PublishResult> {
  const trimmedNote = requireText(note, "note", "Say what changed in this version.");
  const latest = await latestVersion(ctx);

  if (!latest) {
    const version = await ensureCatalogueSeeded(ctx, now);
    const seeded = await latestVersion(ctx);
    if (seeded) await ctx.db.patch(seeded._id, { publishedBy: staff._id });
    const entries = await listEntries(ctx);
    await audit(
      ctx,
      {
        actor: staff,
        action: "catalogue.publish",
        targetTable: "atelierCatalogueVersions",
        targetId: seeded?._id ?? String(version),
        meta: { version, note: trimmedNote, seeded: true, stamped: entries.length },
      },
      now,
    );
    return { version, publishedAt: now, stamped: entries.length };
  }

  const changed = changedSince(await listEntries(ctx), latest.publishedAt);
  if (changed.length === 0) {
    throw appError("INVALID_STATE", `Nothing has changed since version ${latest.version} was published.`, {
      version: latest.version,
    });
  }
  const version = latest.version + 1;
  const versionId = await ctx.db.insert("atelierCatalogueVersions", {
    version,
    publishedAt: now,
    publishedBy: staff._id,
    note: trimmedNote,
  });
  for (const entry of changed) await ctx.db.patch(entry._id, { version });
  await audit(
    ctx,
    {
      actor: staff,
      action: "catalogue.publish",
      targetTable: "atelierCatalogueVersions",
      targetId: versionId,
      meta: { version, note: trimmedNote, stamped: changed.map((entry) => `${entry.kind}:${entry.code}`) },
    },
    now,
  );
  return { version, publishedAt: now, stamped: changed.length };
}

function fullName(user: Doc<"users"> | null): string | null {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  return email || null;
}

/** Resolves staff names once per call so a list of forty entries does not read the same user forty times. */
function userNameResolver(ctx: Ctx) {
  const cache = new Map<Id<"users">, Promise<string | null>>();
  return (id: Id<"users"> | undefined): Promise<string | null> => {
    if (!id) return Promise.resolve(null);
    let pending = cache.get(id);
    if (!pending) {
      pending = ctx.db.get(id).then(fullName);
      cache.set(id, pending);
    }
    return pending;
  };
}

export async function toStaffEntryViews(
  ctx: Ctx,
  entries: readonly Entry[],
  latest: VersionRow | null,
): Promise<CatalogueStaffEntryView[]> {
  const nameOf = userNameResolver(ctx);
  return Promise.all(
    entries.map(async (entry) => ({
      ...(await toEntryView(ctx, entry)),
      productId: entry.productId,
      provenance: entry.provenance,
      approvedBy: entry.approvedBy ?? null,
      approvedByName: await nameOf(entry.approvedBy),
      approvedAt: entry.approvedAt ?? null,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      pendingPublish: latest ? entry.updatedAt > latest.publishedAt : true,
    })),
  );
}

export async function toStaffEntryView(ctx: Ctx, entry: Entry): Promise<CatalogueStaffEntryView> {
  const [view] = await toStaffEntryViews(ctx, [entry], await latestVersion(ctx));
  return view;
}

export async function toVersionViews(
  ctx: Ctx,
  rows: readonly VersionRow[],
  currentVersion: number,
): Promise<CatalogueVersionView[]> {
  const nameOf = userNameResolver(ctx);
  return Promise.all(
    rows.map(async (row) => ({
      _id: row._id,
      version: row.version,
      publishedAt: row.publishedAt,
      publishedByName: await nameOf(row.publishedBy),
      note: row.note,
      isCurrent: row.version === currentVersion,
    })),
  );
}
