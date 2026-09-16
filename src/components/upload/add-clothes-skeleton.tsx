import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors /add: header, hero drop zone and the recent-uploads list. */
export function AddClothesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8" aria-busy="true" aria-label="Loading add clothes">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="divide-y rounded-xl border">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 p-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
