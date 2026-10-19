"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { StaffCorrectionRow } from "@convex/atelier/corrections";
import { CASE_PRIORITY_LABELS } from "@convex/shared/atelier/enums";
import { CORRECTION_STATUS_TONES } from "./aftercare-words";

/** A07: corrections as a dense table. Pure. The whole row opens the correction; the client's name is the real link. */
export function AftercareTable({ rows, className }: { rows: StaffCorrectionRow[]; className?: string }) {
  const router = useRouter();
  return (
    <Table className={cn("min-w-[60rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Refund</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = routes.staffAtelier.correction(row._id);
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
                  {row.clientName}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex max-w-[24ch] flex-col gap-0.5">
                  <span>{row.kindLabel}</span>
                  {row.regionLabel ? <span className="text-xs text-muted-foreground">{row.regionLabel}</span> : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex max-w-[26ch] flex-col gap-0.5">
                  <StatusLine tone={CORRECTION_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
                  {row.escalatedAt !== null ? (
                    <span className="text-xs text-muted-foreground">Escalated {formatRelative(row.escalatedAt)}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className={cn("whitespace-normal", !row.refundStateLabel && "text-muted-foreground")}>
                {row.refundStateLabel ?? "None"}
              </TableCell>
              <TableCell className={cn(row.casePriority === "high" && "font-medium text-warning")}>
                {CASE_PRIORITY_LABELS[row.casePriority]}
              </TableCell>
              <TableCell className={cn(row.caseOwner === null && "text-muted-foreground")}>
                {row.caseOwner ?? "Unassigned"}
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatRelative(row.updatedAt)}
                </Mono>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
