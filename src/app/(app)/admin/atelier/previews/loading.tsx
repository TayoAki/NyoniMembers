import { PreviewsSkeleton } from "@/components/atelier/staff/previews/previews-skeleton";
import { PREVIEWS_DESCRIPTION, PREVIEWS_TITLE } from "@/components/atelier/staff/previews/previews-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={PREVIEWS_TITLE} description={PREVIEWS_DESCRIPTION}>
      <PreviewsSkeleton />
    </StaffShell>
  );
}
