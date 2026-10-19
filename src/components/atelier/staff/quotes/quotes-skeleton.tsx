import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the quotes desk: two sections of rows. */
export function QuotesSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading quotes">
      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="divide-y divide-foreground/10 border-y border-foreground/15">
            {Array.from({ length: rows }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1.4fr] gap-4 py-3 sm:grid-cols-[1fr_0.6fr_1.6fr_0.8fr_1.4fr_1fr]"
              >
                {Array.from({ length: 6 }, (_, cell) => (
                  <Skeleton key={cell} className={cell > 2 ? "hidden h-4 sm:block" : "h-4"} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
