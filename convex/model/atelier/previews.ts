import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, ownerFieldsFor, requireOwned, type Actor, type Owned } from "../../atelier/access";
import type {
  GenerationContext,
  PreviewJobView,
  StaffPreviewJobView,
  StartPreviewResult,
} from "../../atelier/previews";
import { optionalEnv } from "../../lib/env";
import { appError } from "../../lib/errors";
import {
  ATELIER_LIMITS,
  PREVIEW_STATUS_LABELS,
  type PreviewQuality,
  type PreviewStatus,
} from "../../shared/atelier/enums";
import { describeSpec, specHash, specSummary, type DescribedLine } from "../../shared/atelier/spec";
import { usageToUsd, type TokenUsage } from "../../shared/credits";
import { getEntry, specNames } from "./catalogue";
import { createRevision } from "./revisions";
import { DAY_MS, deleteFile, expireJobResult } from "./photos";

type Ctx = QueryCtx | MutationCtx;
type Job = Doc<"atelierPreviewJobs">;
type Draft = Doc<"atelierDrafts">;
type Photo = Doc<"atelierPersonPhotos">;

/**
 * Personal previews (contract §5.4; journeys C09, C10, O06; scenarios 3, 4, 10, 16). A job is one
 * idempotent request to dress one photograph in one frozen revision of a design. The result can only
 * ever claim the revision it was made from: `isCurrent` compares the job's hash with the draft's, a
 * cancelled or photo-less job discards a late result, and no job here changes the design itself.
 */

const MAX_ERROR_CHARS = 240;
const LIST_MAX = 24;
const STAFF_LIST_MAX = 100;
const EXPIRE_BATCH = 100;
const KEY_SCAN = 20;

export const PREVIEWS_UNAVAILABLE_MESSAGE =
  "Personal previews are not switched on for this atelier yet. Your design is saved, the studio illustration shows every choice you have made, and a concierge can still review it.";

export type PreviewEnv = { OPENAI_API_KEY?: string; AI_GATEWAY_API_KEY?: string };

/** Previews run only when the deployment holds a key for the image provider; otherwise the feature says so. */
export function previewsAvailable(env: PreviewEnv): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim() || env.AI_GATEWAY_API_KEY?.trim());
}

export function assertPreviewsAvailable(): void {
  const env: PreviewEnv = {
    OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),
    AI_GATEWAY_API_KEY: optionalEnv("AI_GATEWAY_API_KEY"),
  };
  if (!previewsAvailable(env)) throw appError("PREVIEWS_UNAVAILABLE", PREVIEWS_UNAVAILABLE_MESSAGE);
}

export function idempotencyKey(draftId: Id<"atelierDrafts">, hash: string, photoId: Id<"atelierPersonPhotos">): string {
  return `${draftId}:${hash}:${photoId}`;
}

export function startOfUtcDay(now: number): number {
  return now - (now % DAY_MS);
}

function jobOwner(doc: Owned, actor: Actor): Owned {
  if (doc.userId !== undefined) return { userId: doc.userId };
  if (doc.guestKey !== undefined) return { guestKey: doc.guestKey };
  return ownerFieldsFor(actor);
}

function ownerJobsSince(ctx: Ctx, owner: Owned, since: number) {
  const userId = owner.userId;
  if (userId !== undefined) {
    return ctx.db
      .query("atelierPreviewJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId).gte("createdAt", since));
  }
  const guestKey = owner.guestKey;
  return ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey).gte("createdAt", since));
}

/** A budget, not a credit: `previewsPerDay` starts per owner per UTC day, reused jobs not counted. */
export async function assertDailyBudget(ctx: Ctx, owner: Owned, now: number): Promise<void> {
  const limit = ATELIER_LIMITS.previewsPerDay;
  const today = await ownerJobsSince(ctx, owner, startOfUtcDay(now)).take(limit + 1);
  if (today.length >= limit) {
    throw appError(
      "DAILY_CAP_REACHED",
      `You have asked for ${limit} previews today, the most the house makes in a day. Your design is saved; ask again tomorrow.`,
      { limit, resetsAt: startOfUtcDay(now) + DAY_MS },
    );
  }
}

/** A job the client can be pointed back to instead of starting another for the same photograph and design. */
export function isReusable(job: Job, now: number): boolean {
  if (job.status === "queued" || job.status === "processing") return true;
  if (job.status !== "done" || job.quality === "rejected") return false;
  return job.expiresAt === undefined || job.expiresAt > now;
}

async function jobsForKey(ctx: Ctx, key: string): Promise<Job[]> {
  return ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
    .order("desc")
    .take(KEY_SCAN);
}

export type StartPreviewInput = {
  draft: Draft;
  actor: Actor;
  /** The owner's active photograph, or null when there is none. */
  photo: Photo | null;
};

/**
 * Freezes the design (`reason: "preview"`), reuses a live or finished job for the same design and
 * photograph, otherwise checks the day's budget, queues one job and schedules the generation.
 */
export async function startPreview(
  ctx: MutationCtx,
  input: StartPreviewInput,
  now: number = Date.now(),
): Promise<StartPreviewResult> {
  const { draft, actor } = input;
  assertPreviewsAvailable();
  if (!draft.spec.clothCode) {
    throw appError("INVALID_INPUT", "Choose a cloth first: the preview dresses you in it.");
  }
  const cloth = await getEntry(ctx, "cloth", draft.spec.clothCode);
  if (!cloth) {
    throw appError(
      "INVALID_INPUT",
      "That cloth is no longer in the catalogue. Choose another before asking for a preview.",
    );
  }
  const photo = input.photo;
  if (!photo || photo.status !== "active") throw appError("INVALID_STATE", "Add a photo first.");

  const revision = await createRevision(ctx, draft, "preview", now);
  const key = idempotencyKey(draft._id, revision.specHash, photo._id);
  const existing = (await jobsForKey(ctx, key)).find((job) => isReusable(job, now));
  if (existing) {
    await pointDraftAt(ctx, draft, existing, photo);
    return { jobId: existing._id, reused: true };
  }

  const owner = jobOwner(draft, actor);
  await assertDailyBudget(ctx, owner, now);
  const jobId = await ctx.db.insert("atelierPreviewJobs", {
    ...owner,
    draftId: draft._id,
    personPhotoId: photo._id,
    revisionId: revision._id,
    specHash: revision.specHash,
    specLabel: specSummary(revision.spec, cloth.name),
    idempotencyKey: key,
    status: "queued",
    quality: "pending",
    attempt: 1,
    createdAt: now,
  });
  await ctx.db.patch(draft._id, {
    currentPreviewJobId: jobId,
    ...(draft.personPhotoId === photo._id ? {} : { personPhotoId: photo._id }),
  });
  await ctx.scheduler.runAfter(0, internal.atelier.generation.generatePersonalPreview, { jobId });
  await audit(
    ctx,
    {
      actor,
      action: "preview.start",
      targetTable: "atelierPreviewJobs",
      targetId: jobId,
      meta: { draftId: draft._id, revision: revision.revision, attempt: 1 },
    },
    now,
  );
  return { jobId, reused: false };
}

async function pointDraftAt(ctx: MutationCtx, draft: Draft, job: Job, photo: Photo): Promise<void> {
  const patch: Partial<Pick<Draft, "currentPreviewJobId" | "personPhotoId">> = {};
  if (draft.currentPreviewJobId !== job._id) patch.currentPreviewJobId = job._id;
  if (draft.personPhotoId !== photo._id) patch.personPhotoId = photo._id;
  if (Object.keys(patch).length > 0) await ctx.db.patch(draft._id, patch);
}

/** Queued or processing → cancelled. A finished job cannot be un-made; cancelling twice is harmless. */
export async function cancelPreview(
  ctx: MutationCtx,
  actor: Actor,
  jobId: Id<"atelierPreviewJobs">,
  now: number = Date.now(),
): Promise<void> {
  const job = requireOwned(await ctx.db.get(jobId), actor, "preview");
  if (job.status === "cancelled") return;
  if (job.status !== "queued" && job.status !== "processing") {
    throw appError(
      "INVALID_STATE",
      `This preview is ${PREVIEW_STATUS_LABELS[job.status].toLowerCase()} and can no longer be cancelled.`,
    );
  }
  await ctx.db.patch(job._id, { status: "cancelled", cancelledAt: now });
  await audit(ctx, { actor, action: "preview.cancel", targetTable: "atelierPreviewJobs", targetId: job._id }, now);
}

/**
 * A failed, expired or cancelled job is tried again as a new job on the same frozen revision, when the
 * photograph it needs is still here. The attempt number carries on from the last one for that design.
 */
export async function retryPreview(
  ctx: MutationCtx,
  actor: Actor,
  jobId: Id<"atelierPreviewJobs">,
  now: number = Date.now(),
): Promise<StartPreviewResult> {
  const job = requireOwned(await ctx.db.get(jobId), actor, "preview");
  if (job.status === "queued" || job.status === "processing") {
    throw appError("INVALID_STATE", "This preview is still being made.");
  }
  if (job.status === "done") {
    throw appError("INVALID_STATE", "This preview is ready. Change the design to ask for another.");
  }
  assertPreviewsAvailable();
  const photo = await ctx.db.get(job.personPhotoId);
  if (!photo || photo.status !== "active") throw appError("INVALID_STATE", "Add a photo first.");
  const draft = await ctx.db.get(job.draftId);
  if (!draft) throw appError("NOT_FOUND", "That design doesn't exist.");

  const live = (await jobsForKey(ctx, job.idempotencyKey)).find(
    (other) => other.status === "queued" || other.status === "processing",
  );
  if (live) return { jobId: live._id, reused: true };

  const owner = jobOwner(job, actor);
  await assertDailyBudget(ctx, owner, now);
  const attempt =
    Math.max(job.attempt, ...(await jobsForKey(ctx, job.idempotencyKey)).map((other) => other.attempt)) + 1;
  const nextId = await ctx.db.insert("atelierPreviewJobs", {
    ...owner,
    draftId: job.draftId,
    personPhotoId: job.personPhotoId,
    revisionId: job.revisionId,
    specHash: job.specHash,
    specLabel: job.specLabel,
    idempotencyKey: job.idempotencyKey,
    status: "queued",
    quality: "pending",
    attempt,
    createdAt: now,
  });
  if (specHash(draft.spec) === job.specHash) await ctx.db.patch(draft._id, { currentPreviewJobId: nextId });
  await ctx.scheduler.runAfter(0, internal.atelier.generation.generatePersonalPreview, { jobId: nextId });
  await audit(
    ctx,
    {
      actor,
      action: "preview.retry",
      targetTable: "atelierPreviewJobs",
      targetId: nextId,
      meta: { previousJobId: job._id, attempt },
    },
    now,
  );
  return { jobId: nextId, reused: false };
}

export async function toJobView(ctx: Ctx, job: Job, draftHash: string | null): Promise<PreviewJobView> {
  const revision = await ctx.db.get(job.revisionId);
  const showResult = job.status === "done" && job.quality === "accepted" && job.resultStorageId !== undefined;
  return {
    jobId: job._id,
    draftId: job.draftId,
    status: job.status,
    statusLabel: PREVIEW_STATUS_LABELS[job.status],
    quality: job.quality,
    specLabel: job.specLabel,
    specHash: job.specHash,
    isCurrent: draftHash !== null && job.specHash === draftHash,
    resultUrl: showResult && job.resultStorageId ? await ctx.storage.getUrl(job.resultStorageId) : null,
    error: job.error ?? null,
    attempt: job.attempt,
    revision: revision?.revision ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    cancelledAt: job.cancelledAt ?? null,
    expiresAt: job.expiresAt ?? null,
  };
}

/** Newest first; each job says whether it still shows the design as it stands (C10, scenario 3). */
export async function listForDraft(ctx: Ctx, draft: Draft): Promise<PreviewJobView[]> {
  const hash = specHash(draft.spec);
  const jobs = await ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .order("desc")
    .take(LIST_MAX);
  return Promise.all(jobs.map((job) => toJobView(ctx, job, hash)));
}

export async function getJobView(ctx: Ctx, actor: Actor, jobId: Id<"atelierPreviewJobs">): Promise<PreviewJobView> {
  const job = requireOwned(await ctx.db.get(jobId), actor, "preview");
  const draft = await ctx.db.get(job.draftId);
  return toJobView(ctx, job, draft ? specHash(draft.spec) : null);
}

/* ---------------------------------------------------------------- generation lifecycle (internal) */

/** queued → processing. False when the job was cancelled or its photograph is gone, so the action stops. */
export async function beginJob(
  ctx: MutationCtx,
  jobId: Id<"atelierPreviewJobs">,
  now: number = Date.now(),
): Promise<boolean> {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "queued") return false;
  const photo = await ctx.db.get(job.personPhotoId);
  if (!photo || photo.status !== "active") {
    await ctx.db.patch(job._id, {
      status: "cancelled",
      cancelledAt: now,
      error: "The photograph was removed before this preview began.",
    });
    return false;
  }
  await ctx.db.patch(job._id, { status: "processing", startedAt: now });
  return true;
}

/** Everything the Node action needs, read in one query so it never touches the tables itself. */
export async function generationContext(ctx: Ctx, jobId: Id<"atelierPreviewJobs">): Promise<GenerationContext> {
  const job = await ctx.db.get(jobId);
  if (!job) throw appError("NOT_FOUND", "That preview no longer exists.");
  if (job.status !== "processing") throw appError("INVALID_STATE", "This preview is not being made right now.");
  const [photo, revision] = await Promise.all([ctx.db.get(job.personPhotoId), ctx.db.get(job.revisionId)]);
  if (!photo || photo.status !== "active") throw appError("INVALID_STATE", "The photograph is no longer available.");
  if (!revision) throw appError("NOT_FOUND", "The design this preview was asked for no longer exists.");
  const [names, cloth] = await Promise.all([
    specNames(ctx, revision.spec),
    revision.spec.clothCode ? getEntry(ctx, "cloth", revision.spec.clothCode) : null,
  ]);
  return {
    photoStorageId: photo.storageId,
    spec: revision.spec,
    lines: describeSpec(revision.spec, names),
    cloth: cloth
      ? {
          name: cloth.name,
          mill: cloth.mill ?? null,
          colour: cloth.colour,
          hex: cloth.hex,
          pattern: cloth.pattern,
          composition: cloth.composition ?? null,
        }
      : null,
    specLabel: job.specLabel,
  };
}

export type CompleteJobInput = {
  jobId: Id<"atelierPreviewJobs">;
  resultStorageId: Id<"_storage">;
  usage?: TokenUsage;
};

/**
 * processing → done, quality accepted, with an expiry. A result for a job that was cancelled, expired
 * or whose photograph is gone is deleted unseen (scenario 4): a late callback never becomes current.
 */
export async function completeJob(
  ctx: MutationCtx,
  input: CompleteJobInput,
  now: number = Date.now(),
): Promise<{ stored: boolean }> {
  const job = await ctx.db.get(input.jobId);
  if (!job || job.status !== "processing" || job.cancelledAt !== undefined) {
    await deleteFile(ctx, input.resultStorageId);
    return { stored: false };
  }
  const photo = await ctx.db.get(job.personPhotoId);
  if (!photo || photo.status !== "active") {
    await deleteFile(ctx, input.resultStorageId);
    await ctx.db.patch(job._id, {
      status: "cancelled",
      cancelledAt: now,
      error: "The photograph was removed before this preview finished.",
    });
    return { stored: false };
  }
  await ctx.db.patch(job._id, {
    status: "done",
    quality: "accepted",
    resultStorageId: input.resultStorageId,
    completedAt: now,
    expiresAt: now + ATELIER_LIMITS.previewResultDays * DAY_MS,
    ...(input.usage ? { usage: input.usage, costUsd: usageToUsd(input.usage) } : {}),
  });
  return { stored: true };
}

/** queued/processing → failed with a short human reason. A cancelled job keeps its cancellation. */
export async function failJob(
  ctx: MutationCtx,
  jobId: Id<"atelierPreviewJobs">,
  error: string,
  now: number = Date.now(),
): Promise<boolean> {
  const job = await ctx.db.get(jobId);
  if (!job || (job.status !== "queued" && job.status !== "processing")) return false;
  await ctx.db.patch(job._id, { status: "failed", error: error.slice(0, MAX_ERROR_CHARS), completedAt: now });
  return true;
}

export const TIMED_OUT_MESSAGE = "Could not finish in time. You can try again.";
export const NEVER_STARTED_MESSAGE = "The preview did not start. You can try again.";

/** Cron: jobs stuck longer than the timeout fail retry-ably; finished results past their date expire. */
export async function expireJobs(
  ctx: MutationCtx,
  now: number = Date.now(),
): Promise<{ timedOut: number; expired: number }> {
  const cutoff = now - ATELIER_LIMITS.previewTimeoutMinutes * 60_000;
  let timedOut = 0;
  for (const status of ["processing", "queued"] as const) {
    const stuck = await ctx.db
      .query("atelierPreviewJobs")
      .withIndex("by_status", (q) => q.eq("status", status).lt("createdAt", cutoff))
      .take(EXPIRE_BATCH);
    for (const job of stuck) {
      if ((job.startedAt ?? job.createdAt) >= cutoff) continue;
      await ctx.db.patch(job._id, {
        status: "failed",
        error: status === "processing" ? TIMED_OUT_MESSAGE : NEVER_STARTED_MESSAGE,
        completedAt: now,
      });
      timedOut += 1;
    }
  }
  const done = await ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_status", (q) => q.eq("status", "done"))
    .order("asc")
    .take(EXPIRE_BATCH);
  let expired = 0;
  for (const job of done) {
    if (job.expiresAt === undefined || job.expiresAt > now) continue;
    await expireJobResult(ctx, job, now);
    expired += 1;
  }
  return { timedOut, expired };
}

/* ------------------------------------------------------------------------------- staff (preview_ops) */

export async function toStaffJobView(ctx: Ctx, job: Job): Promise<StaffPreviewJobView> {
  const [revision, photo] = await Promise.all([ctx.db.get(job.revisionId), ctx.db.get(job.personPhotoId)]);
  return {
    jobId: job._id,
    draftId: job.draftId,
    ownerKind: job.userId !== undefined ? "account" : "guest",
    status: job.status,
    statusLabel: PREVIEW_STATUS_LABELS[job.status],
    quality: job.quality,
    qualityNote: job.qualityNote ?? null,
    specLabel: job.specLabel,
    specHash: job.specHash,
    revision: revision?.revision ?? null,
    attempt: job.attempt,
    error: job.error ?? null,
    hasResult: job.status === "done" && job.resultStorageId !== undefined,
    photoStatus: photo?.status ?? "deleted",
    usage: job.usage ?? null,
    costUsd: job.costUsd ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    cancelledAt: job.cancelledAt ?? null,
    expiresAt: job.expiresAt ?? null,
  };
}

export async function listStaffJobs(
  ctx: Ctx,
  status: PreviewStatus | undefined,
  limit: number = STAFF_LIST_MAX,
): Promise<StaffPreviewJobView[]> {
  const bounded = Math.max(1, Math.min(limit, STAFF_LIST_MAX));
  const jobs = status
    ? await ctx.db
        .query("atelierPreviewJobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(bounded)
    : await ctx.db.query("atelierPreviewJobs").order("desc").take(bounded);
  return Promise.all(jobs.map((job) => toStaffJobView(ctx, job)));
}

/** A rejected result stays stored for the client's record but is no longer shown as a preview. */
export async function flagQuality(
  ctx: MutationCtx,
  staff: Doc<"users">,
  jobId: Id<"atelierPreviewJobs">,
  quality: PreviewQuality,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const job = await ctx.db.get(jobId);
  if (!job) throw appError("NOT_FOUND", "That preview no longer exists.");
  if (job.status !== "done") throw appError("INVALID_STATE", "Only a finished preview can be flagged.");
  await ctx.db.patch(job._id, { quality, qualityNote: note.trim().slice(0, MAX_ERROR_CHARS) || undefined });
  await audit(
    ctx,
    {
      actor: staff,
      action: "preview.quality",
      targetTable: "atelierPreviewJobs",
      targetId: job._id,
      meta: { quality, note: note.trim().slice(0, MAX_ERROR_CHARS) },
    },
    now,
  );
}

/** A staff read of a client's result is a read of their likeness: always audited as "photo.view" (O06). */
export async function viewResult(
  ctx: MutationCtx,
  staff: Doc<"users">,
  jobId: Id<"atelierPreviewJobs">,
  now: number = Date.now(),
): Promise<{ url: string | null }> {
  const job = await ctx.db.get(jobId);
  if (!job) throw appError("NOT_FOUND", "That preview no longer exists.");
  if (job.status !== "done" || !job.resultStorageId)
    throw appError("INVALID_STATE", "This preview has no result to view.");
  const url = await ctx.storage.getUrl(job.resultStorageId);
  await audit(
    ctx,
    {
      actor: staff,
      action: "photo.view",
      targetTable: "atelierPreviewJobs",
      targetId: job._id,
      meta: { kind: "preview_result" },
    },
    now,
  );
  return { url };
}

/* ------------------------------------------------------------------------------------------ prompt */

const VISIBLE_SECTIONS: ReadonlySet<DescribedLine["section"]> = new Set(["Jacket", "Trousers", "Waistcoat"]);
/** Interior and construction choices the camera cannot see are left out so the model does not invent them. */
const HIDDEN_LABELS: ReadonlySet<string> = new Set(["Working cuffs", "Construction", "Lining", "Monogram"]);

export type PromptCloth = {
  name: string;
  mill: string | null;
  colour: string;
  hex: string;
  pattern: string;
  composition: string | null;
};

export type PromptInput = { spec: GenerationContext["spec"]; lines: DescribedLine[]; cloth: PromptCloth | null };

/**
 * Dresses the person in the photograph in exactly this suit while keeping who and where they are. The
 * cloth is named by its representative shade and pattern because the catalogue photographs are of mill
 * books, not flat swatches; the words come from `describeSpec` so the preview and the order book agree.
 */
export function previewPrompt(input: PromptInput): string {
  const { spec, cloth } = input;
  const garment = input.lines.find((line) => line.section === "Garment")?.value ?? "suit";
  const clothLine = cloth
    ? `${cloth.name}${cloth.mill ? ` by ${cloth.mill}` : ""}: ${cloth.colour.toLowerCase()}, ${patternPhrase(cloth.pattern)}, representative shade ${cloth.hex.toUpperCase()}${cloth.composition ? `, ${cloth.composition.toLowerCase()}` : ""}.`
    : "a plain mid-grey worsted wool.";
  const details = input.lines
    .filter((line) => VISIBLE_SECTIONS.has(line.section) && !HIDDEN_LABELS.has(line.label))
    .map((line) => `- ${line.section} ${line.label.toLowerCase()}: ${line.value}`);
  const buttons = input.lines.find((line) => line.section === "Details" && line.label === "Buttons");
  if (buttons && spec.buttonCode) details.push(`- Buttons: ${buttons.value}`);

  const tuxedo = spec.garment === "tuxedo";
  const threePiece = spec.garment === "three_piece" && spec.waistcoat !== null;
  const underneath = tuxedo
    ? "a crisp white evening shirt with a black bow tie, and black patent or polished leather shoes"
    : "a plain white shirt with a quiet dark tie, and dark leather shoes unless the photograph already shows formal shoes";

  return [
    "Image 1 is a photograph of the person to dress. Keep this exact person: face, hair, skin tone, body proportions, hands, pose, background, lighting and camera framing stay exactly as they are. Change only the clothing.",
    "",
    `Dress them in a made-to-measure ${garment.toLowerCase()} cut from this cloth: ${clothLine}`,
    "The suit's colour must read as that shade across jacket and trousers, with natural shading from the folds; show the pattern at true scale.",
    "",
    "The cut, exactly as the house will make it:",
    ...details,
    tuxedo ? "- Black-tie finish: satin facings on the lapels and a satin stripe down the trouser outseam" : null,
    threePiece
      ? "- The jacket is worn buttoned with the waistcoat showing in the V; the waistcoat covers the waistband"
      : "- The jacket is worn buttoned at the waist button",
    "",
    `Underneath, ${underneath}. Sleeves show a sliver of shirt cuff; trousers break once at the shoe; the drape matches the cloth's weight.`,
    "Do not add logos, text, hats, bags or props. Do not slim, lengthen or otherwise alter the body. Keep the result photographic, as if the same photograph had been taken in this suit.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function patternPhrase(pattern: string): string {
  switch (pattern) {
    case "solid":
      return "a plain solid weave";
    case "stripe":
    case "pinstripe":
    case "chalk_stripe":
      return `a ${pattern.replace("_", " ")} pattern`;
    default:
      return `a ${pattern.replace(/_/g, " ")} pattern`;
  }
}
