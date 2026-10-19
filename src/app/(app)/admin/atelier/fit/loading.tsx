import { FitQueueSkeleton } from "@/components/atelier/staff/fit/fit-skeleton";
import { FIT_DESCRIPTION, FIT_TITLE } from "@/components/atelier/staff/fit/fit-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={FIT_TITLE} description={FIT_DESCRIPTION}>
      <FitQueueSkeleton />
    </StaffShell>
  );
}
