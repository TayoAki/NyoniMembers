import { Skeleton } from "@/components/ui/skeleton";

/** The cloth step while the catalogue loads: the same rhythm as the panel, so nothing jumps when it fills. */
export function ClothSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the cloth book">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24 rounded-sm" />
        <Skeleton className="h-4 w-full max-w-md rounded-sm" />
      </div>
      <div className="space-y-3 border-y border-foreground/15 py-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-sm" />
          <Skeleton className="h-7 w-20 rounded-sm" />
        </div>
        <Skeleton className="h-3 w-56 max-w-full rounded-sm" />
      </div>
      <Skeleton className="h-11 w-full rounded-sm" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
            <Skeleton className="h-3 w-24 rounded-sm" />
            <Skeleton className="h-4 w-3/4 rounded-sm" />
            <Skeleton className="h-3 w-1/2 rounded-sm" />
            <Skeleton className="h-3 w-2/3 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
