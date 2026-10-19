import { v, type Infer } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { findActivePhoto } from "../model/atelier/photos";
import {
  beginJob as beginPreviewJob,
  cancelPreview,
  completeJob as completePreviewJob,
  expireJobs as expirePreviewJobs,
  failJob as failPreviewJob,
  flagQuality as flagPreviewQuality,
  generationContext as readGenerationContext,
  getJobView,
  listForDraft as listPreviewsForDraft,
  listStaffJobs,
  retryPreview,
  startPreview,
  viewResult as viewPreviewResult,
} from "../model/atelier/previews";
import {
  vClothPattern,
  vDescribedLine,
  vPhotoStatus,
  vPreviewQuality,
  vPreviewStatus,
  vSuitSpec,
} from "../shared/atelier/validators";
import { vTokenUsage } from "../shared/validators";
import { requireActor, requireDraftAccess, requireStaff } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier personal previews (contract §5.4; journeys C09, C10, O06). Thin wrappers over
 * `convex/model/atelier/previews.ts`: client functions resolve the actor and check ownership, the
 * internal ones serve `convex/atelier/generation.ts`, and staff functions need the `preview_ops` role.
 * A result URL is signed and returned only to the owner, or to staff through the audited `viewResult`.
 */

export const vStartPreviewResult = v.object({
  jobId: v.id("atelierPreviewJobs"),
  /** True when a live or finished job for this design and photo was returned instead of starting another. */
  reused: v.boolean(),
});
export type StartPreviewResult = Infer<typeof vStartPreviewResult>;

export const vPreviewJobView = v.object({
  jobId: v.id("atelierPreviewJobs"),
  draftId: v.id("atelierDrafts"),
  status: vPreviewStatus,
  /** The exact words for the state: "Queued", "Working on your preview", "Could not finish", … */
  statusLabel: v.string(),
  quality: vPreviewQuality,
  specLabel: v.string(),
  specHash: v.string(),
  /** False when the design has moved on since this preview was made: "Shows a previous design". */
  isCurrent: v.boolean(),
  /** Signed URL of the result; null unless the job is done and its quality accepted. */
  resultUrl: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  attempt: v.number(),
  revision: v.union(v.number(), v.null()),
  createdAt: v.number(),
  startedAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  cancelledAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
});
export type PreviewJobView = Infer<typeof vPreviewJobView>;

export const vStaffPreviewJobView = v.object({
  jobId: v.id("atelierPreviewJobs"),
  draftId: v.id("atelierDrafts"),
  ownerKind: v.union(v.literal("account"), v.literal("guest")),
  status: vPreviewStatus,
  statusLabel: v.string(),
  quality: vPreviewQuality,
  qualityNote: v.union(v.string(), v.null()),
  specLabel: v.string(),
  specHash: v.string(),
  revision: v.union(v.number(), v.null()),
  attempt: v.number(),
  error: v.union(v.string(), v.null()),
  hasResult: v.boolean(),
  photoStatus: vPhotoStatus,
  usage: v.union(vTokenUsage, v.null()),
  costUsd: v.union(v.number(), v.null()),
  createdAt: v.number(),
  startedAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  cancelledAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
});
export type StaffPreviewJobView = Infer<typeof vStaffPreviewJobView>;

export const vGenerationContext = v.object({
  photoStorageId: v.id("_storage"),
  spec: vSuitSpec,
  lines: v.array(vDescribedLine),
  cloth: v.union(
    v.object({
      name: v.string(),
      mill: v.union(v.string(), v.null()),
      colour: v.string(),
      hex: v.string(),
      pattern: vClothPattern,
      composition: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  specLabel: v.string(),
});
export type GenerationContext = Infer<typeof vGenerationContext>;

/* ------------------------------------------------------------------------------------------ client */

/**
 * Freezes the design and queues one preview of it on the owner's photo. Throws PREVIEWS_UNAVAILABLE when
 * the deployment has no image key, INVALID_INPUT without a cloth, INVALID_STATE without a photo and
 * DAILY_CAP_REACHED past `ATELIER_LIMITS.previewsPerDay`. Idempotent on design hash + photo.
 */
export const start = mutation({
  args: { ...ownerArgs, draftId: v.id("atelierDrafts") },
  returns: vStartPreviewResult,
  handler: async (ctx, { guestKey, draftId }): Promise<StartPreviewResult> => {
    const { draft, actor } = await requireDraftAccess(ctx, draftId, guestKey);
    const photo = await findActivePhoto(ctx, actor);
    return startPreview(ctx, { draft, actor, photo });
  },
});

export const cancel = mutation({
  args: { ...ownerArgs, jobId: v.id("atelierPreviewJobs") },
  returns: v.null(),
  handler: async (ctx, { guestKey, jobId }) => {
    const actor = await requireActor(ctx, guestKey);
    await cancelPreview(ctx, actor, jobId);
    return null;
  },
});

export const listForDraft = query({
  args: { ...ownerArgs, draftId: v.id("atelierDrafts") },
  returns: v.array(vPreviewJobView),
  handler: async (ctx, { guestKey, draftId }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    return listPreviewsForDraft(ctx, draft);
  },
});

export const get = query({
  args: { ...ownerArgs, jobId: v.id("atelierPreviewJobs") },
  returns: vPreviewJobView,
  handler: async (ctx, { guestKey, jobId }) => {
    const actor = await requireActor(ctx, guestKey);
    return getJobView(ctx, actor, jobId);
  },
});

/** A new attempt on the same frozen design, when the photo is still here. */
export const retry = mutation({
  args: { ...ownerArgs, jobId: v.id("atelierPreviewJobs") },
  returns: vStartPreviewResult,
  handler: async (ctx, { guestKey, jobId }): Promise<StartPreviewResult> => {
    const actor = await requireActor(ctx, guestKey);
    return retryPreview(ctx, actor, jobId);
  },
});

/* ---------------------------------------------------------------------------------------- internal */

export const beginJob = internalMutation({
  args: { jobId: v.id("atelierPreviewJobs") },
  returns: v.boolean(),
  handler: async (ctx, { jobId }) => beginPreviewJob(ctx, jobId),
});

export const generationContext = internalQuery({
  args: { jobId: v.id("atelierPreviewJobs") },
  returns: vGenerationContext,
  handler: async (ctx, { jobId }) => readGenerationContext(ctx, jobId),
});

export const completeJob = internalMutation({
  args: { jobId: v.id("atelierPreviewJobs"), resultStorageId: v.id("_storage"), usage: v.optional(vTokenUsage) },
  returns: v.object({ stored: v.boolean() }),
  handler: async (ctx, args) => completePreviewJob(ctx, args),
});

export const failJob = internalMutation({
  args: { jobId: v.id("atelierPreviewJobs"), error: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { jobId, error }) => failPreviewJob(ctx, jobId, error),
});

/** Cron (`convex/crons.ts`): stuck jobs fail retry-ably; finished results past their date expire. */
export const expireJobs = internalMutation({
  args: {},
  returns: v.object({ timedOut: v.number(), expired: v.number() }),
  handler: async (ctx) => expirePreviewJobs(ctx),
});

/* ------------------------------------------------------------------------------- staff: preview_ops */

export const listJobs = query({
  args: { status: v.optional(vPreviewStatus), limit: v.optional(v.number()) },
  returns: v.array(vStaffPreviewJobView),
  handler: async (ctx, { status, limit }) => {
    await requireStaff(ctx, "preview_ops");
    return listStaffJobs(ctx, status, limit);
  },
});

export const flagQuality = mutation({
  args: { jobId: v.id("atelierPreviewJobs"), quality: vPreviewQuality, note: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, quality, note }) => {
    const staff = await requireStaff(ctx, "preview_ops");
    await flagPreviewQuality(ctx, staff, jobId, quality, note);
    return null;
  },
});

/** A mutation, not a query: every staff look at a client's likeness is written to the audit log. */
export const viewResult = mutation({
  args: { jobId: v.id("atelierPreviewJobs") },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
  handler: async (ctx, { jobId }) => {
    const staff = await requireStaff(ctx, "preview_ops");
    return viewPreviewResult(ctx, staff, jobId);
  },
});
