import { StaffShell } from "@/components/atelier/staff/staff-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the case desk: the request facts, the submitted design, the conversation. */
export function CaseSkeleton() {
  return (
    <StaffShell title="Request" description="Loading the request…">
      <div className="space-y-8" aria-busy="true" aria-label="Loading the request">
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="hidden h-7 w-20 sm:block" />
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-foreground/15 pt-6">
          <Skeleton className="h-6 w-56" />
          <div className="divide-y divide-foreground/10 border-y border-foreground/15">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 border-t border-foreground/15 pt-6">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
          ))}
          <Skeleton className="h-20 w-full rounded-sm" />
        </div>
      </div>
    </StaffShell>
  );
}
