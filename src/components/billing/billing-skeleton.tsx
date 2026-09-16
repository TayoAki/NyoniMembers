import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SummaryCardsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)} aria-busy="true" aria-label="Loading balance">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PacksSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading packs">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Route-level skeleton: mirrors header → balance → plans → packs → ledger. */
export function BillingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8" aria-busy="true" aria-label="Loading billing">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-12 w-52" />
        <SummaryCardsSkeleton />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <PacksSkeleton />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
