"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { LoadingRows } from "@/components/common/loading-grid";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import { formatRelative, pluralize } from "@/lib/format";
import { UploadStatusBadge } from "./upload-status";

type RecentUploadsProps = {
  activeBatchId: string | null;
  onOpenBatch: (batchId: string) => void;
};

/** History below the drop zone: every photo you have sent through ingest, newest first. */
export function RecentUploads({ activeBatchId, onOpenBatch }: RecentUploadsProps) {
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.uploads.listRecent, isAuthenticated ? { limit: 12 } : "skip");

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Recent uploads</h2>
      {rows === undefined ? (
        <LoadingRows count={3} />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Photos you add show up here with their status.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map(({ upload }) => (
            <li key={upload._id} className="flex items-center gap-3 p-3">
              <ItemImage
                src={upload.url}
                alt={upload.fileName}
                variant="photo"
                aspect="aspect-square"
                className="size-10 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{upload.fileName}</p>
                <p className="text-muted-foreground text-xs">
                  {formatRelative(upload.createdAt)}
                  {upload.detectedCount !== undefined ? ` · ${pluralize(upload.detectedCount, "item")}` : ""}
                </p>
              </div>
              <UploadStatusBadge status={upload.status} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenBatch(upload.batchId)}
                disabled={upload.batchId === activeBatchId}
              >
                {upload.batchId === activeBatchId ? "Showing" : "Open"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
