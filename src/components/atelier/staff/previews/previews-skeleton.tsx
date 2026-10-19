import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors preview operations: the disclosure book, the filter strip, then rows. */
export function PreviewsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading preview operations">
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        ))}
      </div>
      <div className="flex gap-6 overflow-hidden border-b border-foreground/15">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="mb-3 h-5 w-20 shrink-0" />
        ))}
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-4 py-3 sm:grid-cols-[1fr_1.6fr_1.2fr_0.6fr_1.2fr_1fr_1.2fr_1fr]"
          >
            {Array.from({ length: 8 }, (_, cell) => (
              <Skeleton key={cell} className={cell > 2 ? "hidden h-4 sm:block" : "h-4"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
