"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { WordSelect } from "@/components/atelier/staff/case/word-select";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { formatDateTime, formatUsd } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import { PAYMENT_STATE_LABELS, REFUND_PAYMENT_STATES, type PaymentState } from "@convex/shared/atelier/enums";
import { PAYMENT_STATE_TONES, PAYMENT_TRANSITIONS } from "./production-words";

const REFUNDS_ON_THE_CORRECTION =
  "A refund is approved and confirmed on the client's correction, by finance, from the payment system's reference; the record here follows it. Nothing reads “Refunded” from this form.";

/**
 * O04/O05: the payment record, written from what the house's payment system reported. There is no
 * checkout here. Only the legal next states are offered, and never a refund: those are finance's words,
 * written from the correction when the payment system confirms them (C25, O07). The reference makes a
 * repeat harmless.
 */
export function PaymentPanel({ order }: { order: StaffOrderView }) {
  const next = PAYMENT_TRANSITIONS[order.payment.state];
  const legal = next.filter((candidate) => !REFUND_PAYMENT_STATES.includes(candidate));
  const refundsFollow = next.length > legal.length;
  return (
    <div className="space-y-6">
      <OrderBook>
        <OrderBookRow
          label="Recorded"
          value={<StatusLine tone={PAYMENT_STATE_TONES[order.payment.state]}>{order.payment.stateLabel}</StatusLine>}
          note={
            order.payment.confirmedAt !== null
              ? `Confirmed ${formatDateTime(order.payment.confirmedAt)}.`
              : "The client reads these same words on their order; nothing reads “Paid” without a confirmed record."
          }
        />
        <OrderBookRow
          label="Amount"
          value={order.payment.amountUsd !== null ? formatUsd(order.payment.amountUsd) : "None recorded"}
          tone={order.payment.amountUsd !== null ? "default" : "muted"}
        />
        <OrderBookRow
          label="Reference"
          value={order.paymentReference ? <Mono upper={false}>{order.paymentReference}</Mono> : "None"}
          tone={order.paymentReference ? "default" : "muted"}
          note={order.paymentProvider ? `Provider: ${order.paymentProvider}` : undefined}
        />
      </OrderBook>
      {legal.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Payment is “{order.payment.stateLabel}”; nothing further is recorded here.
          {refundsFollow ? ` ${REFUNDS_ON_THE_CORRECTION}` : ""}
        </p>
      ) : (
        <RecordPaymentForm order={order} legal={legal} />
      )}
    </div>
  );
}

function RecordPaymentForm({ order, legal }: { order: StaffOrderView; legal: readonly PaymentState[] }) {
  const recordPayment = useMutation(api.atelier.orders.recordPayment);
  const [state, setState] = useState<PaymentState | null>(null);
  const [amount, setAmount] = useState(order.totalUsd !== null ? String(order.totalUsd) : "");
  const [reference, setReference] = useState("");
  const [provider, setProvider] = useState(order.paymentProvider ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedAmount = Number(amount);
  const amountOk = amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount >= 0;
  const ready = state !== null && amountOk && reference.trim().length > 0 && provider.trim().length > 0;

  async function submit() {
    if (!state) return;
    setPending(true);
    setError(null);
    try {
      const result = await recordPayment({
        orderId: order._id,
        state,
        amountUsd: parsedAmount,
        reference: reference.trim(),
        provider: provider.trim(),
      });
      if (result.changed) {
        toast.success(`Recorded. The client now reads “${result.payment.stateLabel}”.`);
        setReference("");
        setState(null);
      } else {
        toast.message("Already recorded under that reference in that state; nothing changed.");
      }
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  const options = legal.map((candidate) => ({ code: candidate, label: PAYMENT_STATE_LABELS[candidate] }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <h3 className="text-base font-medium">Record what the payment system reported</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`payment-state-${order._id}`}>State</FieldLabel>
          <FieldDescription>Only states that follow “{order.payment.stateLabel}” are offered.</FieldDescription>
          <WordSelect
            id={`payment-state-${order._id}`}
            value={state}
            onValueChange={setState}
            options={options}
            placeholder="Choose the reported state"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`payment-amount-${order._id}`}>Amount (USD)</FieldLabel>
          <FieldDescription>As the provider recorded it.</FieldDescription>
          <Input
            id={`payment-amount-${order._id}`}
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
          <FieldLabel htmlFor={`payment-provider-${order._id}`}>Provider</FieldLabel>
          <FieldDescription>The system that took the payment.</FieldDescription>
          <Input
            id={`payment-provider-${order._id}`}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            placeholder="Square"
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`payment-reference-${order._id}`}>Provider&rsquo;s reference</FieldLabel>
          <FieldDescription>
            Required. The same reference in the same state is recorded once, however many times it arrives.
          </FieldDescription>
          <Input
            id={`payment-reference-${order._id}`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="pay_…"
            className="rounded-sm"
          />
        </Field>
      </div>
      {error ? <ErrorAlert title="The payment was not recorded" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Record payment
        </Button>
        {state ? (
          <p className="text-xs text-muted-foreground">
            Client reads: <span className="text-foreground">“{PAYMENT_STATE_LABELS[state]}”</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
