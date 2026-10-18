"use client";

import { ShadeChip } from "@/components/atelier/entry/shade-chip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { clothSeedByCode } from "@convex/shared/atelier/cloths";
import { OCCASION_LABELS } from "@convex/shared/atelier/enums";
import { LOOKS } from "@convex/shared/atelier/looks";

type LookListProps = {
  onStart: (lookKey: string) => void;
  pendingKey: string | null;
  disabled: boolean;
};

/**
 * "Start from a look": the recommended looks as a ruled editorial list. Each row says what the look
 * is, why the house suggests it and which cloth it is cut in; nothing is hidden behind the choice.
 */
export function LookList({ onStart, pendingKey, disabled }: LookListProps) {
  return (
    <section id="looks" aria-labelledby="looks-title" className="scroll-mt-24 border-t border-foreground/15 pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="looks-title" className="text-xl font-medium tracking-tight sm:text-2xl">
          Start from a look
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Seven complete designs in real cloths from the house&rsquo;s books. Begin from one and change anything.
        </p>
      </div>
      <ol className="mt-6 divide-y divide-foreground/10 border-y border-foreground/15">
        {LOOKS.map((look) => {
          const cloth = look.spec.clothCode ? clothSeedByCode(look.spec.clothCode) : undefined;
          const starting = pendingKey === look.key;
          return (
            <li key={look.key} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-base font-medium">{look.name}</h3>
                  <span className="font-display text-lg leading-none italic">{look.properName}</span>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{look.why}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {cloth ? (
                    <span className="inline-flex items-center gap-2">
                      <ShadeChip hex={cloth.hex} size="sm" />
                      <span>
                        <span className="font-display text-sm text-foreground not-italic">{cloth.name}</span> ·{" "}
                        {cloth.mill}
                      </span>
                    </span>
                  ) : (
                    <span>Cloth chosen in the studio</span>
                  )}
                  <span aria-hidden>·</span>
                  <span>{look.occasions.map((occasion) => OCCASION_LABELS[occasion]).join(", ")}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="h-11 w-full rounded-none px-5 sm:w-auto"
                onClick={() => onStart(look.key)}
                disabled={disabled || (pendingKey !== null && !starting)}
                aria-busy={starting}
              >
                {starting ? <Spinner data-icon="inline-start" aria-label="Starting from this look" /> : null}
                {starting ? "Starting…" : "Start from this look"}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
