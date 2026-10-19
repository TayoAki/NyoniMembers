import { Skeleton } from "@/components/ui/skeleton";

/** Ruled rows of the kind every privacy section lists: a short label, a longer value. */
export function PrivacyRows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-foreground/10 border-y border-foreground/15" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton({ rows, action = true }: { rows: number; action?: boolean }) {
  return (
    <div className="space-y-5 border-t border-foreground/15 py-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <PrivacyRows count={rows} />
      {action ? <Skeleton className="h-11 w-44 rounded-none" /> : null}
    </div>
  );
}

/** Mirrors the privacy centre: the header, then its five sections with their rows and one action each. */
export function PrivacySkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your privacy controls">
      <div className="space-y-3">
        <Skeleton className="h-9 w-56 sm:h-11" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div>
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={4} action={false} />
      </div>
    </div>
  );
}
