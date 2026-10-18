import { cn } from "@/lib/utils";

/**
 * A cloth's representative shade as a small square. It is a hint of the colour, never the cloth:
 * callers pair it with the words "representative shade" wherever the shade is unconfirmed.
 */
export function ShadeChip({
  hex,
  className,
  size = "md",
}: {
  hex: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 border border-foreground/20",
        size === "sm" && "size-3",
        size === "md" && "size-4",
        size === "lg" && "size-6",
        !hex && "border-dashed",
        className,
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}
