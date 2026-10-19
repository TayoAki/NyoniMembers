import { Mono } from "@/components/atelier/common/mono";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MilestoneView } from "@convex/atelier/orders";
import { MILESTONE_SOURCE_STAFF_WORDS } from "./production-words";

/** The order's milestones as the client's vertical line, with the source named and estimates called estimates. */
export function MilestoneTimeline({ milestones }: { milestones: MilestoneView[] }) {
  if (milestones.length === 0) return <p className="text-sm text-muted-foreground">No milestones recorded yet.</p>;
  return (
    <ol className="space-y-0 border-l border-foreground/15">
      {milestones.map((milestone) => (
        <li key={milestone.milestoneId} className="relative pb-4 pl-5 last:pb-0">
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-[4.5px] size-2 rounded-full",
              milestone.estimated ? "border border-foreground/40 bg-background" : "bg-foreground",
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <Mono upper={false} className="text-[11px] text-foreground/80">
              {formatDateTime(milestone.at)}
            </Mono>
            {milestone.estimated ? <span className="text-xs font-medium text-warning">Estimate</span> : null}
            <Mono>{milestone.kind}</Mono>
          </div>
          <p className="text-sm">{milestone.label}</p>
          <p className="text-xs text-muted-foreground">
            {MILESTONE_SOURCE_STAFF_WORDS[milestone.source]}
            {milestone.note ? ` · ${milestone.note}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
