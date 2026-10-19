import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the catalogue desk: the version line, the kind tabs, then entry rows. */
export function CatalogueSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the catalogue">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 pb-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-9 w-40 rounded-none" />
      </div>
      <div className="flex gap-6 border-b border-foreground/15">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="mb-3 h-5 w-20" />
        ))}
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <Skeleton className="size-10 rounded-sm" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="ml-auto h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
