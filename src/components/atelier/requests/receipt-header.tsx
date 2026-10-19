"use client";

import Link from "next/link";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { CASE_TONES, nextWords, notificationWords, RECORD_SENTENCE } from "@/components/atelier/requests/case-words";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CaseView } from "@convex/atelier/cases";

/**
 * S25: the receipt. "Request received" with the id, the truthful status and who holds it, what happens
 * next, and where the house intends to write — with the plain statement that this page is the record.
 */
export function ReceiptHeader({ request }: { request: CaseView }) {
  const concierge = request.ownerFirstName && request.status !== "received" && request.status !== "cancelled";
  return (
    <>
      <PageHeader
        title="Request received."
        description={
          <>
            {request.kindLabel}
            {request.draftName ? (
              <>
                {" "}
                about <span className="font-display text-foreground">{request.draftName}</span>
              </>
            ) : null}
            {" · sent "}
            {formatDateTime(request.createdAt)}
          </>
        }
        actions={
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.requests} />}
            nativeButton={false}
          >
            All requests
          </Button>
        }
      />

      <section aria-label="Status" className="space-y-3 border-y border-foreground/15 py-5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground">Request</span>
          <Mono upper={false} className="text-foreground">
            {request._id}
          </Mono>
        </p>
        <StatusLine tone={CASE_TONES[request.status]} live className="text-sm">
          {request.statusLabel}
        </StatusLine>
        <div className="max-w-2xl space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          {concierge ? (
            <p>
              <span className="text-foreground">{request.ownerFirstName}</span> is your concierge for this request.
            </p>
          ) : null}
          <p>{nextWords(request)}</p>
          {request.open && request.nextAction ? (
            <p>
              Next with the house: {request.nextAction}
              {request.nextActionDueAt ? ` · by ${formatDate(request.nextActionDueAt)}` : ""}
            </p>
          ) : null}
          {request.open && request.overdue ? (
            <p className="text-warning">This has waited longer than the house intends.</p>
          ) : null}
          <p>
            {notificationWords(request.contact)} {RECORD_SENTENCE}
          </p>
        </div>
      </section>
    </>
  );
}
