"use client";

import { ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { OCCASIONS, OCCASION_BLURBS, OCCASION_LABELS, type Occasion } from "@convex/shared/atelier/enums";

type OccasionChooserProps = {
  onChoose: (occasion: Occasion) => void;
  pendingOccasion: Occasion | null;
  disabled: boolean;
};

/**
 * S02 on the entry page: the five occasions in the house's own words. Choosing one starts a design
 * with that occasion and opens the occasion step, where the recommendations for it are explained.
 */
export function OccasionChooser({ onChoose, pendingOccasion, disabled }: OccasionChooserProps) {
  return (
    <section
      id="occasions"
      aria-labelledby="occasions-title"
      className="scroll-mt-24 border-t border-foreground/15 pt-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="occasions-title" className="text-xl font-medium tracking-tight sm:text-2xl">
          Or begin with the occasion
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          The occasion shapes the recommendations, and you can change it at any point without losing a choice.
        </p>
      </div>
      <ul className="mt-6 divide-y divide-foreground/10 border-y border-foreground/15">
        {OCCASIONS.map((occasion) => {
          const starting = pendingOccasion === occasion;
          return (
            <li key={occasion}>
              <button
                type="button"
                onClick={() => onChoose(occasion)}
                disabled={disabled || (pendingOccasion !== null && !starting)}
                aria-busy={starting}
                className={cn(
                  "group flex w-full items-center gap-4 py-4 text-left transition-colors outline-none",
                  "hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60",
                  starting && "opacity-100",
                )}
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-base font-medium">{OCCASION_LABELS[occasion]}</span>
                  <span className="block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {OCCASION_BLURBS[occasion]}
                  </span>
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground">
                  {starting ? (
                    <Spinner aria-label={`Starting a ${OCCASION_LABELS[occasion].toLowerCase()} design`} />
                  ) : (
                    <ArrowRight aria-hidden className="size-4" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
