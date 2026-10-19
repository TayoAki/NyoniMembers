import { Ruler } from "lucide-react";
import Link from "next/link";
import { StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function FitProfileNotFound() {
  return (
    <StaffShell title="Fit profile" description="This fit profile could not be found.">
      <EmptyState
        icon={Ruler}
        title="No fit profile with that id"
        description="The link may be incomplete or the id may belong to another table. Open the sheet from the fit queue instead."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.fit} />}>
            Back to fit review
          </Button>
        }
      />
    </StaffShell>
  );
}
