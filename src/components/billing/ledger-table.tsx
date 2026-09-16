"use client";

import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingRows } from "@/components/common/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLedger, LEDGER_PAGE_SIZE, type LedgerLine } from "@/hooks/use-billing";
import { formatCredits, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  plan_grant: "Plan credits",
  plan_reset: "Cycle reset",
  signup_bonus: "Welcome credits",
  topup: "Pack",
  reserve: "Used",
  refund: "Refund",
  admin: "Adjustment",
};

/** Credits arriving read as a badge with weight; credits leaving stay quiet. */
const INBOUND_KINDS = new Set(["plan_grant", "signup_bonus", "topup", "refund"]);

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

function LedgerRow({ line }: { line: LedgerLine }) {
  const positive = line.delta > 0;
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">{formatDateTime(line.createdAt)}</TableCell>
      <TableCell>
        <Badge variant={INBOUND_KINDS.has(line.kind) ? "secondary" : "outline"}>{kindLabel(line.kind)}</Badge>
      </TableCell>
      <TableCell className={cn("font-medium tabular-nums", positive ? "text-success" : "text-foreground")}>
        {formatCredits(line.delta, { signed: true })}
      </TableCell>
      <TableCell className="text-muted-foreground hidden capitalize sm:table-cell">{line.bucket}</TableCell>
      <TableCell className="text-muted-foreground hidden max-w-[22ch] truncate md:table-cell" title={line.note}>
        {line.note ?? "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(line.balanceAfter)}</TableCell>
    </TableRow>
  );
}

export function LedgerTable() {
  const { results, status, loadMore } = useLedger();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Credit ledger</CardTitle>
        <CardDescription>Every credit in and out, newest first. Refunds land here automatically.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {status === "LoadingFirstPage" ? (
          <LoadingRows count={6} className="px-(--card-spacing) py-2" />
        ) : results.length === 0 ? (
          <div className="px-(--card-spacing)">
            <EmptyState
              icon={Receipt}
              title="No credit activity yet"
              description="Extractions, renders, plan grants and top-ups all show up here the moment they happen."
              action={
                <Button variant="outline" size="sm" render={<a href="#packs" />}>
                  Buy a credit pack
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead className="hidden sm:table-cell">Bucket</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((line) => (
                  <LedgerRow key={line._id} line={line} />
                ))}
              </TableBody>
            </Table>
            {status !== "Exhausted" ? (
              <div className="flex justify-center px-(--card-spacing) pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={status === "LoadingMore"}
                  onClick={() => loadMore(LEDGER_PAGE_SIZE)}
                >
                  {status === "LoadingMore" ? <Spinner data-icon="inline-start" /> : null}
                  {status === "LoadingMore" ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
