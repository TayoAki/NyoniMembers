"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ImagePlus, ScanSearch, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUploadItems } from "@/hooks/use-items";
import { isUploadSuccess, useUpload } from "@/hooks/use-upload";
import { toClientError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { LIMITS } from "@convex/shared/credits";
import { describeRejection, DropZone, type FileRejection } from "./drop-zone";
import { PendingTile, type PendingFile } from "./pending-tile";
import { RecentUploads } from "./recent-uploads";
import { UploadTile } from "./upload-tile";

const HOW_IT_WORKS = [
  { icon: ImagePlus, title: "Drop your photos", body: "A rail, a flat lay or a full outfit — up to 50 at a time." },
  {
    icon: ScanSearch,
    title: "We find every item",
    body: "Detection and tagging are free. You see what was found first.",
  },
  {
    icon: Sparkles,
    title: "Cutouts land in your wardrobe",
    body: "One credit per item cut out, tagged and ready to style.",
  },
] as const;

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Some browsers report an empty `type` for drag-dropped files, so fall back to the extension. */
function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[extension] ?? "application/octet-stream";
}

export function AddClothes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch");

  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.uploads.listBatch, isAuthenticated && batchId ? { batchId } : "skip");
  const { byUpload } = useUploadItems(Boolean(batchId));
  const createBatch = useMutation(api.uploads.createBatch);
  const resumeUpload = useMutation(api.uploads.resume);
  const { uploadMany, progress } = useUpload("items");

  const [pending, setPending] = useState<PendingFile[]>([]);
  /** The batch the current local tiles turned into, once `createBatch` has answered. */
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resuming, setResuming] = useState<Id<"uploads"> | null>(null);
  const previewUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current = [];
    },
    [],
  );

  function goToBatch(id: string) {
    router.replace(`${routes.add}?batch=${encodeURIComponent(id)}`);
  }

  /** Opening an older batch drops the local tiles; they belong to a different upload. */
  function openBatchFromHistory(id: string) {
    setPending([]);
    setPendingBatchId(null);
    goToBatch(id);
  }

  async function handleDrop(accepted: File[], rejections: FileRejection[]) {
    for (const rejection of rejections) toast.error(describeRejection(rejection));
    if (accepted.length === 0) return;

    const files = accepted.slice(0, LIMITS.maxPhotosPerUpload);
    if (accepted.length > files.length) {
      toast.warning(`Only the first ${pluralize(LIMITS.maxPhotosPerUpload, "photo")} were taken from this drop.`);
    }

    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    const stamp = Date.now();
    const entries = files.map((file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    previewUrls.current = entries.map((entry) => entry.previewUrl);
    setPending(
      entries.map(({ key, file, previewUrl }) => ({ key, name: file.name, sizeBytes: file.size, previewUrl })),
    );
    setPendingBatchId(null);
    setBusy(true);

    try {
      const results = await uploadMany(
        entries.map(({ key, file }) => ({ key, file })),
        4,
      );

      for (const result of results) {
        if (result.error) toast.error(`${result.file.name}: ${result.error}`);
      }
      setPending((current) =>
        current.map((file) => {
          const result = results.find((entry) => entry.key === file.key);
          return result?.error ? { ...file, error: result.error } : file;
        }),
      );

      const uploaded = results.filter(isUploadSuccess);
      if (uploaded.length === 0) {
        toast.error("Nothing uploaded. Check your connection and try again.");
        return;
      }

      const batch = await createBatch({
        files: uploaded.map(({ file, storageId }) => ({
          storageId,
          fileName: file.name,
          mimeType: mimeTypeOf(file),
          sizeBytes: file.size,
        })),
      });
      setPendingBatchId(batch.batchId);
      goToBatch(batch.batchId);
    } catch (caught) {
      toast.error(toClientError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResume(uploadId: Id<"uploads">) {
    setResuming(uploadId);
    try {
      await resumeUpload({ uploadId });
      toast.success("Extraction restarted.");
    } catch (caught) {
      const error = toClientError(caught);
      toast.error(error.message, {
        action:
          error.code === "INSUFFICIENT_CREDITS"
            ? { label: "Top up", onClick: () => router.push(routes.billing) }
            : undefined,
      });
    } finally {
      setResuming(null);
    }
  }

  // Local tiles hand over to the server rows the moment this batch's rows arrive, so nothing flashes empty.
  const handedOver = pendingBatchId !== null && batchId === pendingBatchId && rows !== undefined && rows.length > 0;
  const showPending = pending.length > 0 && !handedOver;
  const showBatch = Boolean(batchId) && !showPending;
  const showEmpty = !showPending && !batchId;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader
        title="Add clothes"
        description="Photograph what you own. Every item is cut out, tagged and dropped into your wardrobe."
        actions={
          <Button variant="outline" render={<Link href={routes.wardrobe} />}>
            Go to wardrobe
          </Button>
        }
      />

      <DropZone
        onDrop={handleDrop}
        multiple
        maxFiles={LIMITS.maxPhotosPerUpload}
        disabled={busy}
        size="lg"
        title="Drop photos of your clothes"
        description={`Up to ${LIMITS.maxPhotosPerUpload} at a time. One photo can contain several garments — we will find them all.`}
        buttonLabel={busy ? "Uploading…" : "Choose photos"}
      />

      {showPending ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Uploading {pluralize(pending.length, "photo")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((file) => (
              <PendingTile key={file.key} file={file} progress={progress[file.key] ?? 0} />
            ))}
          </div>
        </section>
      ) : null}

      {showBatch ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">This batch</h2>
          {rows === undefined ? (
            <BatchSkeleton />
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">That batch is no longer available.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <UploadTile
                  key={row.upload._id}
                  row={row}
                  items={byUpload.get(row.upload._id) ?? []}
                  onResume={handleResume}
                  resuming={resuming === row.upload._id}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showEmpty ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing uploaded yet"
          description="Three steps from a pile of photos to a wardrobe you can style."
          action={
            <ol className="w-full space-y-3 text-left">
              {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex gap-3">
                  <span
                    className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-3.5" aria-hidden />
                      {title}
                    </p>
                    <p className="text-muted-foreground text-sm">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          }
          className="min-h-0 py-10"
        />
      ) : null}

      <RecentUploads activeBatchId={batchId} onOpenBatch={openBatchFromHistory} />
    </div>
  );
}

function BatchSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading batch">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="ring-foreground/10 space-y-4 rounded-xl p-4 ring-1">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
