import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the membership page: header, the tier block and the benefit lines. */
export function AtelierMembershipSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your membership">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72 max-w-full sm:h-11" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-8 border-y border-foreground/15 py-7 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-16 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full max-w-md" />
          ))}
        </div>
      </div>
      <Skeleton className="h-11 w-40 rounded-none" />
    </div>
  );
}
