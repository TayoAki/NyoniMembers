import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the queue: the filter strip, then table rows of the same height. */
export function QueueSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the queue">
      <div className="flex gap-6 border-b border-foreground/15">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="mb-3 h-5 w-20" />
        ))}
      </div>
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1fr_1.4fr_1fr] gap-4 py-3 sm:grid-cols-[1fr_1.2fr_1.6fr_1fr_1fr_1fr_1.2fr]"
          >
            {Array.from({ length: 7 }, (_, cell) => (
              <Skeleton key={cell} className={cell > 3 ? "hidden h-4 sm:block" : "h-4"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
