import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { ESTIMATE_WORD } from "@/components/atelier/orders/order-words";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MilestoneView } from "@convex/atelier/orders";

/**
 * S29 (C22): every milestone the house recorded, dated and sourced. An estimated entry is drawn
 * hollow and carries the word "Estimate"; it never moves the status and never reads as a fact.
 */
export function MilestoneTimeline({ milestones }: { milestones: readonly MilestoneView[] }) {
  const ordered = [...milestones].sort((a, b) => a.at - b.at);
  return (
    <AtelierSection
      id="production"
      title="Production"
      description="Each stage as the house, the maker or the carrier recorded it, with who recorded it. Estimated dates say so and move nothing."
    >
      {ordered.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">No stage has been recorded yet.</p>
      ) : (
        <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Production milestones">
          {ordered.map((milestone) => (
            <li
              key={milestone.milestoneId}
              className="grid [grid-template-columns:auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 sm:[grid-template-columns:auto_11rem_minmax(0,1fr)] sm:gap-x-6"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  milestone.estimated ? "border border-foreground/50 bg-transparent" : "bg-foreground/70",
                )}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Mono upper={false} className="text-foreground/70">
                  {formatDate(milestone.at)}
                </Mono>
                {milestone.estimated ? <Mono className="text-warning">{ESTIMATE_WORD}</Mono> : null}
              </div>
              <div className="col-start-2 min-w-0 space-y-0.5 sm:col-start-3">
                <p className={cn("text-sm", milestone.estimated && "text-muted-foreground")}>
                  {milestone.label}
                  <span className="text-muted-foreground"> · {milestone.sourceLabel}</span>
                </p>
                {milestone.note ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">{milestone.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </AtelierSection>
  );
}
