"use client";

import { useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffPrivacyRow } from "@convex/atelier/privacy";
import { PrivacyRequestDetail } from "./privacy-request-detail";
import { PrivacySkeleton } from "./privacy-skeleton";
import { OWNER_KIND_WORDS, PRIVACY_STATUS_TONES } from "./privacy-words";

/** A08: open privacy requests, oldest first; one opens below the table. */
export function PrivacyQueue() {
  const rows = useQuery(api.atelier.privacy.queue, {});
  const [selected, setSelected] = useState<Id<"atelierPrivacyRequests"> | null>(null);
  if (rows === undefined) return <PrivacySkeleton rows={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No open privacy requests"
        description="A request appears here the moment a client asks for an export, the removal of their photographs, the deletion of their designs or the closure of their account. Completed and rejected requests leave the queue."
      />
    );
  }
  const open = selected !== null && rows.some((row) => row._id === selected) ? selected : null;
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{pluralize(rows.length, "open request")}, oldest first.</p>
        <div className="-mx-4 sm:mx-0">
          <PrivacyQueueTable rows={rows} selected={open} onSelect={setSelected} />
        </div>
      </div>
      {open ? (
        <section aria-label="Selected request" className="border-t border-foreground/15 pt-6">
          <PrivacyRequestDetail requestId={open} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Open a request to see its steps and act on it.</p>
      )}
    </div>
  );
}

export function PrivacyQueueTable({
  rows,
  selected,
  onSelect,
}: {
  rows: StaffPrivacyRow[];
  selected: Id<"atelierPrivacyRequests"> | null;
  onSelect: (id: Id<"atelierPrivacyRequests">) => void;
}) {
  return (
    <Table className="min-w-[56rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Request</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Steps</TableHead>
          <TableHead>Exceptions</TableHead>
          <TableHead>Handled by</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead>
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row._id}
            className={cn("align-top", selected === row._id && "bg-primary/5")}
            aria-selected={selected === row._id}
          >
            <TableCell className="font-medium whitespace-normal">
              <div className="flex flex-col gap-0.5">
                <span>{row.clientName}</span>
                <span className="text-xs font-normal text-muted-foreground">{OWNER_KIND_WORDS[row.ownerKind]}</span>
              </div>
            </TableCell>
            <TableCell className="whitespace-normal">{row.kindLabel}</TableCell>
            <TableCell className="whitespace-normal">
              <StatusLine tone={PRIVACY_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
            </TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex flex-col gap-0.5">
                <span className={cn(row.pendingSteps === 0 && "text-muted-foreground")}>
                  {row.pendingSteps === 0 ? "All settled" : `${pluralize(row.pendingSteps, "step")} pending`}
                </span>
                {row.failedSteps > 0 ? (
                  <span className="text-xs text-destructive">{pluralize(row.failedSteps, "step")} failed</span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className={cn(row.exceptionCount === 0 && "text-muted-foreground")}>
              {row.exceptionCount === 0 ? "None" : pluralize(row.exceptionCount, "exception")}
            </TableCell>
            <TableCell className={cn(row.handledBy === null && "text-muted-foreground")}>
              {row.handledBy ?? "Nobody yet"}
            </TableCell>
            <TableCell>
              <Mono upper={false} className="text-[11px] text-foreground/80">
                {formatRelative(row.requestedAt)}
              </Mono>
            </TableCell>
            <TableCell>
              <Button
                variant={selected === row._id ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => onSelect(row._id)}
              >
                {selected === row._id ? "Open" : "Open"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
