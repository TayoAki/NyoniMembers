import { GroupsSkeleton } from "@/components/atelier/staff/groups/groups-skeleton";
import { GROUPS_DESCRIPTION, GROUPS_TITLE } from "@/components/atelier/staff/groups/groups-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={GROUPS_TITLE} description={GROUPS_DESCRIPTION}>
      <GroupsSkeleton />
    </StaffShell>
  );
}
