import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The panel's shape while a step's module or its data loads: ruled rows, nothing invented. */
export function StepPanelSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn("divide-y divide-foreground/10 border-y border-foreground/15", className)}
      aria-busy="true"
      aria-label="Loading this step"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto]">
          <Skeleton className="h-3.5 w-24 rounded-sm" />
          <Skeleton className={cn("h-3.5 rounded-sm", index % 3 === 0 ? "w-40" : index % 3 === 1 ? "w-56" : "w-32")} />
          <Skeleton className="hidden h-3.5 w-14 rounded-sm sm:block" />
        </div>
      ))}
    </div>
  );
}

function StepRailSkeleton() {
  return (
    <div className="flex items-stretch gap-6 overflow-hidden border-b border-foreground/15">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex min-h-11 items-center gap-2">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className={cn("h-3 rounded-sm", index === 4 ? "w-24" : "w-14")} />
        </div>
      ))}
    </div>
  );
}

/** The whole studio before the design has arrived: the stage column, the rail, the panel header, rows. */
export function StudioSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-x-10 xl:gap-x-14" aria-busy="true" aria-label="Loading the studio">
      <div className="flex h-[36svh] flex-col py-3 lg:col-span-7 lg:h-[calc(100svh-7.5rem)] lg:py-0 lg:pt-8">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Skeleton className="aspect-[3/5] h-full max-w-full rounded-sm" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-3 w-28 rounded-sm" />
          <Skeleton className="h-3 w-40 rounded-sm" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Skeleton className="h-11 w-56 rounded-sm" />
          <Skeleton className="h-11 w-28 rounded-sm" />
        </div>
      </div>
      <div className="min-w-0 pt-4 pb-6 lg:col-span-5 lg:pt-8">
        <StepRailSkeleton />
        <div className="space-y-3 border-b border-foreground/15 py-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-40 rounded-sm" />
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
          <Skeleton className="h-8 w-32 rounded-sm" />
          <Skeleton className="h-3 w-36 rounded-sm" />
        </div>
        <StepPanelSkeleton className="mt-6 border-t-0" />
      </div>
    </div>
  );
}
