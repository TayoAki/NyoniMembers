"use client";

import { useQuery } from "convex/react";
import { Images } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";
import { ATELIER_LIMITS, PREVIEW_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { CONSENT_VERSION, PHOTO_CONSENT, PROVIDER_DISCLOSURE_VERSION } from "@convex/shared/atelier/policy";
import { PreviewJobsTable } from "./preview-jobs-table";
import { PreviewsSkeleton } from "./previews-skeleton";
import {
  isPreviewFilter,
  PREVIEW_FILTERS,
  type PreviewFilter,
  previewFilterDescription,
  PREVIEWS_DESCRIPTION,
  PREVIEWS_TITLE,
} from "./previews-words";

/** A06 (O06): the jobs table by status, under the disclosure the client was shown. Needs the preview operations role. */
export function PreviewOps() {
  return (
    <StaffShell title={PREVIEWS_TITLE} description={PREVIEWS_DESCRIPTION}>
      <StaffRoleGate role="preview_ops" fallback={<PreviewsSkeleton />}>
        <PreviewOpsBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

/** The disclosure as a book: what the client agreed to, by version, so an operator can answer for it. */
export function DisclosureBook() {
  return (
    <OrderBook>
      <OrderBookRow label="Provider" value={PHOTO_CONSENT.provider} code={PROVIDER_DISCLOSURE_VERSION} />
      <OrderBookRow
        label="Consent version"
        value={
          <Mono upper={false} className="text-foreground">
            {CONSENT_VERSION}
          </Mono>
        }
        note="Stamped on every photograph when the client adds it."
      />
      <OrderBookRow label="Retention" value={PHOTO_CONSENT.retention} />
      <OrderBookRow
        label="Limits"
        value={`${ATELIER_LIMITS.previewsPerDay} previews a day per owner · a job still working after ${ATELIER_LIMITS.previewTimeoutMinutes} minutes is marked “${PREVIEW_STATUS_LABELS.failed}” and may be retried · results expire after ${ATELIER_LIMITS.previewResultDays} days`}
      />
      <OrderBookRow
        label="Staff access"
        value="Only this role and admins can open a result, and every look is written to the audit log as photo.view."
      />
    </OrderBook>
  );
}

function PreviewOpsBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("status");
  const [filter, setFilterState] = useState<PreviewFilter>(isPreviewFilter(requested) ? requested : "all");

  const setFilter = useCallback(
    (next: PreviewFilter) => {
      setFilterState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-2">
      <AtelierSection
        id="disclosure"
        title="What the client was told"
        description="The provider and retention disclosure, by version. Provider deletion limits stay disclosed to the client."
      >
        <DisclosureBook />
      </AtelierSection>
      <AtelierSection id="jobs" title="Jobs" description="Newest first; at most 100 a view.">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            const next = String(value);
            if (isPreviewFilter(next)) setFilter(next);
          }}
          className="gap-6"
        >
          <TabsList
            variant="line"
            aria-label="Job statuses"
            className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
          >
            {PREVIEW_FILTERS.map((entry) => (
              <TabsTrigger
                key={entry}
                value={entry}
                className="h-11 flex-none gap-2 px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
              >
                {entry === "all" ? "All" : PREVIEW_STATUS_LABELS[entry]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={filter} className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{previewFilterDescription(filter)}</p>
            <JobsBody filter={filter} onShowAll={() => setFilter("all")} />
          </TabsContent>
        </Tabs>
      </AtelierSection>
    </div>
  );
}

function JobsBody({ filter, onShowAll }: { filter: PreviewFilter; onShowAll: () => void }) {
  const rows = useQuery(api.atelier.previews.listJobs, filter === "all" ? {} : { status: filter });
  if (rows === undefined) return <PreviewsSkeleton rows={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title={filter === "all" ? "No preview jobs yet" : `Nothing is “${PREVIEW_STATUS_LABELS[filter]}”`}
        description={
          filter === "all"
            ? "A job appears here the moment a client with a photograph asks to see a design on themselves."
            : "No job is in this state right now."
        }
        action={
          filter === "all" ? undefined : (
            <Button variant="outline" onClick={onShowAll}>
              Show all jobs
            </Button>
          )
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{pluralize(rows.length, "job")}</p>
      <div className="-mx-4 sm:mx-0">
        <PreviewJobsTable rows={rows} />
      </div>
    </div>
  );
}
