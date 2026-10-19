import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The "See it on you" step while the photograph and this design's previews load: the same shape, nothing invented. */
export function PreviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true" aria-label="Loading this step">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56 rounded-sm" />
        <Skeleton className="h-3.5 w-full max-w-xl rounded-sm" />
        <Skeleton className="h-3.5 w-4/5 max-w-lg rounded-sm" />
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,10rem)_1fr]">
        <Skeleton className="aspect-[3/4] w-full max-w-40 rounded-sm" />
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-40 rounded-sm" />
          <Skeleton className="h-3.5 w-64 rounded-sm" />
          <Skeleton className="h-3.5 w-52 rounded-sm" />
          <Skeleton className="mt-4 h-11 w-44 rounded-sm" />
        </div>
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3.5 w-24 rounded-sm" />
            <Skeleton className={cn("h-3.5 rounded-sm", index === 1 ? "w-56" : "w-40")} />
          </div>
        ))}
      </div>
    </div>
  );
}
