import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { RevisionSummary } from "../../atelier/views";
import type { RevisionReason } from "../../shared/atelier/enums";
import { describeSpec, specHash } from "../../shared/atelier/spec";
import { specNames } from "./catalogue";

type Ctx = QueryCtx | MutationCtx;

/**
 * Immutable snapshots of a draft's design. A submission, a personal preview, a quote and an accepted
 * proposal each freeze the spec they refer to, so an image or a price can never be mistaken for a
 * design it was not made from (journeys C09, C10, C19, C20, C21).
 */

/** Snapshots the draft at its current revision number; returns the existing row when that snapshot already exists. */
export async function createRevision(
  ctx: MutationCtx,
  draft: Doc<"atelierDrafts">,
  reason: RevisionReason,
  now: number = Date.now(),
): Promise<Doc<"atelierRevisions">> {
  const hash = specHash(draft.spec);
  const existing = await ctx.db
    .query("atelierRevisions")
    .withIndex("by_draft_revision", (q) => q.eq("draftId", draft._id).eq("revision", draft.revision))
    .unique();
  if (existing && existing.specHash === hash) return existing;
  const id = await ctx.db.insert("atelierRevisions", {
    draftId: draft._id,
    revision: existing ? draft.revision + 1 : draft.revision,
    spec: draft.spec,
    specHash: hash,
    occasion: draft.occasion,
    eventDate: draft.eventDate,
    catalogueVersion: draft.catalogueVersion,
    reason,
    createdAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Revision insert failed");
  return created;
}

export async function latestRevision(ctx: Ctx, draftId: Id<"atelierDrafts">): Promise<Doc<"atelierRevisions"> | null> {
  return ctx.db
    .query("atelierRevisions")
    .withIndex("by_draft_revision", (q) => q.eq("draftId", draftId))
    .order("desc")
    .first();
}

export async function toRevisionSummary(ctx: Ctx, revision: Doc<"atelierRevisions">): Promise<RevisionSummary> {
  const names = await specNames(ctx, revision.spec);
  return {
    _id: revision._id,
    revision: revision.revision,
    specHash: revision.specHash,
    reason: revision.reason,
    createdAt: revision.createdAt,
    spec: revision.spec,
    lines: describeSpec(revision.spec, names),
  };
}
