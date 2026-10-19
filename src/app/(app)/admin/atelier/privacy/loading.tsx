import { PrivacySkeleton } from "@/components/atelier/staff/privacy/privacy-skeleton";
import { PRIVACY_DESCRIPTION, PRIVACY_TITLE } from "@/components/atelier/staff/privacy/privacy-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={PRIVACY_TITLE} description={PRIVACY_DESCRIPTION}>
      <PrivacySkeleton />
    </StaffShell>
  );
}
