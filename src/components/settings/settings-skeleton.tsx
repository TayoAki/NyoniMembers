import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Route-level skeleton: mirrors header → photos → preferences → appearance → danger zone. */
export function SettingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={1} />
      <SectionSkeleton rows={1} />
    </div>
  );
}
