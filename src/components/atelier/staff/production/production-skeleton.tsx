import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the production board: the filter strip, then rows. */
export function ProductionSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading production">
      <div className="flex gap-6 overflow-hidden border-b border-foreground/15">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="mb-3 h-5 w-20 shrink-0" />
        ))}
      </div>
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1.4fr_1.4fr] gap-4 py-3 sm:grid-cols-[1fr_1.4fr_1.6fr_1.4fr_1fr_1fr_1fr_1fr]"
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

/** Mirrors the order desk: the commission book, the release panel, the specification. */
export function OrderDeskSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading the commission">
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-24 w-full rounded-sm" />
      </div>
      <div className="space-y-3 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-48" />
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
