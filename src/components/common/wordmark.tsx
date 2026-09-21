import { cn } from "@/lib/utils";

/** The house wordmark: "NYONI" in the display serif with a tracked "Members" caption beneath the baseline. */
export function Wordmark({ className, caption = true }: { className?: string; caption?: boolean }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-display text-[22px] leading-none font-medium tracking-[0.14em] sm:text-[26px]">NYONI</span>
      {caption ? (
        <span className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">Members</span>
      ) : null}
    </span>
  );
}
