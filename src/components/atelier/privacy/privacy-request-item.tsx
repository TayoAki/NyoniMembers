"use client";

import { useQuery } from "convex/react";
import { AlertCircle, Check, Circle, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { PrivacyRows } from "@/components/atelier/privacy/privacy-skeleton";
import { PRIVACY_TONES, STEP_TONES, STEP_WORDS } from "@/components/atelier/privacy/privacy-words";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { PrivacyRequestSummary, PrivacyStepView } from "@convex/atelier/privacy";
import type { PrivacyStepStatus } from "@convex/shared/atelier/enums";

type OwnerArgs = { guestKey?: string } | "skip";

const STEP_ICONS: Record<PrivacyStepStatus, typeof Check> = {
  pending: Circle,
  done: Check,
  failed: AlertCircle,
  exception: Minus,
};

/**
 * One privacy request: its truthful status, then the steps as a checklist with what each one actually
 * did and when, the exceptions the house disclosed, the export file once written, and the case record.
 */
export function PrivacyRequestItem({
  summary,
  ownerArgs,
  focused,
}: {
  summary: PrivacyRequestSummary;
  ownerArgs: OwnerArgs;
  focused: boolean;
}) {
  const view = useQuery(
    api.atelier.privacy.get,
    ownerArgs === "skip" ? "skip" : { ...ownerArgs, requestId: summary._id },
  );
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!focused || !ref.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [focused]);

  const status = view ?? summary;

  return (
    <li
      ref={ref}
      id={`privacy-request-${summary._id}`}
      className={cn("scroll-mt-24 space-y-4 py-5", focused && "border-l-2 border-primary pl-4")}
      aria-labelledby={`privacy-request-${summary._id}-title`}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 id={`privacy-request-${summary._id}-title`} className="text-base font-medium">
            {summary.kindLabel}
          </h3>
          <Mono upper={false}>{summary._id}</Mono>
        </div>
        <StatusLine tone={PRIVACY_TONES[status.status]} live className="text-sm">
          {status.statusLabel}
        </StatusLine>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Requested {formatDateTime(summary.requestedAt)}</span>
          {status.completedAt ? <span>Completed {formatDateTime(status.completedAt)}</span> : null}
        </p>
      </div>

      {view === undefined ? (
        <PrivacyRows count={Math.max(1, summary.pendingSteps + summary.failedSteps)} />
      ) : view === null ? (
        <p className="text-sm text-muted-foreground">
          This request&rsquo;s steps could not be read. Its status above is the house&rsquo;s current record.
        </p>
      ) : (
        <>
          <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Steps">
            {view.steps.map((step) => (
              <StepRow key={step.key} step={step} />
            ))}
          </ol>
          {view.hasFailedStep ? (
            <StatusLine tone="warning">A step did not complete; a privacy staff member re-runs it.</StatusLine>
          ) : null}
          {view.exceptions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                What the house keeps
              </h4>
              <ul className="max-w-2xl list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {view.exceptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.exportUrl || view.caseId ? (
            <div className="flex flex-wrap items-center gap-3">
              {view.exportUrl ? (
                <Button
                  className="h-11 rounded-none px-5"
                  render={<a href={view.exportUrl} download={`nyoni-atelier-export-${summary._id}.json`} />}
                  nativeButton={false}
                >
                  Download your export
                </Button>
              ) : null}
              {view.caseId ? (
                <Link
                  href={routes.atelier.request(view.caseId)}
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
                >
                  Open the request record
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}

function StepRow({ step }: { step: PrivacyStepView }) {
  const Icon = STEP_ICONS[step.status];
  return (
    <li className="grid grid-cols-[1.25rem_1fr] gap-x-4 gap-y-1 py-3 sm:grid-cols-[1.25rem_1fr_auto] sm:items-start">
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4",
          step.status === "done" && "text-success",
          step.status === "pending" && "text-muted-foreground",
          (step.status === "failed" || step.status === "exception") && "text-warning",
        )}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm">{step.label}</p>
        <StatusLine tone={STEP_TONES[step.status]}>{STEP_WORDS[step.status]}</StatusLine>
        {step.note ? <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{step.note}</p> : null}
      </div>
      {step.at ? (
        <Mono upper={false} className="col-start-2 sm:col-start-3 sm:pt-1">
          {formatDateTime(step.at)}
        </Mono>
      ) : null}
    </li>
  );
}
