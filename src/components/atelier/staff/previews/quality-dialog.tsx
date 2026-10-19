"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffPreviewJobView } from "@convex/atelier/previews";
import { PREVIEW_QUALITY_LABELS, type PreviewQuality } from "@convex/shared/atelier/enums";

const CHOICES: readonly Exclude<PreviewQuality, "pending">[] = ["accepted", "rejected"];

const CHOICE_EFFECT: Record<Exclude<PreviewQuality, "pending">, string> = {
  accepted: "The result stays visible to the client as their preview.",
  rejected: "The result is no longer shown to the client; their design and the studio illustration are unchanged.",
};

/**
 * O06 step 2: judge a finished result. Only a finished job can be flagged. What each outcome does for the
 * client is shown; only a result set aside carries a word the client reads.
 */
export function QualityDialog({ job }: { job: StaffPreviewJobView }) {
  const flagQuality = useMutation(api.atelier.previews.flagQuality);
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState<Exclude<PreviewQuality, "pending"> | null>(
    job.quality === "pending" ? null : job.quality,
  );
  const [note, setNote] = useState(job.qualityNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = quality !== null && (quality === "accepted" || note.trim().length > 0);

  async function submit() {
    if (!quality) return;
    setPending(true);
    setError(null);
    try {
      await flagQuality({ jobId: job.jobId, quality, note: note.trim() });
      toast.success(
        quality === "rejected"
          ? `Flagged. The client reads “${PREVIEW_QUALITY_LABELS.rejected}”.`
          : `Flagged. ${CHOICE_EFFECT.accepted}`,
      );
      setOpen(false);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8" disabled={job.status !== "done"} />}>
        {job.quality === "pending" ? "Flag quality" : "Change flag"}
      </DialogTrigger>
      <DialogContent className="rounded-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quality of this result</DialogTitle>
          <DialogDescription>
            Attempt {job.attempt} on “{job.specLabel}”. Identity, body or construction failures are never disguised as
            success: set them aside.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={quality}
          onValueChange={(value) => setQuality(value as Exclude<PreviewQuality, "pending">)}
          aria-label="Quality"
          className="gap-3"
        >
          {CHOICES.map((choice) => (
            <div key={choice} className="flex items-start gap-3">
              <RadioGroupItem id={`quality-${job.jobId}-${choice}`} value={choice} className="mt-1" />
              <Label htmlFor={`quality-${job.jobId}-${choice}`} className="flex flex-col gap-0.5 text-sm font-normal">
                <span className="font-medium">{PREVIEW_QUALITY_LABELS[choice]}</span>
                <span className="text-xs text-muted-foreground">{CHOICE_EFFECT[choice]}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Field>
          <FieldLabel htmlFor={`quality-note-${job.jobId}`}>Note</FieldLabel>
          <FieldDescription>
            {quality === "rejected"
              ? "Required when setting a result aside: what failed. Kept for operations, not shown to the client."
              : "Optional. Kept for operations, not shown to the client."}
          </FieldDescription>
          <Textarea
            id={`quality-note-${job.jobId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="rounded-sm"
          />
        </Field>
        {error ? <ErrorAlert title="The flag was not saved" message={error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pending || !ready}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Save flag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
