import { Skeleton } from "@/components/ui/skeleton";

function Header({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full sm:h-11" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {action ? <Skeleton className="h-11 w-36 rounded-none" /> : null}
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-foreground/10 border-y border-foreground/15">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors the groups list: header with its action, then ruled rows of name, status and counts. */
export function GroupsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your groups">
      <Header />
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
            <div className="space-y-2.5">
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-3 w-44 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-11 w-20 rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the group page: header, the status block, the brief, the shared design and the participants. */
export function GroupSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading the group">
      <Header />
      <div className="space-y-3 border-y border-foreground/15 py-5">
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-48" />
        <Rows count={6} />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-40" />
        <Rows count={3} />
      </div>
    </div>
  );
}

/** Mirrors the join page: header, the shared design, what is yours to choose, the two consents and the action. */
export function JoinSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-6" aria-busy="true" aria-label="Loading your invitation">
      <Header action={false} />
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-48" />
        <Rows count={6} />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-40" />
        <Rows count={2} />
      </div>
      <Skeleton className="h-11 w-56 rounded-none" />
    </div>
  );
}
