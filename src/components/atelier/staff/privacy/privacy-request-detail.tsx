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
import type { PrivacyRequestView } from "@convex/atelier/privacy";
import { PRIVACY_STATUS_LABELS, PRIVACY_STEP_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { PRIVACY_STATUS_TONES, STEP_STATUS_TONES } from "./privacy-words";

/** O08 steps 2–3: one request's steps as they really stand, with re-run, complete and reject. */
export function PrivacyRequestDetail({ requestId }: { requestId: Id<"atelierPrivacyRequests"> }) {
  const request = useQuery(api.atelier.privacy.staffGet, { requestId });
  if (request === undefined) return <LoadingRows count={5} />;
  return <PrivacyRequestDetailView request={request} />;
}

export function PrivacyRequestDetailView({ request }: { request: PrivacyRequestView }) {
  const unsettled = request.steps.filter((step) => step.status === "pending" || step.status === "failed");
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
        {request.exportUrl ? (
          <OrderBookRow
            label="Export"
            value="Written"
            action={
              <a
                href={request.exportUrl}
                className="text-sm underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                Open the export file
              </a>
            }
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
          <AdvanceControl request={request} pendingCount={unsettled.length} />
          <CompleteOrRejectForm request={request} blocked={unsettled.length > 0} />
        </div>
      )}
    </div>
  );
}

function AdvanceControl({ request, pendingCount }: { request: PrivacyRequestView; pendingCount: number }) {
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

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Run the next step</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pendingCount === 0
            ? "Every step has settled."
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
        Advance
      </Button>
    </div>
  );
}

function CompleteOrRejectForm({ request, blocked }: { request: PrivacyRequestView; blocked: boolean }) {
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
