import { AftercareSkeleton } from "@/components/atelier/staff/aftercare/aftercare-skeleton";
import { AFTERCARE_DESCRIPTION, AFTERCARE_TITLE } from "@/components/atelier/staff/aftercare/aftercare-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={AFTERCARE_TITLE} description={AFTERCARE_DESCRIPTION}>
      <AftercareSkeleton />
    </StaffShell>
  );
}
