"use client";

import type { PersonPhotoView } from "@convex/atelier/photos";
import type { PreviewJobView } from "@convex/atelier/previews";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ItemImage } from "@/components/common/item-image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/lib/format";

export const PREVIEW_CAPTION = "Illustrative preview — not a fitting";
export const STALE_WORDS = "Shows a previous design";

export type ResultView = "original" | "studio" | "personal";
const VIEWS: readonly ResultView[] = ["original", "studio", "personal"];
const VIEW_LABELS: Record<ResultView, string> = { original: "Original", studio: "Studio", personal: "Personal" };

function isResultView(value: unknown): value is ResultView {
  return typeof value === "string" && (VIEWS as readonly string[]).includes(value);
}

type ResultControlsProps = {
  job: PreviewJobView;
  photo: PersonPhotoView;
  view: ResultView;
  onView: (view: ResultView) => void;
  onReview: () => void;
  /** A new preview of the design as it stands now (C10 "Update my preview"). */
  onUpdate: () => void;
  /** Another attempt on the same frozen design (previews.retry). */
  onRetry: () => void;
  /** Returns the stage to the studio illustration. */
  onKeepStudio: () => void;
  busy: boolean;
};

/**
 * S13 (C09–C11): the finished, stale, failed, cancelled and expired states of the current preview, each
 * in its own words, with the garment lines of the exact revision it was made from. The image on the
 * stage is the core's; this panel chooses what the stage shows and never claims more than the job does.
 */
export function ResultControls({
  job,
  photo,
  view,
  onView,
  onReview,
  onUpdate,
  onRetry,
  onKeepStudio,
  busy,
}: ResultControlsProps) {
  const lines = (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(7rem,11rem)_1fr]">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground">Design shown</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>{job.specLabel}</span>
        {job.revision !== null ? <Mono>Revision {job.revision}</Mono> : null}
        <Button variant="link" size="xs" className="h-auto min-h-6 px-0" onClick={onReview}>
          Every line, in Review
        </Button>
      </dd>
    </dl>
  );

  if (job.status === "done" && job.resultUrl) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <StatusLine live tone="success">
            {job.statusLabel}
          </StatusLine>
          <span className="text-xs font-medium">{PREVIEW_CAPTION}</span>
        </div>

        {!job.isCurrent ? (
          <Alert className="rounded-sm" role="status">
            <AlertTitle>{STALE_WORDS}</AlertTitle>
            <AlertDescription className="gap-3">
              <p>
                Your design has changed since this preview was made. It still shows the design as it was then; you can
                keep looking at it, or ask for one of the design as it stands now.
              </p>
              <Button size="sm" className="w-fit rounded-sm" onClick={onUpdate} disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" aria-hidden /> : null}
                Update my preview
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <ToggleGroup
            aria-label="What to look at"
            variant="outline"
            spacing={0}
            value={[view]}
            onValueChange={(values) => {
              const next = values[0];
              if (isResultView(next)) onView(next);
            }}
          >
            {VIEWS.map((option) => (
              <ToggleGroupItem key={option} value={option} className="h-11 min-w-20 rounded-none px-3 text-[13px]">
                {VIEW_LABELS[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {view === "original"
              ? "Your photograph as you added it, below."
              : view === "studio"
                ? "The stage shows the studio illustration of the design as it stands now."
                : `The stage shows the preview. ${PREVIEW_CAPTION}.`}
          </p>
          {view === "original" ? (
            <ItemImage
              src={photo.url}
              alt="Your photograph, as you added it"
              variant="render"
              aspect="aspect-[3/4]"
              className="w-full max-w-56 rounded-none bg-muted/40"
            />
          ) : null}
        </div>

        {lines}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {job.expiresAt !== null
            ? `This image is kept until ${formatDate(job.expiresAt)}; the design it shows stays with your draft.`
            : `Images are kept for ${ATELIER_LIMITS.previewResultDays} days; the design stays with your draft.`}
        </p>
      </div>
    );
  }

  if (job.status === "done") {
    return (
      <div className="space-y-4">
        <StatusLine live tone="warning">
          Set aside by the house
        </StatusLine>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          This preview was finished, but the house&apos;s preview review did not accept its quality, so it is not shown.
          Your photograph and design are unchanged; you can ask for another.
        </p>
        {lines}
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11 rounded-sm px-5" onClick={onUpdate} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" aria-hidden /> : null}
            Make another preview
          </Button>
          <Button variant="ghost" className="min-h-11 rounded-sm" onClick={onKeepStudio}>
            Keep the studio illustration
          </Button>
        </div>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="space-y-4">
        <StatusLine live tone="destructive">
          {job.statusLabel}
        </StatusLine>
        <p className="max-w-xl text-sm leading-relaxed text-pretty">
          {job.error ?? "The preview could not be finished."} Your photograph and your design are unchanged.
        </p>
        {lines}
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11 rounded-sm px-5" onClick={onRetry} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" aria-hidden /> : null}
            Try again
          </Button>
          <Button variant="ghost" className="min-h-11 rounded-sm" onClick={onKeepStudio}>
            Keep the studio illustration
          </Button>
        </div>
      </div>
    );
  }

  if (job.status === "cancelled") {
    return (
      <div className="space-y-4">
        <StatusLine live tone="neutral">
          {job.statusLabel}
        </StatusLine>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {job.error ?? "This preview was cancelled before it finished."} Nothing from it is shown. Your photograph and
          your design are unchanged.
        </p>
        {lines}
        <Button className="min-h-11 rounded-sm px-5" onClick={onUpdate} disabled={busy}>
          {busy ? <Spinner data-icon="inline-start" aria-hidden /> : null}
          Make my preview
        </Button>
      </div>
    );
  }

  // expired
  return (
    <div className="space-y-4">
      <StatusLine live tone="neutral">
        {job.statusLabel}
      </StatusLine>
      <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
        The image for this preview has reached the end of its {ATELIER_LIMITS.previewResultDays} days and is gone, or
        the photograph it was made from was removed. The design it showed is kept with your draft.
      </p>
      {lines}
      <Button className="min-h-11 rounded-sm px-5" onClick={onUpdate} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" aria-hidden /> : null}
        Make a new preview
      </Button>
    </div>
  );
}
