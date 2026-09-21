import { Skeleton } from "@/components/ui/skeleton";

export function MembershipSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-8 border-y border-foreground/20 py-7 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-16 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full max-w-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
