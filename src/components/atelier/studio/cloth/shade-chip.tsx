import { cn } from "@/lib/utils";

/**
 * The cloth's representative shade as a small square, with the honest words beside it: the hex drives
 * the studio figure and is "representative" until a fitter confirms it against the real cloth (O02).
 */
export function ShadeChip({
  hex,
  confirmed,
  words = true,
  size = "sm",
  className,
}: {
  hex: string;
  confirmed: boolean;
  words?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "size-12" : size === "md" ? "size-6" : "size-3.5";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(box, "shrink-0 rounded-[2px] border border-foreground/20")}
        style={{ backgroundColor: hex }}
      />
      {words ? (
        <span className="text-[11px] leading-none text-muted-foreground">
          {confirmed ? "confirmed shade" : "representative shade"}
        </span>
      ) : null}
    </span>
  );
}
