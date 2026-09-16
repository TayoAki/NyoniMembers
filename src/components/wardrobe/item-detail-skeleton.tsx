import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors /wardrobe/[itemId]: back link, header, cutout column and the attribute form. */
export function ItemDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading item">
      <Skeleton className="h-7 w-28 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <Skeleton className="aspect-[4/5] w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-28 rounded-lg" />
            ))}
          </div>
          <div className="space-y-5">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
