"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FIT_PROFILE_STATUS_LABELS } from "@convex/shared/atelier/enums";
import type { ParsedValues } from "./measurement-review";

/**
 * The fitter's decision (O03): approve with the values settled on and a note the client reads, or send
 * one question back. The client's words for each outcome sit beside the action so the fitter knows what
 * the client will read.
 */
export function FitActions({
  profileId,
  version,
  parsed,
}: {
  profileId: Id<"atelierFitProfiles">;
  version: number;
  parsed: ParsedValues;
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <ApproveForm profileId={profileId} version={version} parsed={parsed} />
      <ClarificationForm profileId={profileId} />
    </div>
  );
}

function ApproveForm({
  profileId,
  version,
  parsed,
}: {
  profileId: Id<"atelierFitProfiles">;
  version: number;
  parsed: ParsedValues;
}) {
  const approve = useMutation(api.atelier.fit.approve);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteMissing = note.trim().length === 0;
  const blocked = parsed.problems.length > 0;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await approve({ profileId, approvedValues: parsed.cm, reviewNote: note.trim() });
      toast.success(`Version ${version} approved. The client now reads “${FIT_PROFILE_STATUS_LABELS.approved}”.`);
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
        if (!noteMissing && !blocked) void submit();
      }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-medium">Approve this version</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Approves the fitter&rsquo;s values above; the client&rsquo;s previous approved version becomes superseded. The
          client reads “{FIT_PROFILE_STATUS_LABELS.approved}” and sees your note beside every value you changed.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor={`review-note-${profileId}`}>Review note</FieldLabel>
        <FieldDescription>Required. Say what you settled on and why; the client reads it.</FieldDescription>
        <Textarea
          id={`review-note-${profileId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Shoulder taken in by 1 cm to match the back width; sleeve as measured."
          className="rounded-sm"
        />
      </Field>
      {blocked ? <FieldError errors={parsed.problems.map((message) => ({ message }))} /> : null}
      {error ? <ErrorAlert title="The version was not approved" message={error} /> : null}
      <Button type="submit" disabled={pending || noteMissing || blocked} className="h-10 rounded-none px-4">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Approve version {version}
      </Button>
    </form>
  );
}

function ClarificationForm({ profileId }: { profileId: Id<"atelierFitProfiles"> }) {
  const requestClarification = useMutation(api.atelier.fit.requestClarification);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = question.trim().length === 0;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await requestClarification({ profileId, clarification: question.trim() });
      toast.success(`Question sent. The client now reads “${FIT_PROFILE_STATUS_LABELS.needs_clarification}”.`);
      setQuestion("");
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
        if (!empty) void submit();
      }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-medium">Ask the client one question</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The version waits as “{FIT_PROFILE_STATUS_LABELS.needs_clarification}” until they answer with a new version.
          Nothing is approved.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor={`clarification-${profileId}`}>Your question</FieldLabel>
        <FieldDescription>
          Name the measurement and what to re-check. The client reads it exactly as written.
        </FieldDescription>
        <Textarea
          id={`clarification-${profileId}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Your jacket length reads shorter than your height suggests. Could you measure again from the collar seam to mid-hand?"
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The question was not sent" message={error} /> : null}
      <Button type="submit" variant="outline" disabled={pending || empty} className="h-10 rounded-none px-4">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Send the question
      </Button>
    </form>
  );
}
