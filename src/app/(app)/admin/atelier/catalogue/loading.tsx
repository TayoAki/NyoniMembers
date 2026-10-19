import { CatalogueSkeleton } from "@/components/atelier/staff/catalogue/catalogue-skeleton";
import { CATALOGUE_DESCRIPTION, CATALOGUE_TITLE } from "@/components/atelier/staff/catalogue/catalogue-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={CATALOGUE_TITLE} description={CATALOGUE_DESCRIPTION}>
      <CatalogueSkeleton />
    </StaffShell>
  );
}
