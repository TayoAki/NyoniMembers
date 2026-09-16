import { start } from "@convex-dev/workflow";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "../lib/errors";
import { extractionCreditCost, LIMITS } from "../shared/credits";
import { INGEST_STEPS } from "../shared/jobs";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../shared/wardrobe";
import type { UploadView } from "../views";
import { refund, reserve, shortfallError } from "./credits";
import { assertBelowJobLimit, completeJob, createJob, getJob, setStep, setWorkflowId, type StepInput } from "./jobs";

type Ctx = QueryCtx | MutationCtx;

export type UploadFileInput = { storageId: Id<"_storage">; fileName: string; mimeType: string; sizeBytes: number };

export async function toUploadView(ctx: Ctx, upload: Doc<"uploads">): Promise<UploadView> {
  return {
    _id: upload._id,
    batchId: upload.batchId,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    status: upload.status,
    detectedCount: upload.detectedCount,
    jobId: upload.jobId,
    url: await ctx.storage.getUrl(upload.storageId),
    createdAt: upload.createdAt,
  };
}

/** Rejects the batch before any row is written: count, mime type and size all have hard caps. */
export function assertValidFiles(files: UploadFileInput[]): void {
  if (files.length === 0) throw appError("INVALID_INPUT", "Pick at least one photo.");
  if (files.length > LIMITS.maxPhotosPerUpload) {
    throw appError("INVALID_INPUT", `You can add up to ${LIMITS.maxPhotosPerUpload} photos at a time.`, {
      limit: LIMITS.maxPhotosPerUpload,
    });
  }
  const accepted = Object.keys(ACCEPTED_IMAGE_TYPES);
  for (const file of files) {
    if (!accepted.includes(file.mimeType)) {
      throw appError("INVALID_INPUT", `"${file.fileName}" isn't a supported image (${file.mimeType}).`, {
        accepted,
      });
    }
    if (file.sizeBytes <= 0 || file.sizeBytes > MAX_UPLOAD_BYTES) {
      throw appError("INVALID_INPUT", `"${file.fileName}" is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`, {
        maxBytes: MAX_UPLOAD_BYTES,
      });
    }
  }
}

export async function listBatch(ctx: Ctx, userId: Id<"users">, batchId: string): Promise<Doc<"uploads">[]> {
  const uploads = await ctx.db
    .query("uploads")
    .withIndex("by_batch", (q) => q.eq("batchId", batchId))
    .collect();
  return uploads.filter((upload) => upload.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Reserves credits for a set of already-detected items and starts the extraction workflow.
 * Shared by uploads.resume (a partial run finished by a top-up) and items.reextract.
 * Credits are taken up front so the caller fails fast instead of half-running.
 */
export async function startExtractionJob(
  ctx: MutationCtx,
  user: Doc<"users">,
  itemIds: Id<"items">[],
  uploadId?: Id<"uploads">,
): Promise<Id<"jobs">> {
  if (itemIds.length === 0) throw appError("INVALID_INPUT", "There's nothing left to extract here.");
  await assertBelowJobLimit(ctx, user._id);

  const needed = extractionCreditCost(itemIds.length);
  const steps: StepInput[] = [
    { key: INGEST_STEPS.reserve },
    ...itemIds.map((_, index) => ({ key: `${INGEST_STEPS.extract}:${index}` })),
    { key: INGEST_STEPS.finalize },
  ];
  const jobId = await createJob(ctx, user, { type: "ingest", steps, uploadId }, { bypassLimit: true });

  const result = await reserve(ctx, user, needed, jobId);
  if (result.granted < needed) {
    await refund(ctx, await getJob(ctx, jobId), result.granted, "Not enough credits to start");
    await completeJob(ctx, jobId, { status: "failed", error: "Not enough credits" });
    throw shortfallError(result, needed);
  }
  await setStep(ctx, jobId, INGEST_STEPS.reserve, { status: "done", meta: { credits: needed } });

  const now = Date.now();
  for (const itemId of itemIds) await ctx.db.patch(itemId, { status: "extracting", updatedAt: now });

  const workflowId = await start(
    ctx,
    internal.workflows.ingest.extractItems,
    { jobId, itemIds },
    { onComplete: internal.workflows.ingest.onIngestComplete, context: { jobId } },
  );
  await setWorkflowId(ctx, jobId, workflowId);
  if (uploadId) await ctx.db.patch(uploadId, { status: "extracting" });
  return jobId;
}

/**
 * Registers uploaded photos as one batch: an `uploads` row plus an ingest job + workflow per photo.
 * The running-job cap is checked once for the whole batch (a 20-photo drop is one user action).
 * Shared by uploads.createBatch and the dev smoke test.
 */
export async function createBatch(
  ctx: MutationCtx,
  user: Doc<"users">,
  files: UploadFileInput[],
): Promise<{ batchId: string; uploads: Array<{ uploadId: Id<"uploads">; jobId: Id<"jobs"> }> }> {
  assertValidFiles(files);
  await assertBelowJobLimit(ctx, user._id);

  const batchId = crypto.randomUUID();
  const now = Date.now();
  const uploads: Array<{ uploadId: Id<"uploads">; jobId: Id<"jobs"> }> = [];

  for (const file of files) {
    const uploadId = await ctx.db.insert("uploads", {
      userId: user._id,
      batchId,
      storageId: file.storageId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: "queued",
      createdAt: now,
    });
    const jobId = await createJob(
      ctx,
      user,
      {
        type: "ingest",
        steps: [
          { key: INGEST_STEPS.upload },
          { key: INGEST_STEPS.detect },
          { key: INGEST_STEPS.reserve },
          { key: INGEST_STEPS.finalize },
        ],
        uploadId,
      },
      { bypassLimit: true },
    );
    await setStep(ctx, jobId, INGEST_STEPS.upload, { status: "done" });
    await ctx.db.patch(uploadId, { jobId });

    const workflowId = await start(
      ctx,
      internal.workflows.ingest.ingestUpload,
      { uploadId, jobId },
      { onComplete: internal.workflows.ingest.onIngestComplete, context: { jobId } },
    );
    await setWorkflowId(ctx, jobId, workflowId);
    uploads.push({ uploadId, jobId });
  }

  return { batchId, uploads };
}
