"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { GroupReviewStatus, GroupReviewView } from "@convex/atelier/groups";
import { GROUP_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { organizerReads, REVIEW_STATUS_EFFECT, reviewOptionsFor } from "./groups-words";

/** The house's word on a group (C28): an outcome the state machine allows and a note the organizer reads. */
export function GroupReviewForm({ group }: { group: GroupReviewView }) {
  const review = useMutation(api.atelier.groups.review);
  const options = reviewOptionsFor(group.status);
  const [status, setStatus] = useState<GroupReviewStatus | null>(null);
  const [note, setNote] = useState(group.staffReviewNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = status !== null && note.trim().length > 0;

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This group is “{group.statusLabel}”; the house has nothing left to decide.
      </p>
    );
  }

  async function submit() {
    if (!status) return;
    setPending(true);
    setError(null);
    try {
      await review({ groupId: group._id, status, note: note.trim() });
      toast.success(`Recorded. The organizer reads “${organizerReads(status)}” and your note.`);
      setStatus(null);
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
      <RadioGroup
        value={status}
        onValueChange={(value) => setStatus(value as GroupReviewStatus)}
        aria-label="Outcome"
        className="gap-3"
      >
        {options.map((candidate) => (
          <div key={candidate} className="flex items-start gap-3">
            <RadioGroupItem id={`group-review-${group._id}-${candidate}`} value={candidate} className="mt-1" />
            <Label
              htmlFor={`group-review-${group._id}-${candidate}`}
              className="flex flex-col gap-0.5 text-sm font-normal"
            >
              <span className="font-medium">{GROUP_STATUS_LABELS[candidate]}</span>
              <span className="text-xs text-muted-foreground">{REVIEW_STATUS_EFFECT[candidate]}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Field>
        <FieldLabel htmlFor={`group-note-${group._id}`}>The house&rsquo;s note</FieldLabel>
        <FieldDescription>
          Required. The organizer reads it on their group page exactly as written; participants do not.
        </FieldDescription>
        <Textarea
          id={`group-note-${group._id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The review was not recorded" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Record the review
        </Button>
        {status ? (
          <p className="text-xs text-muted-foreground">
            Organizer reads: <span className="text-foreground">“{organizerReads(status)}”</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
