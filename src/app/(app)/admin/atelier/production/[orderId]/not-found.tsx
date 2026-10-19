import { Scissors } from "lucide-react";
import Link from "next/link";
import { StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function OrderNotFound() {
  return (
    <StaffShell title="Commission" description="This commission could not be found.">
      <EmptyState
        icon={Scissors}
        title="No commission with that id"
        description="The link may be incomplete or the id may belong to another table. Open the commission from the production board instead."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.production} />}>
            Back to production
          </Button>
        }
      />
    </StaffShell>
  );
}
