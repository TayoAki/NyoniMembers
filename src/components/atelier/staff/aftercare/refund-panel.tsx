"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { formatDateTime, formatUsd } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffCorrectionView } from "@convex/atelier/corrections";
import { REFUND_STATE_LABELS } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { REFUND_STATE_TONES } from "./aftercare-words";

/**
 * O07 step 3, the money: approval and confirmation are two different facts. Approval is a decision the
 * client reads as "Refund approved · not yet returned to you"; only confirmation, with the payment
 * system's reference and the finance role, makes it "Refunded".
 */
export function RefundPanel({
  correction,
  finance,
  operations,
}: {
  correction: StaffCorrectionView;
  finance: boolean;
  operations: boolean;
}) {
  const refund = correction.refund;
  const state = refund?.state ?? "none";
  const canApprove = correction.open && state === "none" && (finance || operations);
  const canConfirm = (state === "approved" || state === "processing") && finance;
  const needsFinance = (state === "approved" || state === "processing") && !finance;

  return (
    <div className="space-y-6">
      <OrderBook>
        <OrderBookRow
          label="Refund"
          value={
            <StatusLine tone={REFUND_STATE_TONES[state]}>{refund?.stateLabel ?? REFUND_STATE_LABELS.none}</StatusLine>
          }
          note={`The client reads these words. Only confirmation makes it “${REFUND_STATE_LABELS.refunded}”.`}
        />
        {refund && refund.amountUsd !== null ? (
          <OrderBookRow label="Amount" value={formatUsd(refund.amountUsd)} />
        ) : null}
        {refund?.reference ? (
          <OrderBookRow
            label="Reference"
            value={<Mono upper={false}>{refund.reference}</Mono>}
            note={refund.confirmedAt !== null ? `Confirmed ${formatDateTime(refund.confirmedAt)}.` : undefined}
          />
        ) : null}
        {correction.payment ? (
          <OrderBookRow
            label="Payment on the commission"
            value={correction.payment.stateLabel}
            note={`${correction.payment.amountUsd !== null ? formatUsd(correction.payment.amountUsd) : "No amount"}${correction.payment.reference ? ` · ${correction.payment.reference}` : ""}`}
          />
        ) : null}
        <OrderBookRow
          label="House policy"
          value={HOUSE_POLICY.verified.refunds}
          note={HOUSE_POLICY.verified.storeCredit}
        />
      </OrderBook>
      {canApprove ? <ApproveRefundForm correction={correction} /> : null}
      {canConfirm ? <ConfirmRefundForm correction={correction} /> : null}
      {needsFinance ? (
        <p className="text-sm text-muted-foreground">
          Confirming this refund needs the finance role: it records the payment system&rsquo;s reference.
        </p>
      ) : null}
      {!correction.open && state === "none" ? (
        <p className="text-sm text-muted-foreground">This correction is closed; open a new one to refund against it.</p>
      ) : null}
    </div>
  );
}

function ApproveRefundForm({ correction }: { correction: StaffCorrectionView }) {
  const approveRefund = useMutation(api.atelier.corrections.approveRefund);
  const [amount, setAmount] = useState(correction.remedy?.amountUsd ? String(correction.remedy.amountUsd) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(amount);
  const ready = amount.trim().length > 0 && Number.isFinite(value) && value > 0;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await approveRefund({ correctionId: correction._id, amountUsd: value });
      toast.success(`Approved. The client reads “${REFUND_STATE_LABELS.approved}”.`);
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
      <h3 className="text-base font-medium">Approve a refund</h3>
      <Field className="max-w-xs">
        <FieldLabel htmlFor={`refund-approve-${correction._id}`}>Amount (USD)</FieldLabel>
        <FieldDescription>
          A decision, not a payment. Nothing moves until finance confirms it from the payment system.
        </FieldDescription>
        <Input
          id={`refund-approve-${correction._id}`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The refund was not approved" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Approve refund
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{REFUND_STATE_LABELS.approved}”</span>
        </p>
      </div>
    </form>
  );
}

function ConfirmRefundForm({ correction }: { correction: StaffCorrectionView }) {
  const confirmRefund = useMutation(api.atelier.corrections.confirmRefund);
  const [amount, setAmount] = useState(correction.refund?.amountUsd ? String(correction.refund.amountUsd) : "");
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(amount);
  const ready = amount.trim().length > 0 && Number.isFinite(value) && value > 0 && reference.trim().length > 0;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await confirmRefund({
        correctionId: correction._id,
        amountUsd: value,
        reference: reference.trim(),
      });
      if (result.duplicate) toast.message("Already confirmed under that reference; nothing changed.");
      else toast.success(`Confirmed. The client now reads “${REFUND_STATE_LABELS.refunded}”.`);
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
      <h3 className="text-base font-medium">Confirm the refund from the payment system</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`refund-confirm-amount-${correction._id}`}>Amount returned (USD)</FieldLabel>
          <FieldDescription>As the payment system reports it.</FieldDescription>
          <Input
            id={`refund-confirm-amount-${correction._id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`refund-confirm-ref-${correction._id}`}>Payment system&rsquo;s reference</FieldLabel>
          <FieldDescription>
            Required. The same reference is recorded once, however many times it arrives.
          </FieldDescription>
          <Input
            id={`refund-confirm-ref-${correction._id}`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="re_…"
            className="rounded-sm"
          />
        </Field>
      </div>
      {error ? <ErrorAlert title="The refund was not confirmed" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Confirm refund
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{REFUND_STATE_LABELS.refunded}”</span> · only this action
          says so
        </p>
      </div>
    </form>
  );
}
