"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { WordSelect } from "@/components/atelier/staff/case/word-select";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import {
  MILESTONE_SOURCE_LABELS,
  MILESTONE_SOURCES,
  ORDER_STATUS_LABELS,
  type MilestoneSource,
} from "@convex/shared/atelier/enums";
import { PRODUCTION_MILESTONE_KINDS, type ProductionMilestoneKind } from "@convex/shared/atelier/validators";
import { dateInputToTimestamp, timestampToDateInput } from "./date-input";
import {
  HAND_RECORDED_KINDS,
  MILESTONE_KIND_LABELS,
  MILESTONE_SOURCE_STAFF_WORDS,
  STATUS_FOR_MILESTONE,
} from "./production-words";

/** The desk offers only kinds the server records by hand (`orders.addMilestone` accepts PRODUCTION_MILESTONE_KINDS). */
const OFFERED_KINDS: readonly ProductionMilestoneKind[] = HAND_RECORDED_KINDS.filter(
  (kind): kind is ProductionMilestoneKind => (PRODUCTION_MILESTONE_KINDS as readonly string[]).includes(kind),
);

/**
 * O05: a dated, sourced milestone. A fact of an advancing kind moves the commission along the line; an
 * estimate never does and the client reads the word "Estimate" beside it.
 */
export function MilestoneForm({ order }: { order: StaffOrderView }) {
  const addMilestone = useMutation(api.atelier.orders.addMilestone);
  const [kind, setKind] = useState<ProductionMilestoneKind | null>(null);
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [date, setDate] = useState(() => timestampToDateInput(Date.now()));
  const [source, setSource] = useState<MilestoneSource>("staff");
  const [estimated, setEstimated] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = dateInputToTimestamp(date);
  const ready = kind !== null && label.trim().length > 0 && at !== null;
  // An "Estimated ready" line is an estimate by nature (the server records it so) and becomes the commission's estimate.
  const estimateLocked = kind === "estimated_ready";
  const isEstimate = estimateLocked || estimated;
  const target = kind && !isEstimate ? STATUS_FOR_MILESTONE[kind] : undefined;
  const closed = order.status === "cancelled";

  function chooseKind(next: ProductionMilestoneKind) {
    setKind(next);
    if (!labelTouched) setLabel(MILESTONE_KIND_LABELS[next]);
  }

  async function submit() {
    if (!kind || at === null) return;
    setPending(true);
    setError(null);
    try {
      await addMilestone({
        orderId: order._id,
        kind,
        label: label.trim(),
        at,
        source,
        estimated: isEstimate,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(
        estimateLocked
          ? "Estimate recorded; the client reads it with the word “Estimate” and the commission's estimated ready date now says the same."
          : isEstimate
            ? "Estimate recorded; the client reads it with the word “Estimate”."
            : target
              ? `Recorded. The client now reads “${ORDER_STATUS_LABELS[target]}”.`
              : "Milestone recorded.",
      );
      setKind(null);
      setLabel("");
      setLabelTouched(false);
      setNote("");
      setEstimated(false);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (closed)
    return <p className="text-sm text-muted-foreground">This commission was cancelled; no milestone can be added.</p>;

  const kindOptions = OFFERED_KINDS.map((candidate) => {
    const advancesTo = STATUS_FOR_MILESTONE[candidate];
    return {
      code: candidate,
      label: MILESTONE_KIND_LABELS[candidate],
      description: advancesTo
        ? `As a fact, moves the commission to “${ORDER_STATUS_LABELS[advancesTo]}”.`
        : candidate === "estimated_ready"
          ? "Always an estimate; also becomes the commission's estimated ready date."
          : undefined,
    };
  });
  const sourceOptions = MILESTONE_SOURCES.map((candidate) => ({
    code: candidate,
    label: MILESTONE_SOURCE_STAFF_WORDS[candidate],
    description: candidate === "client" ? `The client reads “${MILESTONE_SOURCE_LABELS.client}”.` : undefined,
  }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <h3 className="text-base font-medium">Add a milestone</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`milestone-kind-${order._id}`}>Kind</FieldLabel>
          <FieldDescription>
            Release, payment, shipping, delivery and risk have their own actions on this page; the client&apos;s
            acceptance of the fit is theirs alone to record.
          </FieldDescription>
          <WordSelect
            id={`milestone-kind-${order._id}`}
            value={kind}
            onValueChange={chooseKind}
            options={kindOptions}
            placeholder="Choose a kind"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`milestone-label-${order._id}`}>Label</FieldLabel>
          <FieldDescription>What the client reads on their timeline.</FieldDescription>
          <Input
            id={`milestone-label-${order._id}`}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setLabelTouched(true);
            }}
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`milestone-date-${order._id}`}>Date</FieldLabel>
          <FieldDescription>{isEstimate ? "The date the house expects." : "The date it happened."}</FieldDescription>
          <Input
            id={`milestone-date-${order._id}`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`milestone-source-${order._id}`}>Source</FieldLabel>
          <FieldDescription>Who reported it.</FieldDescription>
          <WordSelect
            id={`milestone-source-${order._id}`}
            value={source}
            onValueChange={setSource}
            options={sourceOptions}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Switch
          id={`milestone-estimated-${order._id}`}
          checked={isEstimate}
          disabled={estimateLocked}
          onCheckedChange={(checked) => setEstimated(checked)}
        />
        <Label htmlFor={`milestone-estimated-${order._id}`} className="text-sm">
          This is an estimate, not something that happened
        </Label>
        {estimateLocked ? (
          <span className="text-xs text-muted-foreground">An estimated ready date is always an estimate.</span>
        ) : null}
      </div>
      <Field>
        <FieldLabel htmlFor={`milestone-note-${order._id}`}>Note</FieldLabel>
        <FieldDescription>Optional; the client reads it under the milestone.</FieldDescription>
        <Textarea
          id={`milestone-note-${order._id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The milestone was not added" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Add milestone
        </Button>
        {kind ? (
          <p className="text-xs text-muted-foreground">
            Client reads:{" "}
            <span className="text-foreground">
              “{label.trim() || MILESTONE_KIND_LABELS[kind]}”{isEstimate ? " · Estimate" : ""}
            </span>
            {target ? ` and the status “${ORDER_STATUS_LABELS[target]}”` : ""}
          </p>
        ) : null}
      </div>
    </form>
  );
}
