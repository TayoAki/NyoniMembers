"use client";

import { useState } from "react";
import { CORRECTION_TONES, correctionTitle } from "@/components/atelier/aftercare/aftercare-words";
import { CorrectionDetail } from "@/components/atelier/aftercare/correction-detail";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDate } from "@/lib/format";
import type { CorrectionSummary } from "@convex/atelier/corrections";

/** One correction in the list: its words at a glance, the detail open for anything still in motion. */
export function CorrectionItem({ summary }: { summary: CorrectionSummary }) {
  const [open, setOpen] = useState(summary.open);
  return (
    <li id={`correction-${summary._id}`} className="scroll-mt-24 py-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-base font-medium">{correctionTitle(summary)}</h3>
            <StatusLine tone={CORRECTION_TONES[summary.status]}>{summary.statusLabel}</StatusLine>
            {summary.refundStateLabel ? (
              <p className="text-sm text-muted-foreground">{summary.refundStateLabel}</p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span>Requested {formatDate(summary.createdAt)}</span>
              <Mono upper={false}>{summary._id}</Mono>
            </p>
          </div>
          <CollapsibleTrigger render={<Button variant="outline" className="h-11 shrink-0 rounded-none px-4" />}>
            {open ? "Hide details" : "Show details"}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>{open ? <CorrectionDetail correctionId={summary._id} /> : null}</CollapsibleContent>
      </Collapsible>
    </li>
  );
}
