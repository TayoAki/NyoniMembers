import { QuotesSkeleton } from "@/components/atelier/staff/quotes/quotes-skeleton";
import { QUOTES_DESCRIPTION, QUOTES_TITLE } from "@/components/atelier/staff/quotes/quotes-words";
import { StaffShell } from "@/components/atelier/staff/staff-shell";

export default function Loading() {
  return (
    <StaffShell title={QUOTES_TITLE} description={QUOTES_DESCRIPTION}>
      <QuotesSkeleton />
    </StaffShell>
  );
}
