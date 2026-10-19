"use client";

import { useQuery } from "convex/react";
import { Scissors } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { StaffOrderSummaryView } from "@convex/atelier/orders";
import { ORDER_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { ProductionSkeleton } from "./production-skeleton";
import { ProductionTable } from "./production-table";
import {
  filterDescription,
  isProductionFilter,
  PRODUCTION_DESCRIPTION,
  PRODUCTION_FILTERS,
  PRODUCTION_TITLE,
  type ProductionFilter,
  STAFF_STATUS_WORDS,
} from "./production-words";

/** A05 (O05): every commission by status. One subscription; the tabs filter it. `?status=` names the tab. */
export function ProductionBoard() {
  return (
    <StaffShell title={PRODUCTION_TITLE} description={PRODUCTION_DESCRIPTION}>
      <StaffRoleGate role="operations" fallback={<ProductionSkeleton />}>
        <ProductionBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function ProductionBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("status");
  const [filter, setFilterState] = useState<ProductionFilter>(isProductionFilter(requested) ? requested : "all");
  const rows = useQuery(api.atelier.orders.list, {});

  const setFilter = useCallback(
    (next: ProductionFilter) => {
      setFilterState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (rows === undefined) return <ProductionSkeleton />;
  return <ProductionTabs rows={rows} filter={filter} onFilterChange={setFilter} />;
}

/** Pure: give it the rows and the filter and it renders deterministically. */
export function ProductionTabs({
  rows,
  filter,
  onFilterChange,
}: {
  rows: StaffOrderSummaryView[];
  filter: ProductionFilter;
  onFilterChange: (filter: ProductionFilter) => void;
}) {
  const counts = Object.fromEntries(
    PRODUCTION_FILTERS.map((entry) => [entry, rows.filter((row) => entry === "all" || row.status === entry).length]),
  ) as Record<ProductionFilter, number>;
  const visible = rows.filter((row) => filter === "all" || row.status === filter);
  return (
    <Tabs
      value={filter}
      onValueChange={(value) => {
        const next = String(value);
        if (isProductionFilter(next)) onFilterChange(next);
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        aria-label="Commission statuses"
        className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
      >
        {PRODUCTION_FILTERS.map((entry) => (
          <TabsTrigger
            key={entry}
            value={entry}
            className="h-11 flex-none gap-2 px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
          >
            {entry === "all" ? "All" : STAFF_STATUS_WORDS[entry]}
            <Mono upper={false} className="text-[11px]" aria-label={`${counts[entry]} commissions`}>
              {counts[entry]}
            </Mono>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={filter} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{filterDescription(filter)}</p>
        {visible.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title={filter === "all" ? "No commissions yet" : `Nothing is “${ORDER_STATUS_LABELS[filter]}”`}
            description={
              filter === "all"
                ? "A commission opens here the moment a client accepts a quote on their request."
                : "No commission is in this state right now."
            }
            action={
              filter === "all" ? (
                <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.quotes} />}>
                  Open the quotes desk
                </Button>
              ) : (
                <Button variant="outline" onClick={() => onFilterChange("all")}>
                  Show all commissions
                </Button>
              )
            }
          />
        ) : (
          <div className="-mx-4 sm:mx-0">
            <ProductionTable rows={visible} />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
