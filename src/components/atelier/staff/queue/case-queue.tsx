"use client";

import { useQuery } from "convex/react";
import { Inbox } from "lucide-react";
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
import type { QueueFilter } from "@convex/atelier/cases";
import { QueueSkeleton } from "./queue-skeleton";
import { QueueTable } from "./queue-table";
import {
  isQueueFilter,
  QUEUE_EMPTY_WORDS,
  QUEUE_FILTER_DESCRIPTIONS,
  QUEUE_FILTER_LABELS,
  QUEUE_FILTERS,
  QUEUE_DESCRIPTION,
  QUEUE_TITLE,
} from "./queue-words";

/** A01 (O01): the intake queue with its five filters. `?filter=` names the tab so a case page returns here. */
export function CaseQueue() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("filter");
  const [filter, setFilterState] = useState<QueueFilter>(isQueueFilter(requested) ? requested : "unassigned");

  const setFilter = useCallback(
    (next: QueueFilter) => {
      setFilterState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("filter", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <StaffShell title={QUEUE_TITLE} description={QUEUE_DESCRIPTION}>
      <StaffRoleGate role="concierge" fallback={<QueueSkeleton />}>
        <Tabs
          value={filter}
          onValueChange={(value) => {
            const next = String(value);
            if (isQueueFilter(next)) setFilter(next);
          }}
          className="gap-6"
        >
          <TabsList
            variant="line"
            aria-label="Queue filters"
            className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
          >
            {QUEUE_FILTERS.map((entry) => (
              <TabsTrigger
                key={entry}
                value={entry}
                className="h-11 flex-none gap-2 px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
              >
                {QUEUE_FILTER_LABELS[entry]}
                <FilterCount filter={entry} />
              </TabsTrigger>
            ))}
          </TabsList>
          {QUEUE_FILTERS.map((entry) => (
            <TabsContent key={entry} value={entry} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{QUEUE_FILTER_DESCRIPTIONS[entry]}</p>
              <QueueBody filter={entry} active={entry === filter} onShowAll={() => setFilter("all")} />
            </TabsContent>
          ))}
        </Tabs>
      </StaffRoleGate>
    </StaffShell>
  );
}

/** The count beside each filter. Each is its own small subscription so the numbers stay live. */
function FilterCount({ filter }: { filter: QueueFilter }) {
  const rows = useQuery(api.atelier.cases.queue, { filter });
  return (
    <Mono
      upper={false}
      className="text-[11px]"
      aria-label={rows === undefined ? "counting" : `${rows.length} requests`}
    >
      {rows === undefined ? "…" : rows.length}
    </Mono>
  );
}

function QueueBody({ filter, active, onShowAll }: { filter: QueueFilter; active: boolean; onShowAll: () => void }) {
  const rows = useQuery(api.atelier.cases.queue, active ? { filter } : "skip");
  const [now] = useState(() => Date.now());
  if (rows === undefined) return <QueueSkeleton rows={4} />;
  if (rows.length === 0) {
    const words = QUEUE_EMPTY_WORDS[filter];
    return (
      <EmptyState
        icon={Inbox}
        title={words.title}
        description={words.description}
        action={
          filter === "all" ? (
            <Button variant="outline" nativeButton={false} render={<Link href={routes.atelier.home} />}>
              Open the Atelier
            </Button>
          ) : (
            <Button variant="outline" onClick={onShowAll}>
              Show all requests
            </Button>
          )
        }
      />
    );
  }
  return (
    <div className="-mx-4 sm:mx-0">
      <QueueTable rows={rows} now={now} />
    </div>
  );
}
