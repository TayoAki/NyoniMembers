"use client";

import { useQuery } from "convex/react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { LoadingRows } from "@/components/common/loading-grid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { NotificationView } from "@convex/atelier/notifications";
import { NOTIFICATION_STATUS_TONES, NOTIFICATION_STATUS_WORDS } from "./case-words";

/** Records, not sends: what the client has and has not been told, with the real delivery state of each. */
export function NotificationsPanel({ caseId }: { caseId: Id<"atelierCases"> }) {
  const rows = useQuery(api.atelier.notifications.listForCase, { caseId });
  return (
    <AtelierSection
      id="notifications"
      title="Notifications"
      description="Every message record for this request, newest first. Nothing has reached the client unless it says Sent or Delivered; the in-app request is the record."
    >
      {rows === undefined ? (
        <LoadingRows count={3} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notification records yet.</p>
      ) : (
        <NotificationsTable rows={rows} />
      )}
    </AtelierSection>
  );
}

export function NotificationsTable({ rows }: { rows: NotificationView[] }) {
  return (
    <div className="-mx-4 sm:mx-0">
      <Table className="min-w-[40rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Created</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id} className="align-top">
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatDateTime(row.createdAt)}
                </Mono>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span>{row.to}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.channel === "in_app" ? "In the app" : row.channel === "sms" ? "Text message" : "Email"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="max-w-[32ch] whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span>{row.subject}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{row.body}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <StatusLine tone={NOTIFICATION_STATUS_TONES[row.status]}>
                    {NOTIFICATION_STATUS_WORDS[row.status]}
                  </StatusLine>
                  {row.sentAt !== null ? (
                    <span className="text-xs text-muted-foreground">{formatDateTime(row.sentAt)}</span>
                  ) : null}
                  {row.providerRef ? <Mono upper={false}>{row.providerRef}</Mono> : null}
                  {row.error ? <span className="text-xs text-destructive">{row.error}</span> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
