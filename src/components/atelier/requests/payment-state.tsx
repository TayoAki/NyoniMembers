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

/**
 * S28 (conditional): only the payment state the house has recorded on the commission, in the enum's
 * words. There is no checkout here; "Payment confirmed" appears only when staff recorded it.
 */
export function PaymentState({ orderId }: { orderId: Id<"atelierOrders"> }) {
  const order = useQuery(api.atelier.orders.get, useOwnerArgs({ orderId }));
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
              <OrderBookRow label="Recorded" value={formatDateTime(order.payment.confirmedAt)} />
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
