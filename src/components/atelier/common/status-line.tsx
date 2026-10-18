import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "gold" | "success" | "warning" | "destructive";

const DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  gold: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

/**
 * One truthful status, as words with a small mark before them. Colour never carries the meaning on
 * its own; the words do (S&S contract: accurate state language).
 */
export function StatusLine({
  tone = "neutral",
  children,
  className,
  live = false,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  /** Announce changes to assistive technology (save status, job progress). */
  live?: boolean;
}) {
  return (
    <p
      className={cn("inline-flex items-center gap-2 text-xs font-medium", className)}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      <span>{children}</span>
    </p>
  );
}
