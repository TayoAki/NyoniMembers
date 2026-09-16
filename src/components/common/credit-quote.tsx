"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { CreditQuote as Quote } from "@/hooks/use-credits";
import { formatCredits } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type CreditQuoteProps = {
  quote: Quote | undefined;
  /** What the credits buy, e.g. "4 images". */
  label?: string;
  className?: string;
};

/** The number the user sees before anything is charged. Same component in the builder, upload and stylist. */
export function CreditQuote({ quote, label, className }: CreditQuoteProps) {
  if (!quote) return <Skeleton className={cn("h-12 w-full rounded-lg", className)} />;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        quote.canAfford ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/5",
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Coins className={cn("size-4", quote.canAfford ? "text-credit" : "text-destructive")} aria-hidden />
        <span className="font-medium tabular-nums">{formatCredits(quote.credits)}</span>
        {label ? <span className="text-muted-foreground">for {label}</span> : null}
      </div>
      <div className="text-muted-foreground text-right text-xs tabular-nums">
        {quote.canAfford ? (
          <span>{formatCredits(quote.available)} available</span>
        ) : (
          <span className="text-destructive">
            Short by {formatCredits(quote.shortfall)} ·{" "}
            <Link href={routes.billing} className="underline underline-offset-2">
              top up
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}
