"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { StaffOrderSummaryView } from "@convex/atelier/orders";
import { ORDER_STATUS_TONES, PAYMENT_STATE_TONES } from "./production-words";

/** A05: commissions as a dense table. Pure. The whole row opens the commission; the client's name is the real link. */
export function ProductionTable({ rows, className }: { rows: StaffOrderSummaryView[]; className?: string }) {
  const router = useRouter();
  return (
    <Table className={cn("min-w-[64rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Commission</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Ready</TableHead>
          <TableHead>Maker ref</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = routes.staffAtelier.order(row._id);
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
              <TableCell className="max-w-[28ch] whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <span>{row.summary}</span>
                  {row.clothName ? (
                    <span className="font-display text-xs text-muted-foreground">{row.clothName}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  <StatusLine tone={ORDER_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
                  {row.hasRisk ? <span className="text-xs text-warning">Risk to the date noted</span> : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <StatusLine tone={PAYMENT_STATE_TONES[row.paymentState]}>{row.paymentStateLabel}</StatusLine>
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {row.eventDate !== null ? formatDate(row.eventDate) : "None"}
                </Mono>
              </TableCell>
              <TableCell className="whitespace-normal">
                {row.estimatedReadyAt !== null ? (
                  <span className="flex flex-col gap-0.5">
                    <Mono upper={false} className="text-[11px] text-foreground/80">
                      {formatDate(row.estimatedReadyAt)}
                    </Mono>
                    <span className="text-xs text-muted-foreground">Estimate</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">No estimate</span>
                )}
              </TableCell>
              <TableCell>
                {row.makerRef ? (
                  <Mono upper={false}>{row.makerRef}</Mono>
                ) : (
                  <span className="text-muted-foreground">Not released</span>
                )}
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
