import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "../lib/errors";
import { LIMITS } from "../shared/credits";
import { isTerminalJobStatus, stepLabel, type JobStatus, type JobType, type StepStatus } from "../shared/jobs";

type Ctx = QueryCtx | MutationCtx;
export type StepInput = { key: string; label?: string; meta?: Record<string, unknown> };
export type StepPatch = { status: StepStatus; error?: string; meta?: Record<string, unknown>; label?: string };

const ACTIVE_STATUSES: readonly JobStatus[] = ["queued", "running"];

export async function countRunning(ctx: Ctx, userId: Id<"users">): Promise<number> {
  const lists = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      ctx.db
        .query("jobs")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
        .collect(),
    ),
  );
  return lists.reduce((sum, list) => sum + list.length, 0);
}

export async function listActive(ctx: Ctx, userId: Id<"users">): Promise<Doc<"jobs">[]> {
  const lists = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      ctx.db
        .query("jobs")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", status))
        .order("desc")
        .collect(),
    ),
  );
  return lists.flat().sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Create a queued job with its initial (static) steps. Enforces the per-user running-job cap unless
 * `bypassLimit` is set (a photo batch checks the cap once, then creates one job per photo).
 */
export async function createJob(
  ctx: MutationCtx,
  user: Doc<"users">,
  input: { type: JobType; steps: StepInput[]; uploadId?: Id<"uploads">; outfitIds?: Id<"outfits">[] },
  options: { bypassLimit?: boolean } = {},
): Promise<Id<"jobs">> {
  if (!options.bypassLimit) await assertBelowJobLimit(ctx, user._id);
  const now = Date.now();
  return ctx.db.insert("jobs", {
    userId: user._id,
    type: input.type,
    status: "queued",
    steps: input.steps.map((step) => ({
      key: step.key,
      label: step.label ?? stepLabel(step.key, step.meta),
      status: "pending" as const,
      meta: step.meta,
    })),
    progress: 0,
    reservation: { plan: 0, pack: 0 },
    refunds: { plan: 0, pack: 0 },
    uploadId: input.uploadId,
    outfitIds: input.outfitIds,
    resultIds: [],
    createdAt: now,
    updatedAt: now,
  });
}

export async function assertBelowJobLimit(ctx: Ctx, userId: Id<"users">): Promise<void> {
  const running = await countRunning(ctx, userId);
  if (running >= LIMITS.maxRunningJobsPerUser) {
    throw appError("TOO_MANY_JOBS", `You already have ${running} jobs running. Wait for one to finish.`);
  }
}

export async function getJob(ctx: Ctx, jobId: Id<"jobs">): Promise<Doc<"jobs">> {
  const job = await ctx.db.get(jobId);
  if (!job) throw appError("NOT_FOUND", "Job not found.");
  return job;
}

export async function setWorkflowId(ctx: MutationCtx, jobId: Id<"jobs">, workflowId: string): Promise<void> {
  await ctx.db.patch(jobId, { workflowId, status: "running", updatedAt: Date.now() });
}

/** Add dynamic steps (e.g. one `extract:<n>` per detected item) after the count is known. */
export async function addSteps(ctx: MutationCtx, jobId: Id<"jobs">, steps: StepInput[]): Promise<void> {
  const job = await getJob(ctx, jobId);
  const existing = new Set(job.steps.map((step) => step.key));
  const additions = steps
    .filter((step) => !existing.has(step.key))
    .map((step) => ({
      key: step.key,
      label: step.label ?? stepLabel(step.key, step.meta),
      status: "pending" as const,
      meta: step.meta,
    }));
  const merged = [...job.steps, ...additions];
  await ctx.db.patch(jobId, { steps: merged, progress: computeProgress(merged), updatedAt: Date.now() });
}

/** Update one step (creating it if a dynamic step reports before being declared) and recompute progress. */
export async function setStep(ctx: MutationCtx, jobId: Id<"jobs">, key: string, patch: StepPatch): Promise<void> {
  const job = await getJob(ctx, jobId);
  const now = Date.now();
  let found = false;
  const steps = job.steps.map((step) => {
    if (step.key !== key) return step;
    found = true;
    const meta = patch.meta ? { ...(step.meta ?? {}), ...patch.meta } : step.meta;
    return {
      ...step,
      status: patch.status,
      label: patch.label ?? stepLabel(key, meta) ?? step.label,
      error: patch.error,
      meta,
      startedAt: step.startedAt ?? (patch.status === "running" ? now : undefined),
      finishedAt:
        patch.status === "done" || patch.status === "failed" || patch.status === "skipped" ? now : step.finishedAt,
    };
  });
  if (!found) {
    steps.push({
      key,
      label: patch.label ?? stepLabel(key, patch.meta),
      status: patch.status,
      error: patch.error,
      meta: patch.meta,
      startedAt: now,
      finishedAt: patch.status === "pending" || patch.status === "running" ? undefined : now,
    });
  }
  const status: JobStatus = isTerminalJobStatus(job.status) ? job.status : "running";
  await ctx.db.patch(jobId, { steps, progress: computeProgress(steps), status, updatedAt: now });
}

export async function appendResult(ctx: MutationCtx, jobId: Id<"jobs">, resultId: string): Promise<void> {
  const job = await getJob(ctx, jobId);
  if (job.resultIds.includes(resultId)) return;
  await ctx.db.patch(jobId, { resultIds: [...job.resultIds, resultId], updatedAt: Date.now() });
}

export async function completeJob(
  ctx: MutationCtx,
  jobId: Id<"jobs">,
  outcome: { status: Extract<JobStatus, "done" | "partial" | "failed" | "cancelled">; error?: string },
): Promise<Doc<"jobs">> {
  const job = await getJob(ctx, jobId);
  const now = Date.now();
  const steps = job.steps.map((step) =>
    step.status === "pending" || step.status === "running"
      ? { ...step, status: outcome.status === "failed" ? ("failed" as const) : ("skipped" as const), finishedAt: now }
      : step,
  );
  await ctx.db.patch(jobId, {
    status: outcome.status,
    error: outcome.error,
    steps,
    progress: outcome.status === "done" ? 1 : computeProgress(steps),
    updatedAt: now,
    completedAt: now,
  });
  return getJob(ctx, jobId);
}

export function computeProgress(steps: Doc<"jobs">["steps"]): number {
  if (steps.length === 0) return 0;
  const finished = steps.filter(
    (step) => step.status === "done" || step.status === "skipped" || step.status === "failed",
  ).length;
  const running = steps.filter((step) => step.status === "running").length * 0.5;
  return Math.min(1, (finished + running) / steps.length);
}
