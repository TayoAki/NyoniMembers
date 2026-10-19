"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffCorrectionView } from "@convex/atelier/corrections";
import { CORRECTION_STATUS_LABELS, correctionStatusLabel, type CorrectionStatus } from "@convex/shared/atelier/enums";
import { canTransition, clientReadsAfter, NOTE_REQUIRED_STATUSES, settableNextStatuses } from "./aftercare-words";

/**
 * O07: moving a correction along. Triage and escalation have their own forms; the other legal next
 * states are buttons, and the two that close the case ask for a note the client reads first. Nothing
 * illegal from the current state is offered.
 */
export function StatusActions({
  correction,
  operations,
  finance,
}: {
  correction: StaffCorrectionView;
  operations: boolean;
  finance: boolean;
}) {
  const canTriage = operations && canTransition(correction.status, "triaged") && correction.status !== "escalated";
  const canEscalate =
    (operations || finance) && (correction.status === "escalated" || canTransition(correction.status, "escalated"));
  const settable = operations ? settableNextStatuses(correction.status) : [];
  const nothing = !canTriage && !canEscalate && settable.length === 0;

  return (
    <div className="space-y-8">
      {canTriage ? <TriageForm correction={correction} /> : null}
      {settable.length > 0 ? <SetStatusForm correction={correction} statuses={settable} /> : null}
      {canEscalate ? <EscalateForm correction={correction} /> : null}
      {nothing ? (
        <p className="text-sm text-muted-foreground">
          {correction.status === "closed"
            ? "This correction is closed."
            : operations || finance
              ? `Nothing to set by hand from “${correction.statusLabel}”; the next move is the client's or another action on this page.`
              : "Moving a correction needs the operations role."}
        </p>
      ) : null}
    </div>
  );
}

function TriageForm({ correction }: { correction: StaffCorrectionView }) {
  const triage = useMutation(api.atelier.corrections.triage);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await triage({ correctionId: correction._id, note: note.trim() });
      toast.success(`Triaged. The client reads “${CORRECTION_STATUS_LABELS.triaged}” and your note.`);
      setNote("");
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim()) void submit();
      }}
    >
      <h3 className="text-base font-medium">Triage</h3>
      <Field>
        <FieldLabel htmlFor={`triage-note-${correction._id}`}>Note to the client</FieldLabel>
        <FieldDescription>
          Required. Goes to the conversation on their request. Takes the request if nobody owns it.
        </FieldDescription>
        <Textarea
          id={`triage-note-${correction._id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="rounded-sm"
          placeholder="Thank you for the photographs. We have the original specification and your fit profile in front of us and will propose a remedy within two business days."
        />
      </Field>
      {error ? <ErrorAlert title="The correction was not triaged" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || note.trim().length === 0} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Mark as being reviewed
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{CORRECTION_STATUS_LABELS.triaged}”</span>
        </p>
      </div>
    </form>
  );
}

function SetStatusForm({ correction, statuses }: { correction: StaffCorrectionView; statuses: CorrectionStatus[] }) {
  const setStatus = useMutation(api.atelier.corrections.setStatus);
  const [chosen, setChosen] = useState<CorrectionStatus | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRequired = chosen !== null && NOTE_REQUIRED_STATUSES.includes(chosen);
  const ready = chosen !== null && (!noteRequired || note.trim().length > 0);

  async function submit() {
    if (!chosen) return;
    setPending(true);
    setError(null);
    try {
      await setStatus({ correctionId: correction._id, status: chosen, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success(`Now “${correctionStatusLabel(correction.kind, chosen)}”.`);
      setChosen(null);
      setNote("");
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-medium">Move it along</h3>
        <p className="text-sm text-muted-foreground">
          Only the states that follow “{correction.statusLabel}” are offered.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Next status">
        {statuses.map((status) => (
          <Button
            key={status}
            type="button"
            variant={chosen === status ? "default" : "outline"}
            aria-pressed={chosen === status}
            className="h-10 rounded-none px-4"
            onClick={() => setChosen(status)}
          >
            {correctionStatusLabel(correction.kind, status)}
          </Button>
        ))}
      </div>
      {chosen ? (
        <Field>
          <FieldLabel htmlFor={`status-note-${correction._id}`}>
            {noteRequired ? "Note the client reads" : "Note"}
          </FieldLabel>
          <FieldDescription>
            {noteRequired
              ? "Required: this closes their request, so say why."
              : "Optional; the client reads it under the status."}
          </FieldDescription>
          <Textarea
            id={`status-note-${correction._id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="rounded-sm"
          />
        </Field>
      ) : null}
      {error ? <ErrorAlert title="The status did not change" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Apply
        </Button>
        {chosen ? (
          <p className="text-xs text-muted-foreground">
            Client reads: <span className="text-foreground">{clientReadsAfter(chosen, correction.kind)}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}

function EscalateForm({ correction }: { correction: StaffCorrectionView }) {
  const escalate = useMutation(api.atelier.corrections.escalate);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = correction.status === "escalated";

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await escalate({ correctionId: correction._id, note: note.trim() });
      toast.success(
        already
          ? "Note added to the escalation."
          : `Escalated. The client reads “${CORRECTION_STATUS_LABELS.escalated}”.`,
      );
      setNote("");
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim()) void submit();
      }}
    >
      <h3 className="text-base font-medium">{already ? "Add to the escalation" : "Escalate"}</h3>
      <Field>
        <FieldLabel htmlFor={`escalate-note-${correction._id}`}>Why this needs a senior decision</FieldLabel>
        <FieldDescription>
          Required. Repeated fit failures, a missing label, an unreceived reimbursement. The request becomes high
          priority with the house.
        </FieldDescription>
        <Textarea
          id={`escalate-note-${correction._id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The correction was not escalated" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="outline"
          disabled={pending || note.trim().length === 0}
          className="h-10 rounded-none px-4"
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {already ? "Add note" : "Escalate"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{CORRECTION_STATUS_LABELS.escalated}”</span>
        </p>
      </div>
    </form>
  );
}
