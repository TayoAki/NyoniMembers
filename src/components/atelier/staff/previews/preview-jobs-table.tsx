"use client";

import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatUsdPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StaffPreviewJobView } from "@convex/atelier/previews";
import { PHOTO_STATUS_LABELS, PREVIEW_QUALITY_LABELS } from "@convex/shared/atelier/enums";
import { OWNER_KIND_WORDS, PHOTO_STATUS_TONES, PREVIEW_QUALITY_TONES, PREVIEW_STATUS_TONES } from "./previews-words";
import { QualityDialog } from "./quality-dialog";
import { ResultDialog } from "./result-dialog";

/** A06: jobs as a dense table. The view names no client (a backend gap), so the owner is shown by kind and design id. */
export function PreviewJobsTable({ rows, className }: { rows: StaffPreviewJobView[]; className?: string }) {
  return (
    <Table className={cn("min-w-[72rem]", className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Owner</TableHead>
          <TableHead>Design</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attempt</TableHead>
          <TableHead>Created · finished</TableHead>
          <TableHead>Photograph</TableHead>
          <TableHead>Quality</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((job) => (
          <TableRow key={job.jobId} className="align-top">
            <TableCell className="whitespace-normal">
              <div className="flex flex-col gap-0.5">
                <span>{OWNER_KIND_WORDS[job.ownerKind]}</span>
                <Mono upper={false} className="text-[10px]">
                  {job.draftId}
                </Mono>
              </div>
            </TableCell>
            <TableCell className="max-w-[28ch] whitespace-normal">
              <div className="flex flex-col gap-0.5">
                <span>{job.specLabel}</span>
                <Mono upper={false} className="text-[10px]">
                  {job.revision !== null ? `revision ${job.revision} · ` : ""}
                  {job.specHash.slice(0, 12)}
                </Mono>
              </div>
            </TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex max-w-[24ch] flex-col gap-0.5">
                <StatusLine tone={PREVIEW_STATUS_TONES[job.status]}>{job.statusLabel}</StatusLine>
                {job.error ? <span className="text-xs text-destructive">{job.error}</span> : null}
                {job.cancelledAt !== null ? (
                  <span className="text-xs text-muted-foreground">Cancelled {formatDateTime(job.cancelledAt)}</span>
                ) : null}
                {job.expiresAt !== null && job.status === "done" ? (
                  <span className="text-xs text-muted-foreground">
                    Result kept until {formatDateTime(job.expiresAt)}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              <Mono upper={false} className="text-[11px] text-foreground/80">
                {job.attempt}
              </Mono>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-0.5">
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatDateTime(job.createdAt)}
                </Mono>
                <Mono upper={false} className="text-[11px] text-muted-foreground">
                  {job.completedAt !== null
                    ? formatDateTime(job.completedAt)
                    : job.startedAt !== null
                      ? `started ${formatDateTime(job.startedAt)}`
                      : "not started"}
                </Mono>
              </div>
            </TableCell>
            <TableCell className="whitespace-normal">
              <StatusLine tone={PHOTO_STATUS_TONES[job.photoStatus]}>{PHOTO_STATUS_LABELS[job.photoStatus]}</StatusLine>
            </TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex max-w-[22ch] flex-col gap-0.5">
                <StatusLine tone={PREVIEW_QUALITY_TONES[job.quality]}>{PREVIEW_QUALITY_LABELS[job.quality]}</StatusLine>
                {job.qualityNote ? <span className="text-xs text-muted-foreground">{job.qualityNote}</span> : null}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {job.costUsd !== null ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span>{formatUsdPrecise(job.costUsd)}</span>
                  {job.usage ? (
                    <Mono upper={false} className="text-[10px]">
                      {job.usage.inputImageTokens + job.usage.inputTextTokens} in · {job.usage.outputTokens} out
                    </Mono>
                  ) : null}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1">
                <QualityDialog job={job} />
                <ResultDialog job={job} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
