"use client";

import { useMutation, useQuery } from "convex/react";
import { ListChecks, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingRows } from "@/components/common/loading-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCredits, formatRelative, titleCase } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { JobStatus } from "@convex/shared/jobs";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type JobRow = FunctionReturnType<typeof api.admin.recentJobs>[number];
type StatusFilter = NonNullable<FunctionArgs<typeof api.admin.recentJobs>["status"]>;

/** "all" plus every status the backend accepts, so a new status there breaks this list loudly. */
const FILTERS = ["all", "running", "failed", "partial"] as const satisfies readonly ("all" | StatusFilter)[];
type FilterValue = (typeof FILTERS)[number];

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "default",
  done: "secondary",
  partial: "outline",
  failed: "destructive",
  cancelled: "outline",
};

function reservedTotal(job: JobRow["job"]): number {
  return job.reservation.plan + job.reservation.pack;
}

function refundedTotal(job: JobRow["job"]): number {
  return job.refunds.plan + job.refunds.pack;
}

function RefundAction({ row }: { row: JobRow }) {
  const refundJob = useMutation(api.admin.refundJob);
  const [note, setNote] = useState("");
  const refundable = reservedTotal(row.job) - refundedTotal(row.job);

  async function handleRefund() {
    if (!note.trim()) throw new Error("Add a note so the refund has an audit trail.");
    const { refunded } = await refundJob({ jobId: row.job._id, note: note.trim() });
    setNote("");
    toast.success(`Refunded ${formatCredits(refunded)}.`);
  }

  if (refundable <= 0) return <span className="text-muted-foreground text-xs">Nothing left</span>;

  return (
    <ConfirmDialog
      destructive
      title="Refund this job?"
      description={`Returns up to ${formatCredits(refundable)} to the user, pack bucket first.`}
      confirmLabel="Refund"
      onConfirm={handleRefund}
      trigger={
        <Button variant="outline" size="xs">
          <Undo2 data-icon="inline-start" aria-hidden />
          Refund
        </Button>
      }
    >
      <Field>
        <FieldLabel htmlFor={`refund-note-${row.job._id}`}>Note</FieldLabel>
        <FieldDescription>Stored on the ledger line. Say why.</FieldDescription>
        <Input
          id={`refund-note-${row.job._id}`}
          value={note}
          placeholder="Upstream image API returned 500s"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </ConfirmDialog>
  );
}

export function JobsTable() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const rows = useQuery(api.admin.recentJobs, { ...(filter === "all" ? {} : { status: filter }), limit: 25 });

  return (
    <Card>
      <CardHeader className="gap-3 border-b sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <CardTitle>Recent jobs</CardTitle>
          <CardDescription>Newest first. Refunds go through the ledger, never the user document.</CardDescription>
        </div>
        <Select
          value={filter}
          onValueChange={(value) => {
            const next = FILTERS.find((option) => option === value);
            if (next) setFilter(next);
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Filter jobs by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all" ? "All statuses" : titleCase(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="px-0">
        {rows === undefined ? (
          <LoadingRows count={5} className="px-(--card-spacing) py-2" />
        ) : rows.length === 0 ? (
          <div className="px-(--card-spacing)">
            <EmptyState
              icon={ListChecks}
              title={filter === "all" ? "No jobs yet" : `No ${filter} jobs`}
              description={
                filter === "all"
                  ? "Ingest and render jobs appear here as soon as someone starts one."
                  : "Nothing matches this filter right now."
              }
              action={
                filter === "all" ? null : (
                  <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                    Show all jobs
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">User</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Refunded</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden lg:table-cell">Error</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.job._id}>
                  <TableCell className="font-medium">{titleCase(row.job.type)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.job.status]}>{titleCase(row.job.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[20ch] truncate sm:table-cell">
                    {row.userName ?? row.userEmail ?? "Unknown"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{reservedTotal(row.job)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {refundedTotal(row.job)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {formatRelative(row.job.createdAt)}
                  </TableCell>
                  <TableCell
                    className="text-destructive hidden max-w-[28ch] truncate lg:table-cell"
                    title={row.job.error}
                  >
                    {row.job.error ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RefundAction row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
