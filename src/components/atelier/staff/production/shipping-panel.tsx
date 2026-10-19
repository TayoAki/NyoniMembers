"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import { ORDER_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { dateInputToTimestamp, timestampToDateInput } from "./date-input";
import { DELIVERABLE_STATUSES, SHIPPABLE_STATUSES } from "./production-words";

/** O05: the parcel. Shipped never implies fitted; delivery opens the fit review and never closes it. */
export function ShippingPanel({ order }: { order: StaffOrderView }) {
  return (
    <div className="space-y-6">
      <OrderBook>
        <OrderBookRow
          label="Carrier"
          value={order.carrier ?? "Not shipped"}
          tone={order.carrier ? "default" : "muted"}
          note={order.shippedAt !== null ? `Shipped ${formatDateTime(order.shippedAt)}.` : undefined}
        />
        <OrderBookRow
          label="Tracking"
          value={order.trackingRef ? <Mono upper={false}>{order.trackingRef}</Mono> : "None"}
          tone={order.trackingRef ? "default" : "muted"}
          note="Shown to the client as a reference, never as a link unless the carrier gives one."
        />
        <OrderBookRow
          label="Delivered"
          value={order.deliveredAt !== null ? formatDateTime(order.deliveredAt) : "Not yet"}
          tone={order.deliveredAt !== null ? "default" : "muted"}
        />
      </OrderBook>
      {SHIPPABLE_STATUSES.includes(order.status) ? <MarkShippedForm order={order} /> : null}
      {DELIVERABLE_STATUSES.includes(order.status) ? <MarkDeliveredForm order={order} /> : null}
      {!SHIPPABLE_STATUSES.includes(order.status) && !DELIVERABLE_STATUSES.includes(order.status) ? (
        <p className="text-sm text-muted-foreground">
          {order.status === "preflight"
            ? "Release the commission before recording shipping."
            : `This commission is “${order.statusLabel}”; nothing about the parcel is left to record.`}
        </p>
      ) : null}
    </div>
  );
}

function MarkShippedForm({ order }: { order: StaffOrderView }) {
  const markShipped = useMutation(api.atelier.orders.markShipped);
  const [carrier, setCarrier] = useState("");
  const [trackingRef, setTrackingRef] = useState("");
  const [date, setDate] = useState(() => timestampToDateInput(Date.now()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = dateInputToTimestamp(date);
  const ready = carrier.trim().length > 0 && trackingRef.trim().length > 0 && at !== null;

  async function submit() {
    if (at === null) return;
    setPending(true);
    setError(null);
    try {
      await markShipped({ orderId: order._id, carrier: carrier.trim(), trackingRef: trackingRef.trim(), at });
      toast.success(`Recorded. The client reads “${ORDER_STATUS_LABELS.shipped}”; their fit review stays open.`);
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
      <h3 className="text-base font-medium">Mark shipped</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`carrier-${order._id}`}>Carrier</FieldLabel>
          <Input
            id={`carrier-${order._id}`}
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="UPS"
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`tracking-${order._id}`}>Tracking reference</FieldLabel>
          <Input
            id={`tracking-${order._id}`}
            value={trackingRef}
            onChange={(event) => setTrackingRef(event.target.value)}
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`shipped-at-${order._id}`}>Handed to the carrier</FieldLabel>
          <Input
            id={`shipped-at-${order._id}`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-sm"
          />
        </Field>
      </div>
      {error ? <ErrorAlert title="Shipping was not recorded" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Mark shipped
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{ORDER_STATUS_LABELS.shipped}”</span> · fit review still open
        </p>
      </div>
    </form>
  );
}

function MarkDeliveredForm({ order }: { order: StaffOrderView }) {
  const markDelivered = useMutation(api.atelier.orders.markDelivered);
  const [date, setDate] = useState(() => timestampToDateInput(Date.now()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = dateInputToTimestamp(date);

  async function submit() {
    if (at === null) return;
    setPending(true);
    setError(null);
    try {
      await markDelivered({ orderId: order._id, at });
      toast.success(`Recorded. The client reads “${ORDER_STATUS_LABELS.fit_review}”.`);
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
        if (at !== null) void submit();
      }}
    >
      <h3 className="text-base font-medium">Mark delivered</h3>
      <Field className="max-w-xs">
        <FieldLabel htmlFor={`delivered-at-${order._id}`}>Delivered on</FieldLabel>
        <FieldDescription>
          Opens the client&rsquo;s fit review. It never marks the fit accepted; only the client does that.
        </FieldDescription>
        <Input
          id={`delivered-at-${order._id}`}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="Delivery was not recorded" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || at === null} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Mark delivered
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{ORDER_STATUS_LABELS.fit_review}”</span>
        </p>
      </div>
    </form>
  );
}
