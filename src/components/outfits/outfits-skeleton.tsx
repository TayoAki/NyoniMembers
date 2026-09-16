import { LoadingGrid } from "@/components/common/loading-grid";
import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withActions ? <Skeleton className="h-8 w-32" /> : null}
    </div>
  );
}

/** Matches /outfits: header, filter chips, tile grid. */
export function OutfitsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading outfits">
      <HeaderSkeleton />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
        <LoadingGrid count={10} />
      </div>
    </div>
  );
}

/** Matches the builder board: five slot cards, an accessories strip and the two fields. */
export function OutfitBuilderSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading outfit">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-7 w-44 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4] rounded-xl" />
        ))}
        <Skeleton className="col-span-full h-28 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  );
}

export function OutfitBuilderPageSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <OutfitBuilderSkeleton />
    </div>
  );
}
