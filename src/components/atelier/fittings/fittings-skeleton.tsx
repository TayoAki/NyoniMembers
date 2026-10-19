import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the fittings page: header with its action, then ruled rows of service, status and windows. */
export function FittingsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your fittings">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-40 sm:h-11" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40 rounded-none" />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-24" />
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
              <div className="space-y-2.5">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-3 w-48 max-w-full" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <Skeleton className="h-11 w-24 rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
