import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the shared design: the title block, the figure and the order book. */
export function SharedSkeleton() {
  return (
    <div className="space-y-10 pt-6" aria-busy="true" aria-label="Loading the shared design">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-80 max-w-full sm:h-14" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex justify-center lg:col-span-5">
          <Skeleton className="h-[48svh] max-h-[560px] w-[55%] max-w-[320px] rounded-none" />
        </div>
        <div className="divide-y divide-foreground/10 border-y border-foreground/15 lg:col-span-7">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
