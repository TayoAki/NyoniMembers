import { ProductionSkeleton } from "@/components/atelier/staff/production/production-skeleton";
import { PRODUCTION_DESCRIPTION, PRODUCTION_TITLE } from "@/components/atelier/staff/production/production-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={PRODUCTION_TITLE} description={PRODUCTION_DESCRIPTION}>
      <ProductionSkeleton />
    </StaffShell>
  );
}
