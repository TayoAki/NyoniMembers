"use client";

import { AlertCircle, Check, Circle, MinusCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { JobView } from "@/hooks/use-active-jobs";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stepIndex } from "@convex/shared/jobs";

type JobStepperProps = {
  job: Pick<JobView, "steps" | "status" | "progress" | "error">;
  /** Collapse dynamic steps (`extract:0..n`) into one row with a k/n counter. */
  compact?: boolean;
  className?: string;
};

type Row = {
  key: string;
  label: string;
  status: JobView["steps"][number]["status"];
  error?: string;
  detail?: string;
  elapsedMs?: number;
};

function summariseDynamic(steps: JobView["steps"]): Row[] {
  const rows: Row[] = [];
  const groups = new Map<string, JobView["steps"]>();
  for (const step of steps) {
    if (stepIndex(step.key) === null) {
      rows.push({ key: step.key, label: step.label, status: step.status, error: step.error, elapsedMs: elapsed(step) });
      continue;
    }
    const prefix = step.key.split(":")[0];
    groups.set(prefix, [...(groups.get(prefix) ?? []), step]);
    if (!rows.some((row) => row.key === prefix)) rows.push({ key: prefix, label: "", status: "pending" });
  }
  for (const row of rows) {
    const group = groups.get(row.key);
    if (!group) continue;
    const done = group.filter((s) => s.status === "done").length;
    const failed = group.filter((s) => s.status === "failed").length;
    const running = group.some((s) => s.status === "running");
    const finished = group.every((s) => s.status === "done" || s.status === "failed" || s.status === "skipped");
    row.label = row.key === "extract" ? "Extracting items" : row.key === "render" ? "Rendering images" : row.key;
    row.detail = `${done}/${group.length}${failed ? ` · ${failed} failed` : ""}`;
    row.status = finished ? (failed === group.length ? "failed" : "done") : running || done > 0 ? "running" : "pending";
  }
  return rows;
}

function elapsed(step: JobView["steps"][number]): number | undefined {
  if (!step.startedAt) return undefined;
  return (step.finishedAt ?? Date.now()) - step.startedAt;
}

export function JobStepper({ job, compact = true, className }: JobStepperProps) {
  const reduceMotion = useReducedMotion();
  const rows: Row[] = compact
    ? summariseDynamic(job.steps)
    : job.steps.map((step) => ({
        key: step.key,
        label: step.label,
        status: step.status,
        error: step.error,
        elapsedMs: elapsed(step),
      }));

  return (
    <div className={cn("space-y-3", className)} aria-live="polite">
      <Progress value={Math.round(job.progress * 100)} aria-label="Job progress" />
      <ol className="space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row.key}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 text-sm"
            >
              <StepIcon status={row.status} />
              <span className={cn("flex-1", row.status === "pending" && "text-muted-foreground")}>
                {row.label}
                {row.detail ? <span className="text-muted-foreground ml-1 tabular-nums">{row.detail}</span> : null}
                {row.error ? <span className="text-destructive block text-xs">{row.error}</span> : null}
              </span>
              {row.elapsedMs !== undefined && row.status !== "pending" ? (
                <span className="text-muted-foreground text-xs tabular-nums">{formatDuration(row.elapsedMs)}</span>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {job.status === "failed" && job.error ? <p className="text-destructive text-xs">{job.error}</p> : null}
    </div>
  );
}

function StepIcon({ status }: { status: Row["status"] }) {
  const base = "mt-0.5 size-4 shrink-0";
  switch (status) {
    case "done":
      return <Check className={cn(base, "text-success")} aria-label="Done" />;
    case "running":
      return <Spinner className={base} aria-label="In progress" />;
    case "failed":
      return <AlertCircle className={cn(base, "text-destructive")} aria-label="Failed" />;
    case "skipped":
      return <MinusCircle className={cn(base, "text-muted-foreground")} aria-label="Skipped" />;
    default:
      return <Circle className={cn(base, "text-muted-foreground/50")} aria-label="Pending" />;
  }
}
