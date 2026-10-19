"use client";

import { useQuery } from "convex/react";
import { Ruler } from "lucide-react";
import Link from "next/link";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import { FitQueueTable } from "./fit-queue-table";
import { FitQueueSkeleton } from "./fit-skeleton";
import { FIT_DESCRIPTION, FIT_TITLE } from "./fit-words";

/** A03 (O03): the versions awaiting a fitter. Needs the fitter role; admins pass. */
export function FitQueue() {
  return (
    <StaffShell title={FIT_TITLE} description={FIT_DESCRIPTION}>
      <StaffRoleGate role="fitter" fallback={<FitQueueSkeleton />}>
        <FitQueueBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function FitQueueBody() {
  const rows = useQuery(api.atelier.fit.queue, {});
  if (rows === undefined) return <FitQueueSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Ruler}
        title="Nothing awaits a fitter"
        description="A sheet appears here the moment a client submits guided measurements or answers a fitter's question."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.queue} />}>
            Back to the queue
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {pluralize(rows.length, "sheet")} awaiting review. Flags are for your attention, never a rejection: an unusual
        value may be right.
      </p>
      <div className="-mx-4 sm:mx-0">
        <FitQueueTable rows={rows} />
      </div>
    </div>
  );
}
