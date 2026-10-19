import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the fit page: header, the three-tab strip, then ruled rows. */
export function FitSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your fit">
      <div className="space-y-3">
        <Skeleton className="h-9 w-40 sm:h-11" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-6 border-b border-foreground/15 pb-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <ProfileSkeleton />
    </div>
  );
}

/** The profile panel while the account's versions load: status, facts, then the measurement rows. */
export function ProfileSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading your fit profile">
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
