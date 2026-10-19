"use client";

import { useQuery } from "convex/react";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { QuoteQueueItem } from "@convex/atelier/quotes";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { QuotesSkeleton } from "./quotes-skeleton";
import { QuotesTable } from "./quotes-table";
import { expiryWords, QUOTES_DESCRIPTION, QUOTES_TITLE } from "./quotes-words";

/** A04 (O04): offered quotes by expiry, then quotes being prepared. Needs the finance role; admins pass. */
export function QuotesQueue() {
  return (
    <StaffShell title={QUOTES_TITLE} description={QUOTES_DESCRIPTION}>
      <StaffRoleGate role="finance" fallback={<QuotesSkeleton />}>
        <QuotesBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function QuotesBody() {
  const rows = useQuery(api.atelier.quotes.queue, {});
  const [now] = useState(() => Date.now());
  if (rows === undefined) return <QuotesSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No quotes are waiting"
        description="A quote is composed on a request from the queue. Offered quotes appear here until the client accepts them or they expire."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.queue} />}>
            Open the queue
          </Button>
        }
      />
    );
  }
  const offered = rows.filter((row) => row.status === "offered");
  const drafts = rows.filter((row) => row.status === "draft");
  const other = rows.filter((row) => row.status !== "offered" && row.status !== "draft");
  const soon = offered.filter((row) => expiryWords(row.expiresAt, now, row.status).soon).length;
  return (
    <div className="space-y-2">
      <QuotesSection
        id="offered"
        title="Offered · awaiting the client"
        description={
          offered.length === 0
            ? "Nothing is waiting on a client."
            : `${pluralize(offered.length, "quote")} waiting on a client${soon > 0 ? `; ${pluralize(soon, "is", "are")} expiring soon` : ""}. A quote lapses ${ATELIER_LIMITS.quoteValidDays} days after it is offered unless finance set another date.`
        }
        rows={offered}
        now={now}
      />
      <QuotesSection
        id="prepared"
        title="Being prepared"
        description={
          drafts.length === 0
            ? "No quote is being prepared."
            : `${pluralize(drafts.length, "quote")} not yet offered. The client cannot see a quote until it is offered from the request.`
        }
        rows={drafts}
        now={now}
      />
      {other.length > 0 ? (
        <QuotesSection
          id="other"
          title="Also listed"
          description="Quotes the queue returned in another state."
          rows={other}
          now={now}
        />
      ) : null}
    </div>
  );
}

function QuotesSection({
  id,
  title,
  description,
  rows,
  now,
}: {
  id: string;
  title: string;
  description: string;
  rows: QuoteQueueItem[];
  now: number;
}) {
  return (
    <AtelierSection id={id} title={title} description={description}>
      {rows.length > 0 ? (
        <div className="-mx-4 sm:mx-0">
          <QuotesTable rows={rows} now={now} />
        </div>
      ) : null}
    </AtelierSection>
  );
}
