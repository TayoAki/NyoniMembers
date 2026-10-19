"use client";

import type { ReactNode } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/**
 * A ruled list of choices for the studio panels: one radio per row, the label and a line of description,
 * the production code or supplier reference in mono, and the committed value marked "Current". Rows are
 * at least 44px tall and the whole row is the target.
 */
export function OptionList({
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

export function OptionRow({
  id,
  value,
  title,
  description,
  code,
  swatch,
  current = false,
  disabled = false,
  reason,
}: {
  id: string;
  value: string;
  title: ReactNode;
  description?: ReactNode;
  /** Production id or supplier reference. */
  code?: string | null;
  /** A material's representative shade, drawn as a small square chip. */
  swatch?: string;
  /** Marks the value the design holds now, so a reopened sheet shows what is committed. */
  current?: boolean;
  disabled?: boolean;
  /** Why this option cannot be chosen right now. */
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
      {swatch !== undefined ? (
        <span
          aria-hidden
          className="mt-px size-5 shrink-0 rounded-sm border border-foreground/20"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>{title}</span>
          {code ? <Mono>{code}</Mono> : null}
          {current ? <Mono className="text-primary">Current</Mono> : null}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-pretty text-muted-foreground">{description}</span>
        ) : null}
        {reason ? <span className="mt-0.5 block text-xs leading-relaxed text-warning">{reason}</span> : null}
      </span>
    </Label>
  );
}
