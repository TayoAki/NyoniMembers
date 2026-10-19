import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the group review desk: a line of guidance, then one group block. */
export function GroupsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading group commissions">
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-sm" />
      </div>
    </div>
  );
}
