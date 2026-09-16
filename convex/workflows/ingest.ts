import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { refund } from "../model/credits";
import { completeJob, getJob, setStep } from "../model/jobs";
import { INGEST_STEPS, isTerminalJobStatus, type JobStatus } from "../shared/jobs";
import { workflow } from "./manager";

/**
 * Ingest one uploaded photo: detect (free) → reserve credits → extract each item in parallel →
 * tag/embed → done. Started by uploads.createBatch with:
 *   start(ctx, internal.workflows.ingest.ingestUpload, { uploadId, jobId },
 *         { onComplete: internal.workflows.ingest.onIngestComplete, context: { jobId } })
 * Step keys follow convex/shared/jobs.ts (INGEST_STEPS, `extract:<n>`).
 */

export type IngestOutcome = { extracted: number; failed: number; skipped: number };

const vIngestOutcome = v.object({ extracted: v.number(), failed: v.number(), skipped: v.number() });

type SettledStatus = Extract<JobStatus, "done" | "partial" | "failed" | "cancelled">;
type UploadStatus = Doc<"uploads">["status"];

export const ingestUpload = workflow
  .define({ args: { uploadId: v.id("uploads"), jobId: v.id("jobs") }, returns: vIngestOutcome })
  .handler(async (step, args): Promise<IngestOutcome> => {
    await step.runMutation(internal.ai.pipeline.beginIngest, { uploadId: args.uploadId, jobId: args.jobId });

    const detected = await step.runAction(
      internal.ai.openai.detectItems,
      { uploadId: args.uploadId, jobId: args.jobId },
      { retry: true },
    );

    const plan = await step.runMutation(internal.ai.pipeline.recordDetection, {
      jobId: args.jobId,
      uploadId: args.uploadId,
      items: detected,
    });

    const results = await Promise.all(
      plan.toExtract.map(async ({ itemId, stepKey }) => {
        try {
          await step.runAction(internal.ai.openai.extractItem, { itemId, jobId: args.jobId, stepKey }, { retry: true });
          return true;
        } catch {
          // The item and its step were already marked failed by the action; onIngestComplete refunds.
          return false;
        }
      }),
    );

    const extracted = results.filter(Boolean).length;
    return { extracted, failed: results.length - extracted, skipped: plan.skipped };
  });

/**
 * Extract (or re-extract) specific items that already exist as `needsCredits` / `ready` rows.
 * Used by uploads.resume and items.reextract, which reserve the credits (fail fast) before starting this;
 * the workflow itself only extracts, and onIngestComplete refunds whatever failed.
 */
export const extractItems = workflow
  .define({ args: { jobId: v.id("jobs"), itemIds: v.array(v.id("items")) }, returns: vIngestOutcome })
  .handler(async (step, args): Promise<IngestOutcome> => {
    const targets = await step.runMutation(internal.ai.pipeline.beginExtractItems, {
      jobId: args.jobId,
      itemIds: args.itemIds,
    });

    const results = await Promise.all(
      targets.map(async ({ itemId, stepKey }) => {
        try {
          await step.runAction(internal.ai.openai.extractItem, { itemId, jobId: args.jobId, stepKey }, { retry: true });
          return true;
        } catch {
          return false;
        }
      }),
    );

    const extracted = results.filter(Boolean).length;
    return {
      extracted,
      failed: results.length - extracted,
      skipped: args.itemIds.length - targets.length,
    };
  });

/** Settles the job: refunds failed extractions, sets upload + job status (done / partial / failed). */
export const onIngestComplete = internalMutation({
  args: { workflowId: vWorkflowId, result: vResultValidator, context: v.object({ jobId: v.id("jobs") }) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await getJob(ctx, args.context.jobId);
    if (isTerminalJobStatus(job.status)) return null;

    const steps = job.steps.filter((step) => step.key.startsWith(`${INGEST_STEPS.extract}:`));
    const extracted = steps.filter((step) => step.status === "done").length;
    const failed = steps.length - extracted;

    // One credit was reserved per item we meant to extract; everything that didn't produce a cutout
    // goes back to the user. `refund` caps itself at what this job still owes.
    const unused = job.reservation.plan + job.reservation.pack - extracted;
    if (unused > 0) await refund(ctx, job, unused, "Extraction failed");

    const needsCredits = job.uploadId ? await countNeedsCredits(ctx, job.uploadId) : 0;
    const stepError = steps.find((step) => step.status === "failed")?.error;

    let status: SettledStatus;
    let error: string | undefined;
    if (args.result.kind === "canceled") {
      status = "cancelled";
      error = "Cancelled before every item was extracted.";
    } else if (args.result.kind === "failed") {
      status = "failed";
      error = args.result.error;
    } else if (steps.length > 0 && extracted === 0) {
      status = "failed";
      error = stepError ?? "Nothing could be extracted from this photo.";
    } else if (failed > 0 || needsCredits > 0) {
      status = "partial";
      error = failed > 0 ? stepError : undefined;
    } else {
      status = "done";
    }

    if (job.uploadId) {
      const upload = await ctx.db.get(job.uploadId);
      if (upload) await ctx.db.patch(job.uploadId, { status: uploadStatus(status, extracted) });
    }

    if (job.steps.some((step) => step.key === INGEST_STEPS.finalize)) {
      await setStep(ctx, job._id, INGEST_STEPS.finalize, {
        status: "done",
        meta: { extracted, failed, needsCredits, refunded: Math.max(0, unused) },
      });
    }
    await completeJob(ctx, job._id, { status, error });
    return null;
  },
});

function uploadStatus(status: SettledStatus, extracted: number): UploadStatus {
  if (status === "done") return "done";
  if (status === "partial") return "partial";
  return extracted > 0 ? "partial" : "failed";
}

/** Items detected but left unextracted because the user ran out of credits; a photo yields ≤ 12. */
async function countNeedsCredits(ctx: MutationCtx, uploadId: Id<"uploads">): Promise<number> {
  const items = await ctx.db
    .query("items")
    .withIndex("by_upload", (q) => q.eq("uploadId", uploadId))
    .collect();
  return items.filter((item) => item.status === "needsCredits").length;
}
