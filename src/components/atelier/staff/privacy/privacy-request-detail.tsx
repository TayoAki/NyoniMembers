"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { formatDateTime, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffPrivacyRequestView } from "@convex/atelier/privacy";
import { PRIVACY_STATUS_LABELS, PRIVACY_STEP_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { PRIVACY_STATUS_TONES, STEP_STATUS_TONES } from "./privacy-words";

/** O08 steps 2–3: one request's steps as they really stand, with re-run, complete and reject. */
export function PrivacyRequestDetail({ requestId }: { requestId: Id<"atelierPrivacyRequests"> }) {
  const request = useQuery(api.atelier.privacy.staffGet, { requestId });
  if (request === undefined) return <LoadingRows count={5} />;
  return <PrivacyRequestDetailView request={request} />;
}

export function PrivacyRequestDetailView({ request }: { request: StaffPrivacyRequestView }) {
  const unsettled = request.steps.filter((step) => step.status === "pending" || step.status === "failed");
  const awaiting = unsettled.find((step) => step.awaitsStaff) ?? null;
  const blocking = unsettled.filter((step) => !step.awaitsStaff);
  const terminal = request.status === "completed" || request.status === "rejected";
  return (
    <div className="space-y-6">
      <OrderBook>
        <OrderBookRow
          label="Request"
          value={request.kindLabel}
          code={request.kind}
          note={`Requested ${formatDateTime(request.requestedAt)}.`}
        />
        <OrderBookRow
          label="Status"
          value={<StatusLine tone={PRIVACY_STATUS_TONES[request.status]}>{request.statusLabel}</StatusLine>}
          note={
            request.completedAt !== null
              ? `${formatDateTime(request.completedAt)}. The client reads the same words.`
              : "A reading of the steps, never a promise; the client reads the same words."
          }
        />
        <OrderBookRow
          label="Steps"
          value={
            <ol className="flex flex-col gap-1.5">
              {request.steps.map((step) => (
                <li key={step.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <StatusLine tone={STEP_STATUS_TONES[step.status]}>
                    {PRIVACY_STEP_STATUS_LABELS[step.status]}
                  </StatusLine>
                  <span>{step.label}</span>
                  {step.awaitsStaff ? <span className="text-xs font-medium">Yours to record</span> : null}
                  {step.at !== null ? (
                    <Mono upper={false} className="text-[10px]">
                      {formatDateTime(step.at)}
                    </Mono>
                  ) : null}
                  {step.note ? <span className="basis-full text-xs text-muted-foreground">{step.note}</span> : null}
                </li>
              ))}
            </ol>
          }
        />
        <OrderBookRow
          label="Exceptions"
          value={
            request.exceptions.length === 0 ? (
              "None"
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {request.exceptions.map((exception) => (
                  <li key={exception}>{exception}</li>
                ))}
              </ul>
            )
          }
          tone={request.exceptions.length === 0 ? "muted" : "default"}
          note={
            request.exceptions.length > 0
              ? "Disclosed to the client when the request was made and as steps ran."
              : undefined
          }
        />
        {request.hasExport ? (
          <OrderBookRow
            label="Export"
            value="Written"
            note="The file holds the client's name, email and measurements. Opening it is written to the audit log under your name (export.view)."
            action={<ExportAccess requestId={request._id} />}
          />
        ) : null}
        {request.caseId ? (
          <OrderBookRow
            label="Case"
            value="The privacy case on the queue"
            action={
              <Link href={routes.staffAtelier.case(request.caseId)} className="text-sm underline underline-offset-4">
                Open the request
              </Link>
            }
          />
        ) : null}
        <OrderBookRow label="Receipt" value={<Mono upper={false}>{request._id}</Mono>} />
      </OrderBook>
      {terminal ? (
        <p className="text-sm text-muted-foreground">This request is “{request.statusLabel}”; nothing further runs.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          <AdvanceControl request={request} pendingCount={unsettled.length} awaiting={awaiting} />
          <CompleteOrRejectForm request={request} blocked={blocking.length > 0} awaiting={awaiting} />
        </div>
      )}
    </div>
  );
}

/**
 * The audited look at a client's export (O08, as O06 does for a preview result). The link comes from a
 * mutation that writes `export.view` first; the button says so, and nothing is signed until it is pressed.
 */
function ExportAccess({ requestId }: { requestId: Id<"atelierPrivacyRequests"> }) {
  const reveal = useMutation(api.atelier.privacy.staffExportUrl);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await reveal({ requestId });
      setUrl(result.url);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (url) {
    return (
      <span className="flex flex-col items-start gap-0.5 sm:items-end">
        <a href={url} className="text-sm underline underline-offset-4" target="_blank" rel="noreferrer">
          Open the export file
        </a>
        <span className="text-xs text-muted-foreground">Recorded in the audit log.</span>
      </span>
    );
  }
  if (url === null) {
    return <span className="text-sm text-muted-foreground">The export file is gone.</span>;
  }
  return (
    <span className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-none"
        disabled={pending}
        onClick={() => void run()}
        title="Recorded in the audit log"
      >
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Reveal the link · recorded
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

type StepView = StaffPrivacyRequestView["steps"][number];

/**
 * Runs the next step. When that step rests with the staff member (the account's removal at the identity
 * provider), the control says plainly that pressing it is their record that the removal has been done.
 */
function AdvanceControl({
  request,
  pendingCount,
  awaiting,
}: {
  request: StaffPrivacyRequestView;
  pendingCount: number;
  awaiting: StepView | null;
}) {
  const advance = useMutation(api.atelier.privacy.staffAdvance);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await advance({ requestId: request._id });
      const words = result.ran
        ? `Ran “${request.steps.find((step) => step.key === result.ran)?.label ?? result.ran}”. Now “${PRIVACY_STATUS_LABELS[result.status]}”${result.scheduled ? "; the next step is scheduled." : "."}`
        : "Nothing was left to run.";
      setLast(words);
      toast.success(words);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  const recording = awaiting !== null && pendingCount === 1;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{recording ? "Record the account removal" : "Run the next step"}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pendingCount === 0
            ? "Every step has settled."
            : recording
              ? `“${awaiting?.label}” waits on you. Remove the account at the identity provider first; pressing this records that it was done, under your name, and the request then reads “${PRIVACY_STATUS_LABELS.completed}”.`
              : `${pluralize(pendingCount, "step")} pending or failed. Runs the next one now, including one that failed, and records it under your name.`}
        </p>
      </div>
      {error ? <ErrorAlert title="The step did not run" message={error} /> : null}
      {last ? <StatusLine live>{last}</StatusLine> : null}
      <Button
        variant="outline"
        disabled={pending || pendingCount === 0}
        onClick={() => void run()}
        className="h-10 rounded-none px-4"
      >
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {recording ? "Record the account removed" : "Advance"}
      </Button>
    </div>
  );
}

function CompleteOrRejectForm({
  request,
  blocked,
  awaiting,
}: {
  request: StaffPrivacyRequestView;
  blocked: boolean;
  awaiting: StepView | null;
}) {
  const complete = useMutation(api.atelier.privacy.complete);
  const reject = useMutation(api.atelier.privacy.reject);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"complete" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = note.trim().length === 0;

  async function run(action: "complete" | "reject") {
    setPending(action);
    setError(null);
    try {
      if (action === "complete") {
        await complete({ requestId: request._id, note: note.trim() });
        toast.success(
          `Completed. The client reads “${PRIVACY_STATUS_LABELS.completed}”${request.exceptions.length > 0 ? " with exceptions" : ""}.`,
        );
      } else {
        await reject({ requestId: request._id, note: note.trim() });
        toast.success(`Rejected. The client reads “${PRIVACY_STATUS_LABELS.rejected}” and your note.`);
      }
      setNote("");
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-medium">Close the request</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Complete once every step has settled; reject with a documented reason when a legal or policy exception stands.
          Both need a note.
          {awaiting
            ? ` Completing also records “${awaiting.label}” as done under your name, so remove the account at the identity provider first.`
            : ""}
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor={`privacy-note-${request._id}`}>Note</FieldLabel>
        <FieldDescription>What was reviewed or done. A rejection note is read by the client.</FieldDescription>
        <Textarea
          id={`privacy-note-${request._id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The request did not close" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending !== null || empty || blocked}
          onClick={() => void run("complete")}
          className="h-10 rounded-none px-4"
        >
          {pending === "complete" ? <Spinner data-icon="inline-start" /> : null}
          Complete
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || empty}
          onClick={() => void run("reject")}
          className="h-10 rounded-none px-4"
        >
          {pending === "reject" ? <Spinner data-icon="inline-start" /> : null}
          Reject
        </Button>
        {blocked ? (
          <p className="basis-full text-xs text-muted-foreground">
            Complete is disabled while a step is pending or failed; run them first.
          </p>
        ) : null}
      </div>
    </form>
  );
}
