"use client";

import { Camera, Wand2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { JobStepper } from "@/components/common/job-stepper";
import { RenderGrid } from "@/components/renders/render-grid";
import { RenderSheet } from "@/components/renders/render-sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useJob } from "@/hooks/use-active-jobs";
import type { Outfit } from "@/hooks/use-outfits";
import { useRendersForOutfit } from "@/hooks/use-renders";
import { pluralize } from "@/lib/format";
import type { Id } from "@convex/_generated/dataModel";
import { isTerminalJobStatus } from "@convex/shared/jobs";

/** "Render on me" plus everything that came back for this outfit. */
export function RenderPanel({ outfit }: { outfit: Outfit }) {
  const renders = useRendersForOutfit(outfit._id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [startedJobId, setStartedJobId] = useState<Id<"jobs"> | null>(null);

  const pendingJobId = renders?.find((render) => render.status === "pending")?.jobId ?? null;
  const job = useJob(startedJobId ?? pendingJobId);
  const jobRunning = Boolean(job && !isTerminalJobStatus(job.status));

  const hasItems = hasAnyItem(outfit);
  const doneCount = renders?.filter((render) => render.status === "done").length ?? 0;

  const renderButton = (
    <Button
      onClick={() => setSheetOpen(true)}
      disabled={!hasItems}
      aria-disabled={!hasItems || undefined}
      aria-label="Render this outfit on me"
    >
      <Wand2 data-icon="inline-start" />
      Render on me
    </Button>
  );

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Camera className="text-muted-foreground size-4" aria-hidden />
          Renders
          {renders ? (
            <span className="text-muted-foreground text-xs font-normal tabular-nums">
              {pluralize(doneCount, "image")}
            </span>
          ) : null}
        </h2>
        {hasItems ? (
          renderButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{renderButton}</TooltipTrigger>
            <TooltipContent>Add at least one piece first</TooltipContent>
          </Tooltip>
        )}
      </div>

      {job && jobRunning ? (
        <div className="bg-card rounded-xl border p-4">
          <JobStepper job={job} />
        </div>
      ) : null}

      <RenderGrid
        renders={renders}
        skeletonCount={4}
        empty={
          <EmptyState
            icon={Camera}
            className="min-h-[220px]"
            title="See it on you"
            description="Fitcheck dresses your photo in these exact pieces. About 40 seconds an image."
            action={hasItems ? renderButton : undefined}
          />
        }
      />

      <RenderSheet
        outfitId={outfit._id}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStarted={(jobId) => setStartedJobId(jobId)}
      />
    </section>
  );
}

function hasAnyItem(outfit: Outfit): boolean {
  const { outerwear, top, bottom, dress, shoes, accessories } = outfit.slots;
  return Boolean(outerwear || top || bottom || dress || shoes || accessories.length > 0);
}
