"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { STEP_LABELS, STUDIO_STEPS } from "@convex/shared/atelier/enums";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useStudio } from "./panel-contract";

/**
 * The seven steps with real completion from `draft.completedSteps`: done, current, not started. A
 * horizontal strip that scrolls on phones; every step is reachable in any order.
 */
export function StepRail({ className }: { className?: string }) {
  const { draft, draftId, step } = useStudio();
  return (
    <nav
      aria-label="Design steps"
      className={cn(
        "-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ol className="flex min-w-max items-stretch border-b border-foreground/15">
        {STUDIO_STEPS.map((candidate, index) => {
          const done = draft.completedSteps.includes(candidate);
          const current = candidate === step;
          return (
            <li key={candidate} className="flex first:[&>a]:pl-0 last:[&>a]:pr-0">
              <Link
                href={routes.atelier.step(draftId, candidate)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] lg:px-1.5 xl:px-2 xl:text-[13px]",
                  current
                    ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-primary"
                    : done
                      ? "text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] leading-none",
                    done
                      ? "border-foreground bg-foreground text-background"
                      : current
                        ? "border-primary text-primary"
                        : "border-foreground/30 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-2.5" strokeWidth={3} /> : index + 1}
                </span>
                <span>{STEP_LABELS[candidate]}</span>
                <span className="sr-only">{done ? ", completed" : current ? ", current step" : ", not started"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
