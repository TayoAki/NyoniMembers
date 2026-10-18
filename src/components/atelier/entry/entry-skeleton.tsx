import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the entry: the statement column, the figure, then the ruled lists. */
export function EntrySkeleton() {
  return (
    <div className="space-y-12 pt-8 lg:pt-10" aria-busy="true" aria-label="Loading the Atelier">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="space-y-6 lg:col-span-6">
          <Skeleton className="h-3 w-56" />
          <div className="space-y-3">
            <Skeleton className="h-11 w-full max-w-lg sm:h-14" />
            <Skeleton className="h-11 w-3/4 max-w-md sm:h-14" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-11/12 max-w-xl" />
            <Skeleton className="h-4 w-2/3 max-w-xl" />
          </div>
          <Skeleton className="h-12 w-44 rounded-none" />
        </div>
        <div className="flex justify-center lg:col-span-6">
          <Skeleton className="h-[52svh] max-h-[640px] w-[60%] max-w-[380px] rounded-none lg:h-[min(72svh,760px)]" />
        </div>
      </div>
      <div className="space-y-6 border-t border-foreground/15 pt-8">
        <Skeleton className="h-7 w-48" />
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-start justify-between gap-6 py-5">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="hidden h-11 w-40 rounded-none sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
