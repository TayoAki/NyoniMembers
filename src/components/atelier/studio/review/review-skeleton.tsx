import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The order book's shape while its lines load: ruled rows, nothing invented. */
export function ReviewSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn("divide-y divide-foreground/10 border-y border-foreground/15", className)}
      aria-busy="true"
      aria-label="Loading the review"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto]">
          <Skeleton className="h-3.5 w-24 rounded-sm" />
          <Skeleton className={cn("h-3.5 rounded-sm", index % 3 === 0 ? "w-40" : index % 3 === 1 ? "w-56" : "w-32")} />
          <Skeleton className="hidden h-3.5 w-14 rounded-sm sm:block" />
        </div>
      ))}
    </div>
  );
}

/** A small block (membership, the export record) while its read is in flight. */
export function ReviewBlockSkeleton({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-3.5 rounded-sm", index === 0 ? "w-48" : "w-72 max-w-full")} />
      ))}
    </div>
  );
}
