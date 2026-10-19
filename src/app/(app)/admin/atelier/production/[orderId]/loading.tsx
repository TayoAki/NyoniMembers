import { OrderDeskSkeleton } from "@/components/atelier/staff/production/production-skeleton";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title="Commission">
      <OrderDeskSkeleton />
    </StaffShell>
  );
}
