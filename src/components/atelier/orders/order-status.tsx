"use client";

import Link from "next/link";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ESTIMATE_WORD, garmentWords, ORDER_TONES, statusSentence } from "@/components/atelier/orders/order-words";
import { NO_CHECKOUT_SENTENCE, PAYMENT_TONES } from "@/components/atelier/requests/case-words";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { OrderView } from "@convex/atelier/orders";

/**
 * S29 header: the commission, its real status with one sentence on what that means, the payment words
 * as recorded, shipping facts, the event date against the house's making time, and the staff's risk
 * note. Every date the house has not confirmed carries the word "Estimate".
 */
export function OrderStatus({ order }: { order: OrderView }) {
  const readiness = order.eventReadiness;
  const attention = readiness.state === "tight" || readiness.state === "unlikely";
  return (
    <>
      <PageHeader
        title="Your commission."
        description={
          <>
            {garmentWords(order.summary, order.cloth?.name)}
            {" · quote accepted "}
            {formatDate(order.createdAt)}
          </>
        }
        actions={
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.orders} />}
            nativeButton={false}
          >
            All commissions
          </Button>
        }
      />

      <section aria-label="Status" className="space-y-4 border-y border-foreground/15 py-5">
        {order.cloth ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 translate-y-px border border-foreground/20"
              style={{ backgroundColor: order.cloth.hex }}
            />
            <p className="font-display text-2xl leading-tight font-medium tracking-[-0.01em] sm:text-3xl">
              {order.cloth.name}
            </p>
            {order.cloth.mill ? <span className="text-sm text-muted-foreground">{order.cloth.mill}</span> : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <StatusLine tone={ORDER_TONES[order.status]} live className="text-sm">
            {order.statusLabel}
          </StatusLine>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{statusSentence(order)}</p>
          {order.carrier && order.trackingRef ? (
            <p className="max-w-2xl text-sm leading-relaxed">
              Shipped with {order.carrier}
              {order.shippedAt !== null ? ` on ${formatDate(order.shippedAt)}` : ""} · tracking{" "}
              <Mono upper={false} className="text-foreground">
                {order.trackingRef}
              </Mono>
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <StatusLine tone={PAYMENT_TONES[order.payment.state]} className="text-sm">
            {order.payment.stateLabel}
            {order.payment.amountUsd !== null ? ` · ${formatUsd(order.payment.amountUsd)}` : ""}
          </StatusLine>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{NO_CHECKOUT_SENTENCE}</p>
        </div>

        {order.eventDate !== null || order.estimatedReadyAt !== null || order.riskNote ? (
          <div className="max-w-2xl space-y-1.5 text-sm leading-relaxed">
            {order.eventDate !== null ? (
              <p className={cn(attention ? "text-warning" : "text-muted-foreground")}>
                Your date is {formatDate(order.eventDate)}.{readiness.copy ? ` ${readiness.copy}` : ""}
              </p>
            ) : null}
            {order.estimatedReadyAt !== null ? (
              <p className="text-muted-foreground">
                Ready {formatDate(order.estimatedReadyAt)} <Mono>{ESTIMATE_WORD}</Mono> — an estimate, not a promise,
                until the house confirms it.
              </p>
            ) : null}
            {order.riskNote ? (
              <p className="text-warning">The house has noted a risk to your date: {order.riskNote}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.request(order.caseId)} />}
            nativeButton={false}
          >
            Ask your concierge
          </Button>
          <span className="text-xs text-muted-foreground">
            Commission <Mono upper={false}>{order._id}</Mono>
          </span>
        </div>
      </section>
    </>
  );
}
