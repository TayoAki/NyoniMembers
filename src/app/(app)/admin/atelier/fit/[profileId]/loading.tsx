import { FitReviewSkeleton } from "@/components/atelier/staff/fit/fit-skeleton";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title="Fit profile">
      <FitReviewSkeleton />
    </StaffShell>
  );
}
