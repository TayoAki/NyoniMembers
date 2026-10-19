"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PreviewJobView } from "@convex/atelier/previews";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ClientError } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";

export const WAIT_GUIDANCE =
  "Usually a minute or two. You can keep designing; the studio illustration shows every choice meanwhile.";

/**
 * S12 (C09): a preview being made. The words are the job's own status label; there is no percentage
 * and no countdown because neither would be true. Cancel is real and stops a late result becoming current.
 */
export function JobStatus({
  job,
  cancelling,
  onCancel,
}: {
  job: PreviewJobView;
  cancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <StatusLine live tone="gold">
        {job.statusLabel}
      </StatusLine>
      <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">{WAIT_GUIDANCE}</p>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(7rem,11rem)_1fr]">
        <dt className="text-xs font-medium tracking-wide text-muted-foreground">Design</dt>
        <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>{job.specLabel}</span>
          {job.revision !== null ? <Mono>Revision {job.revision}</Mono> : null}
        </dd>
        <dt className="text-xs font-medium tracking-wide text-muted-foreground">Asked for</dt>
        <dd>
          {formatRelative(job.createdAt)}
          {job.attempt > 1 ? <span className="text-muted-foreground"> · attempt {job.attempt}</span> : null}
        </dd>
      </dl>
      <Button variant="outline" className="min-h-11 rounded-sm" onClick={onCancel} disabled={cancelling}>
        {cancelling ? <Spinner data-icon="inline-start" aria-hidden /> : null}
        Cancel this preview
      </Button>
    </div>
  );
}

export type StartBlocker = { reason: string; action?: { label: string; onClick: () => void } };

type StartPreviewProps = {
  label?: string;
  description?: string;
  starting: boolean;
  /** Why the preview cannot be asked for right now; the button is disabled and the reason shown. */
  blocker: StartBlocker | null;
  failure: ClientError | null;
  onStart: () => void;
  onContinue: () => void;
};

/**
 * The one action that starts a preview, and the truthful states when it cannot: previews switched off
 * on this deployment, the day's budget spent, no cloth yet. The design is never touched by any of them.
 */
export function StartPreview({
  label = "Make my preview",
  description = "The house freezes this design as it stands and dresses your photograph in it.",
  starting,
  blocker,
  failure,
  onStart,
  onContinue,
}: StartPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button className="min-h-11 rounded-sm px-5" onClick={onStart} disabled={starting || blocker !== null}>
          {starting ? <Spinner data-icon="inline-start" aria-hidden /> : null}
          {starting ? "Asking the house…" : label}
        </Button>
        {blocker?.action ? (
          <Button variant="outline" className="min-h-11 rounded-sm" onClick={blocker.action.onClick}>
            {blocker.action.label}
          </Button>
        ) : null}
      </div>
      {blocker ? (
        <BlockerNote blocker={blocker} withAction={false} />
      ) : (
        <p className="max-w-xl text-xs leading-relaxed text-pretty text-muted-foreground">
          {description} Up to {ATELIER_LIMITS.previewsPerDay} previews a day.
        </p>
      )}
      {failure ? <StartFailure failure={failure} onRetry={onStart} onContinue={onContinue} /> : null}
    </div>
  );
}

/** Why a preview cannot be asked for right now, with the one action that clears it. */
export function BlockerNote({ blocker, withAction = true }: { blocker: StartBlocker; withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-sm leading-relaxed text-pretty">{blocker.reason}</p>
      {withAction && blocker.action ? (
        <Button variant="outline" className="min-h-11 shrink-0 rounded-sm" onClick={blocker.action.onClick}>
          {blocker.action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** What went wrong when a preview was asked for, in the house's words, with the way out that is true. */
export function StartFailure({
  failure,
  onRetry,
  onContinue,
}: {
  failure: ClientError;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const pathname = usePathname();
  switch (failure.code) {
    case "PREVIEWS_UNAVAILABLE":
      return (
        <Alert className="rounded-sm" role="status">
          <AlertTitle>Personal previews are not available right now.</AlertTitle>
          <AlertDescription className="gap-3">
            <p>Your design is unchanged; the studio illustration still shows every choice.</p>
            <p>Your photograph is kept under the terms you read, and you can remove it below at any time.</p>
            <Button variant="outline" size="sm" className="w-fit rounded-sm" onClick={onContinue}>
              Continue with the studio illustration
            </Button>
          </AlertDescription>
        </Alert>
      );
    case "DAILY_CAP_REACHED":
    case "RATE_LIMITED":
      return (
        <Alert className="rounded-sm" role="status">
          <AlertTitle>The day&apos;s previews are used</AlertTitle>
          <AlertDescription className="gap-3">
            <p>{failure.message}</p>
            <Button variant="outline" size="sm" className="w-fit rounded-sm" onClick={onContinue}>
              Continue with the studio illustration
            </Button>
          </AlertDescription>
        </Alert>
      );
    case "INVALID_INPUT":
    case "INVALID_STATE":
      if (failure.details?.linkRequired === true) {
        return (
          <ErrorAlert
            title="Could not start the preview"
            message={
              <>
                {failure.message}{" "}
                <Link href={routes.atelier.link} className="underline underline-offset-4">
                  Save to my account
                </Link>
              </>
            }
            className="rounded-sm"
          />
        );
      }
      return <ErrorAlert title="Could not start the preview" message={failure.message} className="rounded-sm" />;
    case "UNAUTHENTICATED":
      return (
        <ErrorAlert
          title="Could not start the preview"
          message={
            <>
              {failure.message}{" "}
              <Link
                href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                className="underline underline-offset-4"
              >
                Sign in
              </Link>{" "}
              and your design will be here.
            </>
          }
          className="rounded-sm"
        />
      );
    default:
      return (
        <ErrorAlert
          title="Could not start the preview"
          message={failure.message}
          onRetry={onRetry}
          className="rounded-sm"
        />
      );
  }
}
