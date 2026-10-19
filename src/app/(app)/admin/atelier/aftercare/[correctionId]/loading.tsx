import { CorrectionDeskSkeleton } from "@/components/atelier/staff/aftercare/aftercare-skeleton";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title="Correction">
      <CorrectionDeskSkeleton />
    </StaffShell>
  );
}
