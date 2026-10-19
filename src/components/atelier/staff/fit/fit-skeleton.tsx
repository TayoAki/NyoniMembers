import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the fit queue table: a line of guidance, then rows of the same height. */
export function FitQueueSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading the fit queue">
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1fr_1.4fr] gap-4 py-3 sm:grid-cols-[1fr_0.6fr_1.6fr_1.2fr_1.6fr_1fr]"
          >
            {Array.from({ length: 6 }, (_, cell) => (
              <Skeleton key={cell} className={cell > 2 ? "hidden h-4 sm:block" : "h-4"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the review page: the status book, the measurement sheet, the decision forms. */
export function FitReviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading the fit profile">
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-48" />
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_10rem]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="hidden h-9 w-full sm:block" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 border-t border-foreground/15 pt-6 sm:grid-cols-2">
        <Skeleton className="h-32 w-full rounded-sm" />
        <Skeleton className="h-32 w-full rounded-sm" />
      </div>
    </div>
  );
}
