"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import { dateInputToTimestamp, timestampToDateInput } from "./date-input";

/** C22 from the house's side: a risk to the client's date, told to them on the request, with any new estimate labelled as one. */
export function RiskForm({ order }: { order: StaffOrderView }) {
  const setRisk = useMutation(api.atelier.orders.setRisk);
  const [riskNote, setRiskNote] = useState(order.riskNote ?? "");
  const [estimate, setEstimate] = useState(
    order.estimatedReadyAt !== null ? timestampToDateInput(order.estimatedReadyAt) : "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimatedReadyAt = estimate ? dateInputToTimestamp(estimate) : null;
  const ready = riskNote.trim().length > 0 && (estimate === "" || estimatedReadyAt !== null);
  const closed = order.status === "cancelled" || order.status === "accepted";

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await setRisk({
        orderId: order._id,
        riskNote: riskNote.trim(),
        ...(estimatedReadyAt !== null ? { estimatedReadyAt } : {}),
      });
      toast.success("Risk noted. The client reads it on their request, with any new date marked “Estimate”.");
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (closed) {
    return (
      <p className="text-sm text-muted-foreground">
        {order.status === "cancelled"
          ? "This commission was cancelled."
          : "The fit has been accepted; there is no date left at risk."}
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <Field>
        <FieldLabel htmlFor={`risk-note-${order._id}`}>What puts the date at risk</FieldLabel>
        <FieldDescription>
          The client reads this sentence on their request and their order. Say what is possible before anything is
          promised.
        </FieldDescription>
        <Textarea
          id={`risk-note-${order._id}`}
          value={riskNote}
          onChange={(event) => setRiskNote(event.target.value)}
          rows={3}
          className="rounded-sm"
        />
      </Field>
      <Field className="max-w-xs">
        <FieldLabel htmlFor={`risk-estimate-${order._id}`}>New estimated ready date</FieldLabel>
        <FieldDescription>
          Optional.{" "}
          {order.estimatedReadyAt !== null
            ? `Currently ${formatDate(order.estimatedReadyAt)} (Estimate).`
            : "No estimate is recorded."}{" "}
          Always shown with the word “Estimate”.
        </FieldDescription>
        <Input
          id={`risk-estimate-${order._id}`}
          type="date"
          value={estimate}
          onChange={(event) => setEstimate(event.target.value)}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The risk was not recorded" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Record the risk
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“Risk to your date noted”</span>
          {estimatedReadyAt !== null ? ` · ${formatDate(estimatedReadyAt)} · Estimate` : ""}
        </p>
      </div>
    </form>
  );
}
