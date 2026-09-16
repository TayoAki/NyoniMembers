"use client";

import { AlertCircle, Check, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type UploadRow = FunctionReturnType<typeof api.uploads.listBatch>[number];
export type UploadDoc = UploadRow["upload"];
export type UploadStatus = UploadDoc["status"];

const LABELS: Record<UploadStatus, string> = {
  queued: "Queued",
  detecting: "Detecting",
  extracting: "Extracting",
  done: "Ready",
  partial: "Partly done",
  failed: "Failed",
};

/** One compact badge for a photo's ingest state, used on the tiles and in recent uploads. */
export function UploadStatusBadge({ status }: { status: UploadStatus }) {
  const label = LABELS[status];
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <AlertCircle aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === "done") {
    return (
      <Badge variant="secondary" className="text-foreground">
        <Check className="text-success" aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="outline">
        <CircleDashed className="text-warning" aria-hidden />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-foreground">
      <Spinner className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
