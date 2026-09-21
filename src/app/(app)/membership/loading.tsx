import { MembershipSkeleton } from "@/components/membership/membership-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8" aria-busy="true" aria-label="Loading your membership">
      <MembershipSkeleton />
    </div>
  );
}
