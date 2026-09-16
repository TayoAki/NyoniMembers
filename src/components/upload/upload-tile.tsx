"use client";

import { Coins, RotateCw } from "lucide-react";
import Link from "next/link";
import { CreditQuote } from "@/components/common/credit-quote";
import { ItemImage } from "@/components/common/item-image";
import { JobStepper } from "@/components/common/job-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { Item } from "@/hooks/use-items";
import { useCreditQuote } from "@/hooks/use-credits";
import { formatBytes, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import { UploadStatusBadge, type UploadRow } from "./upload-status";

type UploadTileProps = {
  row: UploadRow;
  items: readonly Item[];
  onResume: (uploadId: Id<"uploads">) => void;
  resuming: boolean;
};

/** One photo in the batch: its job, what was found in it and the cutouts as they land. */
export function UploadTile({ row, items, onResume, resuming }: UploadTileProps) {
  const { upload, job } = row;
  const detected = upload.detectedCount;
  const quote = useCreditQuote(detected && detected > 0 ? { kind: "extract", items: detected } : null);
  const blocked = items.filter((item) => item.status === "needsCredits");
  const stillCosts = upload.status !== "done" && upload.status !== "failed";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ItemImage
            src={upload.url}
            alt={upload.fileName}
            variant="photo"
            aspect="aspect-square"
            className="size-12 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm">{upload.fileName}</CardTitle>
            <p className="text-muted-foreground text-xs">{formatBytes(upload.sizeBytes)}</p>
          </div>
          <UploadStatusBadge status={upload.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {job ? <JobStepper job={job} /> : <p className="text-muted-foreground text-sm">Waiting for a slot…</p>}

        {detected !== undefined ? (
          <p className="text-sm">
            {detected === 0 ? (
              <span className="text-muted-foreground">No clothes found in this photo.</span>
            ) : (
              <>
                Found <span className="font-medium tabular-nums">{pluralize(detected, "item")}</span>
              </>
            )}
          </p>
        ) : null}

        {detected !== undefined && detected > 0 && stillCosts ? (
          <CreditQuote quote={quote} label={pluralize(detected, "cutout")} />
        ) : null}

        {items.length > 0 ? (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {items.map((item) => (
              <li key={item._id}>
                <ItemCutout item={item} />
              </li>
            ))}
          </ul>
        ) : null}

        {blocked.length > 0 ? (
          <div className="border-credit/40 bg-credit/5 flex flex-col gap-2 rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm">
              <Coins className="text-credit size-4 shrink-0" aria-hidden />
              {pluralize(blocked.length, "item")} paused — you ran out of credits mid-extraction.
            </p>
            <Button size="sm" className="w-fit" onClick={() => onResume(upload._id)} disabled={resuming}>
              {resuming ? <Spinner data-icon="inline-start" /> : <RotateCw data-icon="inline-start" />}
              Resume extraction
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ItemCutout({ item }: { item: Item }) {
  const paused = item.status === "needsCredits";
  const failed = item.status === "failed";
  const extracting = item.status === "extracting";

  const tile = (
    <>
      <ItemImage
        src={item.url}
        alt={item.name}
        aspect="aspect-square"
        className={cn(
          "rounded-lg p-1.5 ring-1 transition-colors",
          paused ? "ring-credit/50" : failed ? "ring-destructive/50" : "group-hover/cutout:ring-ring ring-transparent",
        )}
      />
      <span className="text-muted-foreground mt-1 block truncate text-[11px]">{item.name}</span>
    </>
  );

  if (paused || failed || extracting) {
    return (
      <div className="group/cutout block" title={item.name}>
        {tile}
        <Badge variant={failed ? "destructive" : "outline"} className="mt-1 h-4 px-1.5 text-[10px]">
          {failed ? "Failed" : paused ? "Needs credits" : "Extracting"}
        </Badge>
      </div>
    );
  }

  return (
    <Link
      href={routes.item(item._id)}
      className="group/cutout focus-visible:ring-ring block rounded-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      {tile}
    </Link>
  );
}
