"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffPreviewJobView } from "@convex/atelier/previews";

/**
 * The audited look at a client's result (O06). The URL comes from a mutation that writes `photo.view`
 * to the audit log; the button says so before it is pressed, and nothing is fetched until it is.
 */
export function ResultDialog({ job }: { job: StaffPreviewJobView }) {
  const viewResult = useMutation(api.atelier.previews.viewResult);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const available = job.status === "done" && job.hasResult;

  async function reveal() {
    setError(null);
    setUrl(undefined);
    try {
      const result = await viewResult({ jobId: job.jobId });
      setUrl(result.url);
    } catch (caught) {
      setError(reportError(caught).message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void reveal();
        else setUrl(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={!available}
            title={available ? "Recorded in the audit log" : "No result to view"}
          />
        }
      >
        View result · recorded
      </DialogTrigger>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preview result</DialogTitle>
          <DialogDescription>
            Illustrative preview — not a fitting. “{job.specLabel}”, attempt {job.attempt}. This look has been written
            to the audit log under your name (photo.view).
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <ErrorAlert title="The result did not open" message={error} onRetry={() => void reveal()} />
        ) : url === undefined ? (
          <div className="flex aspect-[2/3] items-center justify-center rounded-sm bg-muted" aria-busy="true">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Recording the look and fetching the result…
            </span>
          </div>
        ) : url === null ? (
          <p className="text-sm text-muted-foreground">
            The result file is gone: it expired or the client removed their photograph.
          </p>
        ) : (
          <ItemImage src={url} alt={`Preview result for ${job.specLabel}`} variant="render" className="rounded-sm" />
        )}
      </DialogContent>
    </Dialog>
  );
}
