"use client";

import { CASE_PRIORITY_LABELS } from "@convex/shared/atelier/enums";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { StaffCaseRow } from "@convex/atelier/cases";
import { CASE_STATUS_TONES } from "./queue-words";

/**
 * A01: the dense table of requests. Pure: give it rows and it renders the same every time. The whole
 * row opens the case; the client's name is the real link so the keyboard and screen readers reach it.
 */
export function QueueTable({ rows, now, className }: { rows: StaffCaseRow[]; now: number; className?: string }) {
  const router = useRouter();
  return (
    <Table className={cn("min-w-[56rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Request</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead>Next action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = routes.staffAtelier.case(row._id);
          const dueSoon = row.nextActionDueAt !== null && row.nextActionDueAt <= now;
          return (
            <TableRow
              key={row._id}
              className="cursor-pointer align-top"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) return;
                router.push(href);
              }}
            >
              <TableCell className="font-medium">
                <Link href={href} className="inline-flex min-h-7 items-center underline-offset-4 hover:underline">
                  {row.clientFirstName}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span>{row.kindLabel}</span>
                  {row.draftName ? <span className="text-xs text-muted-foreground">{row.draftName}</span> : null}
                </div>
              </TableCell>
              <TableCell>
                <StatusLine tone={CASE_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
              </TableCell>
              <TableCell className={cn(row.ownerFirstName === null && "text-muted-foreground")}>
                {row.ownerFirstName ?? "Unassigned"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className={cn(row.priority === "high" && "font-medium text-warning")}>
                    {CASE_PRIORITY_LABELS[row.priority]}
                  </span>
                  {row.overdue ? <span className="text-xs text-warning">Overdue</span> : null}
                  {row.escalatedAt !== null ? (
                    <span className="text-xs text-muted-foreground">Escalated {formatRelative(row.escalatedAt)}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatRelative(row.lastActivityAt)}
                </Mono>
              </TableCell>
              <TableCell className="whitespace-normal">
                {row.nextAction ? (
                  <div className="flex max-w-[24ch] flex-col gap-0.5">
                    <span>{row.nextAction}</span>
                    {row.nextActionDueAt !== null ? (
                      <Mono
                        upper={false}
                        className={cn("text-[11px]", dueSoon ? "text-warning" : "text-foreground/80")}
                      >
                        {dueSoon ? "Due " : "By "}
                        {formatDate(row.nextActionDueAt)}
                      </Mono>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None set</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
