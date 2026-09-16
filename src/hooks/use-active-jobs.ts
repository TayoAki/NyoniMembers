"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { isTerminalJobStatus } from "@convex/shared/jobs";

export type JobView = FunctionReturnType<typeof api.jobs.listActive>[number];

export function useActiveJobs(): { jobs: JobView[] | undefined; count: number } {
  const { isAuthenticated } = useConvexAuth();
  const jobs = useQuery(api.jobs.listActive, isAuthenticated ? {} : "skip");
  return { jobs, count: jobs?.length ?? 0 };
}

export function useJob(jobId: JobView["_id"] | null | undefined): JobView | null | undefined {
  return useQuery(api.jobs.get, jobId ? { jobId } : "skip");
}

/**
 * Fires a toast when a job the user is watching finishes.
 * Tracks the set of active job ids and reports transitions out of it.
 */
export function useJobCompletionToasts(): void {
  const { isAuthenticated } = useConvexAuth();
  const recent = useQuery(api.jobs.listRecent, isAuthenticated ? { limit: 10 } : "skip");
  const seen = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!recent) return;
    for (const job of recent) {
      const previous = seen.current.get(job._id);
      seen.current.set(job._id, job.status);
      if (previous === undefined || previous === job.status || !isTerminalJobStatus(job.status)) continue;
      const noun = job.type === "ingest" ? "Wardrobe update" : "Render";
      if (job.status === "done") toast.success(`${noun} finished.`);
      else if (job.status === "partial") toast.warning(`${noun} finished with some items skipped.`);
      else if (job.status === "failed") toast.error(job.error ?? `${noun} failed.`);
    }
  }, [recent]);
}
