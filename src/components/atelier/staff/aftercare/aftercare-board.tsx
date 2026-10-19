"use client";

import { useQuery } from "convex/react";
import { Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import { CORRECTION_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { AftercareSkeleton } from "./aftercare-skeleton";
import { AftercareTable } from "./aftercare-table";
import {
  AFTERCARE_DESCRIPTION,
  AFTERCARE_FILTERS,
  AFTERCARE_TITLE,
  type AftercareFilter,
  aftercareFilterDescription,
  isAftercareFilter,
  STAFF_STATUS_WORDS,
} from "./aftercare-words";

const ROLES = ["operations", "finance"] as const;

/** A07 (O07): corrections by status. `?status=` names the tab so a correction page returns here. */
export function AftercareBoard() {
  return (
    <StaffShell title={AFTERCARE_TITLE} description={AFTERCARE_DESCRIPTION}>
      <StaffRoleGate role={ROLES} fallback={<AftercareSkeleton />}>
        <AftercareBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function AftercareBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("status");
  const [filter, setFilterState] = useState<AftercareFilter>(isAftercareFilter(requested) ? requested : "open");

  const setFilter = useCallback(
    (next: AftercareFilter) => {
      setFilterState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => {
        const next = String(value);
        if (isAftercareFilter(next)) setFilter(next);
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        aria-label="Correction statuses"
        className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
      >
        {AFTERCARE_FILTERS.map((entry) => (
          <TabsTrigger
            key={entry}
            value={entry}
            className="h-11 flex-none px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
          >
            {entry === "open" ? "Open" : STAFF_STATUS_WORDS[entry]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={filter} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{aftercareFilterDescription(filter)}</p>
        <AftercareRows filter={filter} onShowOpen={() => setFilter("open")} />
      </TabsContent>
    </Tabs>
  );
}

function AftercareRows({ filter, onShowOpen }: { filter: AftercareFilter; onShowOpen: () => void }) {
  const rows = useQuery(api.atelier.corrections.queue, filter === "open" ? {} : { status: filter });
  if (rows === undefined) return <AftercareSkeleton rows={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title={filter === "open" ? "No correction is open" : `Nothing is “${CORRECTION_STATUS_LABELS[filter]}”`}
        description={
          filter === "open"
            ? "A correction appears here the moment a client raises a fit, quality, return or refund issue on a commission in their hands."
            : "No correction is in this state right now."
        }
        action={
          filter === "open" ? (
            <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.production} />}>
              Open production
            </Button>
          ) : (
            <Button variant="outline" onClick={onShowOpen}>
              Show open corrections
            </Button>
          )
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{pluralize(rows.length, "correction")}</p>
      <div className="-mx-4 sm:mx-0">
        <AftercareTable rows={rows} />
      </div>
    </div>
  );
}
