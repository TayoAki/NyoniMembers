"use client";

import { Button } from "@/components/ui/button";
import { UNIT_LABELS } from "@/hooks/atelier/use-measurement-form";
import { cn } from "@/lib/utils";
import { UNITS, type Unit } from "@convex/shared/atelier/measurements";

/** cm / in. Switching converts what is shown; stored values stay in centimetres (acceptance scenario 6). */
export function UnitToggle({
  unit,
  onChange,
  disabled = false,
  label = "Units",
}: {
  unit: Unit;
  onChange: (unit: Unit) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex border border-foreground/20">
      {UNITS.map((option) => {
        const selected = option === unit;
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "h-11 min-w-14 rounded-none px-4 text-sm",
              selected
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="sr-only">{UNIT_LABELS[option]}</span>
            <span aria-hidden>{option}</span>
          </Button>
        );
      })}
    </div>
  );
}
