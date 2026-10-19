"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/**
 * A ruled list of choices: one radio per row, the whole row is the target (at least 44px), the label
 * with a line of description, and an optional detail column (an address, a note). Used for fit routes,
 * comfort, posture, appointment services and showrooms so every choice on these screens reads the same.
 */
export function ChoiceList({
  value,
  onValueChange,
  disabled = false,
  className,
  children,
  ...labelling
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      disabled={disabled}
      className={cn("gap-0 divide-y divide-foreground/10 border-y border-foreground/15", className)}
      {...labelling}
    >
      {children}
    </RadioGroup>
  );
}

export function ChoiceRow({
  id,
  value,
  title,
  description,
  detail,
  disabled = false,
  reason,
}: {
  id: string;
  value: string;
  title: ReactNode;
  description?: ReactNode;
  /** A secondary column at the right on wide screens: an address, a phone number, a time. */
  detail?: ReactNode;
  disabled?: boolean;
  /** Why this choice is not available right now; shown in the warning colour under the title. */
  reason?: string | null;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex min-h-11 w-full items-start gap-3 py-3 text-left leading-snug font-normal",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", disabled && "text-muted-foreground")}>{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-pretty text-muted-foreground">
              {description}
            </span>
          ) : null}
          {reason ? <span className="mt-0.5 block text-xs leading-relaxed text-warning">{reason}</span> : null}
        </span>
        {detail ? (
          <span className="shrink-0 text-xs leading-relaxed text-muted-foreground sm:text-right">{detail}</span>
        ) : null}
      </span>
    </Label>
  );
}
