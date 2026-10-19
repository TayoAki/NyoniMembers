"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CORRECTION_TEXT_MAX } from "@/components/atelier/aftercare/aftercare-words";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * C24 acceptance: once the house marks a correction completed, the client says whether the fit is right.
 * "Resolved" closes it; "still an issue" needs a few words and goes to a senior member of the house.
 */
export function ReassessForm({ correctionId }: { correctionId: Id<"atelierCorrections"> }) {
  const id = useId();
  const guestKeyArg = useGuestKeyArg();
  const reassess = useMutation(api.atelier.corrections.reassess);
  const [stillOpen, setStillOpen] = useState(false);
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  const trimmed = note.trim();
  const noteError = !trimmed
    ? "A few words on what is still wrong are needed."
    : trimmed.length > CORRECTION_TEXT_MAX
      ? `Keep it under ${formatNumber(CORRECTION_TEXT_MAX)} characters.`
      : null;

  async function resolved() {
    setError(null);
    try {
      await reassess({ ...guestKeyArg, correctionId, outcome: "resolved", note: "" });
      toast.success("Resolved · the fit is accepted");
    } catch (caught) {
      setError(toClientError(caught));
      throw caught;
    }
  }

  async function stillIssue() {
    setAttempted(true);
    if (noteError || pending) return;
    setPending(true);
    setError(null);
    try {
      await reassess({ ...guestKeyArg, correctionId, outcome: "still_issue", note: trimmed });
      toast.success("Sent · escalated to a senior member of the house");
    } catch (caught) {
      setError(toClientError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-foreground/15 pt-5">
      <div className="space-y-1">
        <h4 className="text-base font-medium">Is the fit right now?</h4>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The house has finished this correction. Try the suit on before you answer: only your word closes it.
        </p>
      </div>
      {error ? (
        <ErrorAlert title="Your answer was not recorded" message={error.message} className="rounded-none" />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmDialog
          trigger={<Button className="h-11 rounded-none px-5">The fit is right now</Button>}
          title="Confirm the fit is right?"
          description="This closes the correction and records the fit as accepted. The house's alteration promise stands regardless."
          confirmLabel="Yes, it is right"
          cancelLabel="Not yet"
          onConfirm={resolved}
        />
        {!stillOpen ? (
          <Button variant="outline" className="h-11 rounded-none px-5" onClick={() => setStillOpen(true)}>
            Still an issue
          </Button>
        ) : null}
      </div>
      {stillOpen ? (
        <form
          className="max-w-2xl space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void stillIssue();
          }}
        >
          <Field data-invalid={attempted && noteError ? true : undefined}>
            <FieldLabel htmlFor={id}>What is still wrong</FieldLabel>
            <FieldDescription>
              This goes straight to a senior member of the house for a decision; you will not be asked to describe it
              again.
            </FieldDescription>
            <Textarea
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              disabled={pending}
              aria-invalid={attempted && noteError ? true : undefined}
              className="min-h-24 rounded-none text-base md:text-sm"
            />
            {attempted && noteError ? <FieldError>{noteError}</FieldError> : null}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="outline"
              className="h-11 rounded-none px-5"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
              {pending ? "Sending…" : "Send to the house"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-none px-4"
              onClick={() => setStillOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
