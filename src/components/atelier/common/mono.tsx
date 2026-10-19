import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Production codes, references, measurements and dates in tables: IBM Plex Mono, tracked, quiet. */
export function Mono({
  children,
  className,
  upper = true,
}: {
  children: ReactNode;
  className?: string;
  upper?: boolean;
}) {
  return (
    <span
      className={cn("font-mono text-[10px] tracking-[0.16em] text-muted-foreground", upper && "uppercase", className)}
    >
      {children}
    </span>
  );
}
