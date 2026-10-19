import { Wrench } from "lucide-react";
import Link from "next/link";
import { StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function CorrectionNotFound() {
  return (
    <StaffShell title="Correction" description="This correction could not be found.">
      <EmptyState
        icon={Wrench}
        title="No correction with that id"
        description="The link may be incomplete or the id may belong to another table. Open the correction from the aftercare board instead."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.aftercare} />}>
            Back to aftercare
          </Button>
        }
      />
    </StaffShell>
  );
}
