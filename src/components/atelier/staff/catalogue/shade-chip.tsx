import { cn } from "@/lib/utils";

/**
 * The representative shade as a square chip with the honest word beside it: "Confirmed shade" once a
 * fitter has held the cloth against it, "Representative shade" until then (contract §0).
 */
export function ShadeChip({
  hex,
  confirmed,
  words = true,
  className,
}: {
  hex: string;
  confirmed: boolean;
  words?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="size-5 shrink-0 rounded-sm border border-foreground/20"
        style={{ backgroundColor: hex }}
      />
      {words ? (
        <span className="flex flex-col leading-tight">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{hex}</span>
          <span className={cn("text-xs", confirmed ? "text-foreground" : "text-muted-foreground")}>
            {confirmed ? "Confirmed shade" : "Representative shade"}
          </span>
        </span>
      ) : (
        <span className="sr-only">{confirmed ? "Confirmed shade" : "Representative shade"}</span>
      )}
    </span>
  );
}
