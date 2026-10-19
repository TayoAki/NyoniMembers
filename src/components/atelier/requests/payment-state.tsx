"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { NO_CHECKOUT_SENTENCE, PAYMENT_TONES } from "@/components/atelier/requests/case-words";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { formatDateTime, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { MilestoneView } from "@convex/atelier/orders";
import { PAYMENT_STATE_LABELS } from "@convex/shared/atelier/enums";

/** Every payment the house records is a dated milestone; the newest is when the state shown was recorded. */
function latestPaymentMilestone(milestones: readonly MilestoneView[]): MilestoneView | null {
  return milestones.reduce<MilestoneView | null>(
    (latest, milestone) =>
      milestone.kind === "payment" && !milestone.estimated && (latest === null || milestone.at > latest.at)
        ? milestone
        : latest,
    null,
  );
}

/**
 * S28 (conditional): only the payment state the house has recorded on the commission, in the enum's
 * words. There is no checkout here; "Payment confirmed" appears only when staff recorded it, and keeps
 * its own date when a refund follows, so the refund's date is never read as the payment's.
 */
export function PaymentState({ orderId }: { orderId: Id<"atelierOrders"> }) {
  const order = useQuery(api.atelier.orders.get, useOwnerArgs({ orderId }));
  const recorded = order ? latestPaymentMilestone(order.milestones) : null;
  return (
    <AtelierSection
      id="payment"
      title="Payment"
      description={NO_CHECKOUT_SENTENCE}
      actions={
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.order(orderId)} />}
          nativeButton={false}
        >
          See your commission
        </Button>
      }
    >
      {order === undefined ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading the payment state">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : order === null ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your commission is not available to this browser or account. Sign in with the account that accepted the quote
          to see it.
        </p>
      ) : (
        <div className="space-y-4">
          <StatusLine tone={PAYMENT_TONES[order.payment.state]} live className="text-sm">
            {order.payment.stateLabel}
          </StatusLine>
          <OrderBook aria-label="Payment record">
            {order.payment.amountUsd !== null ? (
              <OrderBookRow
                label="Amount"
                value={<span className="tabular-nums">{formatUsd(order.payment.amountUsd)}</span>}
              />
            ) : null}
            {order.payment.confirmedAt !== null ? (
              <OrderBookRow label={PAYMENT_STATE_LABELS.confirmed} value={formatDateTime(order.payment.confirmedAt)} />
            ) : null}
            {order.payment.state !== "none" && order.payment.state !== "confirmed" && recorded ? (
              <OrderBookRow label={order.payment.stateLabel} value={formatDateTime(recorded.at)} />
            ) : null}
            {order.payment.state === "none" ? (
              <OrderBookRow
                label="Recorded"
                value="Nothing has been recorded against this commission yet."
                tone="muted"
              />
            ) : null}
            <OrderBookRow label="Commission" value={order.statusLabel} code={order._id} />
          </OrderBook>
        </div>
      )}
    </AtelierSection>
  );
}
