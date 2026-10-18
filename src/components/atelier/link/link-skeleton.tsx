import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the link page: header, the explanation, then rows with two actions each. */
export function LinkSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your designs">
      <div className="space-y-3">
        <Skeleton className="h-9 w-80 max-w-full sm:h-11" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-2 border-y border-foreground/15 py-4">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-3/4 max-w-xl" />
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
            <div className="space-y-2.5">
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 w-40 rounded-none" />
              <Skeleton className="h-11 w-28 rounded-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
