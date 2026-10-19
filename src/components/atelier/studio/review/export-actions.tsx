"use client";

import { useQuery } from "convex/react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { FIT_ROUTE_LABELS, OCCASION_LABELS } from "@convex/shared/atelier/enums";
import { StatusLine } from "@/components/atelier/common/status-line";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { Button } from "@/components/ui/button";
import { downloadDesignJson, printDesign, stampExport, type ExportFacts } from "@/lib/atelier/export-design";
import { formatDate } from "@/lib/format";
import { ReviewBlockSkeleton } from "./review-skeleton";

/**
 * Download and print the design record (C12, C19). Both read `drafts.exportJson`, stamp the moment on
 * the client and work whether or not the design has been sent. The record is a design, not an order.
 */
export function ExportActions() {
  const { draft, draftId, ownerArgs } = useStudio();
  const record = useQuery(api.atelier.drafts.exportJson, { draftId, ...ownerArgs });

  if (record === undefined) return <ReviewBlockSkeleton lines={2} />;
  if (record === null) {
    return <StatusLine tone="warning">The record of this design is not available right now.</StatusLine>;
  }

  const facts: ExportFacts = {
    draftId,
    occasion: draft.occasion ? OCCASION_LABELS[draft.occasion] : null,
    eventDate: draft.eventDate !== undefined ? formatDate(draft.eventDate) : null,
    fitRoute: draft.fitRoute ? FIT_ROUTE_LABELS[draft.fitRoute] : null,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-none px-4"
          onClick={() => downloadDesignJson(stampExport(record, facts))}
        >
          <Download data-icon="inline-start" aria-hidden />
          Download JSON
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-none px-4"
          onClick={() => {
            if (!printDesign(stampExport(record, facts))) {
              toast.error("Could not open the print view. Download the record instead.");
            }
          }}
        >
          <Printer data-icon="inline-start" aria-hidden />
          Print
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Revision {record.revision}. The record lists every decision with its production id, the same lines the house
        reads. It is not an order, a quote or a booking.
      </p>
    </div>
  );
}
