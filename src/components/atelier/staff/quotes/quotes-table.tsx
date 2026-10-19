"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { QuoteQueueItem } from "@convex/atelier/quotes";
import { expiryWords, QUOTE_STATUS_TONES } from "./quotes-words";

/** A04: quotes as a dense table. Pure. A quote is priced and offered on its request, so each row opens the request. */
export function QuotesTable({ rows, now, className }: { rows: QuoteQueueItem[]; now: number; className?: string }) {
  const router = useRouter();
  return (
    <Table className={cn("min-w-[56rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Client</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Design</TableHead>
          <TableHead>Benefit</TableHead>
          <TableHead>Offered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const href = routes.staffAtelier.case(row.caseId);
          const expiry = expiryWords(row.expiresAt, now, row.status);
          return (
            <TableRow
              key={row.quoteId}
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
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  v{row.version}
                </Mono>
              </TableCell>
              <TableCell>
                <StatusLine tone={QUOTE_STATUS_TONES[row.status]}>{row.statusLabel}</StatusLine>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatUsd(row.totalUsd)}</TableCell>
              <TableCell className="whitespace-normal">
                <span
                  className={cn(
                    expiry.soon && "font-medium",
                    expiry.tone === "warning" && "text-warning",
                    expiry.tone === "destructive" && "text-destructive",
                  )}
                >
                  {expiry.words}
                </span>
              </TableCell>
              <TableCell className="whitespace-normal">
                {row.isCurrentRevision ? (
                  <span className="text-muted-foreground">Prices the submitted design</span>
                ) : (
                  <span className="text-warning">Design has moved on · a fresh quote is needed</span>
                )}
              </TableCell>
              <TableCell className={cn(!row.hasBenefit && "text-muted-foreground")}>
                {row.hasBenefit ? "Membership benefit carried" : "None"}
              </TableCell>
              <TableCell>
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {row.offeredAt !== null ? formatDate(row.offeredAt) : "Not yet"}
                </Mono>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
