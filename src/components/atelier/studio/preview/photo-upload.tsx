"use client";

import { ImageOff } from "lucide-react";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { describeRejection, DropZone, type FileRejection } from "@/components/upload/drop-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { PhotoUploadState } from "@/hooks/atelier/use-person-photo";
import { formatBytes } from "@/lib/format";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { PHOTO_CONSENT } from "@convex/shared/atelier/policy";

type PhotoUploadProps = {
  upload: PhotoUploadState;
  /** True while a photograph already exists: the new one replaces it when accepted. */
  replacing: boolean;
  onChoose: (file: File) => void;
  onSend: () => void;
  /** Drops the local file and shows the drop zone again. */
  onRetake: () => void;
  /** Leaves the upload; removes the local file, touches nothing stored. */
  onCancel: () => void;
  onRejected: (message: string) => void;
};

const MAX_MB = Math.round(ATELIER_LIMITS.maxPhotoBytes / (1024 * 1024));
const HINT = `JPG, PNG or WebP · up to ${MAX_MB} MB · at least ${ATELIER_LIMITS.minPhotoEdgePx} px on each side`;

function describeDrop(rejection: FileRejection): string {
  const code = rejection.errors[0]?.code;
  if (code === "file-too-large")
    return `${rejection.file.name} is larger than ${MAX_MB} MB. A smaller export of the same photograph works.`;
  if (code === "file-invalid-type") return `${rejection.file.name} is not a JPEG, PNG or WebP photograph.`;
  return describeRejection(rejection);
}

/**
 * S11 (C08): one photograph in, previewed locally and sent only when asked. The house checks the stored
 * file; its reasons come back as retake guidance. Sending a photograph never starts a preview.
 */
export function PhotoUpload({ upload, replacing, onChoose, onSend, onRetake, onCancel, onRejected }: PhotoUploadProps) {
  const busy = upload.phase === "sending" || upload.phase === "checking" || upload.phase === "reading";
  const local = "local" in upload ? upload.local : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">
          {replacing ? "A new photograph" : "Your photograph"}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          Full length, head to shoes, standing straight, one person in frame. It stays on this device until you send it.
        </p>
      </div>

      {local === null ? (
        <div className="space-y-4">
          <DropZone
            onDrop={(accepted, rejections) => {
              for (const rejection of rejections) onRejected(describeDrop(rejection));
              const file = accepted[0];
              if (file) onChoose(file);
            }}
            disabled={busy}
            size="lg"
            title="A full-length photograph of you"
            description="Even light and a plain background help. Close-fitting clothes, or a shirt and trousers, show your shape best."
            buttonLabel={upload.phase === "reading" ? "Reading…" : "Choose a photograph"}
            hint={HINT}
            className="rounded-none"
          />
          {upload.phase === "reading" ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Spinner className="size-3.5" aria-hidden />
              Reading the photograph on this device…
            </p>
          ) : null}
          {upload.phase === "failed" ? (
            <ErrorAlert title="Could not read that photograph" message={upload.error.message} className="rounded-sm" />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <div className="space-y-2">
            <ItemImage
              src={local.url}
              alt="The photograph you chose, before sending"
              variant="render"
              aspect="aspect-[3/4]"
              className="w-full max-w-48 rounded-none bg-muted/40"
              priority
            />
            <p className="text-xs text-muted-foreground">
              <Mono>
                {local.width} × {local.height} px · {formatBytes(local.file.size)}
              </Mono>
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            {upload.phase === "chosen" ? (
              upload.guidance.length > 0 ? (
                <RetakeGuidance title="This photograph would not be accepted" reasons={upload.guidance} />
              ) : (
                <StatusLine tone="neutral">Not sent yet. Nothing leaves this device until you choose Send.</StatusLine>
              )
            ) : null}

            {upload.phase === "sending" ? (
              <Progress value={Math.round(upload.progress * 100)} className="rounded-none">
                <ProgressLabel>Sending your photograph</ProgressLabel>
                <ProgressValue />
              </Progress>
            ) : null}

            {upload.phase === "checking" ? (
              <p className="inline-flex items-center gap-2 text-sm" role="status" aria-live="polite">
                <Spinner className="size-3.5" aria-hidden />
                Checking the photograph…
              </p>
            ) : null}

            {upload.phase === "rejected" ? (
              <RetakeGuidance title="This photograph cannot be used" reasons={upload.reasons} />
            ) : null}

            {upload.phase === "failed" ? (
              <ErrorAlert title="Could not send the photograph" message={upload.error.message} className="rounded-sm" />
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {upload.phase === "chosen" && upload.guidance.length === 0 ? (
                <Button className="min-h-11 rounded-sm px-5" onClick={onSend}>
                  Send this photograph
                </Button>
              ) : null}
              {upload.phase === "failed" ? (
                <Button className="min-h-11 rounded-sm px-5" onClick={onSend}>
                  Try sending again
                </Button>
              ) : null}
              {upload.phase === "chosen" || upload.phase === "rejected" || upload.phase === "failed" ? (
                <Button variant="outline" className="min-h-11 rounded-sm" onClick={onRetake}>
                  {upload.phase === "chosen" && upload.guidance.length === 0 ? "Choose another" : "Retake"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/15 pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sending a photograph does not start a preview; you ask for that separately.
        </p>
        <Button variant="ghost" className="min-h-11 rounded-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The house's reasons, then what tends to work: the same list the client read before adding a photograph. */
function RetakeGuidance({ title, reasons }: { title: string; reasons: string[] }) {
  return (
    <Alert className="rounded-sm">
      <ImageOff />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4 text-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          Works well: {PHOTO_CONSENT.suitable.map((item) => item.toLowerCase()).join("; ")}.
        </p>
      </AlertDescription>
    </Alert>
  );
}
