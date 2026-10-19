import { Skeleton } from "@/components/ui/skeleton";

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

/** Mirrors the case page: the receipt header, the status block, then the quote, conversation and design sections. */
export function CaseSkeleton() {
  return (
    <div className="space-y-8 pt-6" aria-busy="true" aria-label="Loading your request">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72 max-w-full sm:h-11" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-none" />
      </div>
      <div className="space-y-3 border-y border-foreground/15 py-5">
        <Skeleton className="h-3 w-64 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-40" />
        <Rows count={4} />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-36" />
        <Rows count={3} />
        <Skeleton className="h-24 w-full rounded-none" />
      </div>
      <div className="space-y-5 border-t border-foreground/15 pt-6">
        <Skeleton className="h-6 w-64 max-w-full" />
        <Rows count={8} />
      </div>
    </div>
  );
}
