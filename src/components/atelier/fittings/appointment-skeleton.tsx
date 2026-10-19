import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the appointment page: header, the status block, then the order-book rows and the history. */
export function AppointmentSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading the appointment">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64 max-w-full sm:h-11" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-28 rounded-none" />
      </div>
      <div className="space-y-3 border-y border-foreground/15 py-5">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="divide-y divide-foreground/10 border-y border-foreground/15">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
