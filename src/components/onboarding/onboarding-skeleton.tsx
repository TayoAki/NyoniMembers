import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors step 1: header, progress rail, hero drop zone and the tips column. */
export function OnboardingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8" aria-busy="true" aria-label="Loading setup">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-1 flex-1 rounded-full" />
          <Skeleton className="h-1 flex-1 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
