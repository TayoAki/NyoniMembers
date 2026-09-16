"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { JobStepper } from "@/components/common/job-stepper";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useActiveJobs, useJobCompletionToasts } from "@/hooks/use-active-jobs";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Running jobs at a glance from anywhere in the app; also owns the completion toasts. */
export function ActivityPopover({ className }: { className?: string }) {
  const { jobs, count } = useActiveJobs();
  useJobCompletionToasts();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
            aria-label={count ? `${count} jobs running` : "Activity"}
          />
        }
      >
        {count ? <Spinner className="size-4" /> : <Activity className="size-4" />}
        {count ? (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
            {count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="text-sm font-medium">Activity</div>
        {jobs === undefined ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-4" /> Checking…
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing running. Add clothes or render an outfit and progress shows up here.
          </p>
        ) : (
          jobs.map((job) => (
            <div key={job._id} className="space-y-2">
              <Link
                href={
                  job.type === "ingest"
                    ? routes.add
                    : job.outfitIds?.[0]
                      ? routes.outfit(job.outfitIds[0])
                      : routes.lookbook
                }
                className="text-sm font-medium hover:underline"
              >
                {job.type === "ingest" ? "Adding clothes" : "Rendering outfit"}
              </Link>
              <JobStepper job={job} />
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
