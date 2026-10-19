"use client";

import type { PreviewJobView } from "@convex/atelier/previews";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PREVIEW_CAPTION } from "./result-controls";

type CompareLooksProps = {
  jobs: PreviewJobView[];
  currentJobId: string | null;
  /** Restores a previous design from its preview; null while the studio has no way to read that revision's spec. */
  onUseDesign: ((job: PreviewJobView) => void) | null;
  usingJobId: string | null;
};

/**
 * S14 (C10): this draft's finished previews side by side, each labelled with the exact design it was
 * made from. Deleting an image never deletes a specification, so previews without an image are still
 * listed by their design and status.
 */
export function CompareLooks({ jobs, currentJobId, onUseDesign, usingJobId }: CompareLooksProps) {
  const withImage = jobs.filter((job) => job.status === "done" && job.resultUrl !== null);
  const withoutImage = jobs.filter(
    (job) => !(job.status === "done" && job.resultUrl !== null) && job.jobId !== currentJobId,
  );
  if (withImage.length === 0 && withoutImage.length === 0) return null;

  return (
    <section aria-labelledby="compare-looks-title" className="border-t border-foreground/15 pt-6">
      <h2 id="compare-looks-title" className="text-xl font-medium tracking-tight sm:text-2xl">
        Compare looks
      </h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
        {withImage.length >= 2
          ? "Each preview shows the design it was made from, named beside it. Choosing one makes that design current again; the images stay."
          : withImage.length === 1
            ? "Change the design and ask for another preview to compare two looks side by side."
            : "Earlier previews of this design, by the design each one was made from."}
      </p>

      {withImage.length > 0 ? (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2">
          {withImage.map((job) => {
            const current = job.isCurrent;
            return (
              <li key={job.jobId} className={cn("flex flex-col gap-3", current && "sm:order-first")}>
                <ItemImage
                  src={job.resultUrl}
                  alt={`Illustrative preview of ${job.specLabel}`}
                  variant="render"
                  aspect="aspect-[3/4]"
                  className={cn("rounded-none bg-muted/40", current && "ring-1 ring-primary")}
                />
                <div className="space-y-1.5">
                  <StatusLine tone={current ? "gold" : "neutral"}>
                    {current ? "Current design" : "Previous design"}
                  </StatusLine>
                  <p className="text-sm leading-snug">{job.specLabel}</p>
                  <p className="flex flex-wrap gap-x-3">
                    {job.revision !== null ? <Mono>Revision {job.revision}</Mono> : null}
                    <Mono>{formatDate(job.createdAt)}</Mono>
                  </p>
                  <p className="text-xs text-muted-foreground">{PREVIEW_CAPTION}</p>
                </div>
                {current ? (
                  <p className="text-xs text-muted-foreground">This is the design as it stands now.</p>
                ) : onUseDesign ? (
                  <Button
                    variant="outline"
                    className="min-h-11 w-fit rounded-sm"
                    onClick={() => onUseDesign(job)}
                    disabled={usingJobId !== null}
                  >
                    {usingJobId === job.jobId ? "Restoring…" : "Use this design"}
                  </Button>
                ) : (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Returning to this design from here is not available yet. Its specification is kept with the preview;
                    ask your concierge and they can restore it.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {withoutImage.length > 0 ? (
        <dl className="mt-5 divide-y divide-foreground/10 border-y border-foreground/15">
          {withoutImage.map((job) => (
            <div key={job.jobId} className="grid gap-x-6 gap-y-1 py-3 text-sm sm:grid-cols-[minmax(7rem,11rem)_1fr]">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground">{job.statusLabel}</dt>
              <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span>{job.specLabel}</span>
                {job.revision !== null ? <Mono>Revision {job.revision}</Mono> : null}
                <Mono>{formatDate(job.createdAt)}</Mono>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
