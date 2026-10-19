"use client";

import Link from "next/link";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ESTIMATE_WORD, garmentWords, ORDER_TONES } from "@/components/atelier/orders/order-words";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { OrderSummaryView } from "@convex/atelier/orders";

/** One commission in the list: the cloth and cut, the truthful status and payment words, and its dates. */
export function OrderRow({ order }: { order: OrderSummaryView }) {
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-medium">
            {order.clothName ? <span className="font-display text-lg">{order.clothName}</span> : "Your suit"}
          </h2>
          <span className="text-sm text-muted-foreground">{garmentWords(order.summary, order.clothName)}</span>
        </div>
        <StatusLine tone={ORDER_TONES[order.status]}>{order.statusLabel}</StatusLine>
        <p className="text-sm text-muted-foreground">{order.paymentStateLabel}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {order.eventDate !== null ? <span>For {formatDate(order.eventDate)}</span> : null}
          {order.estimatedReadyAt !== null ? (
            <span>
              Ready {formatDate(order.estimatedReadyAt)} <Mono>{ESTIMATE_WORD}</Mono>
            </span>
          ) : null}
          {order.releasedAt !== null ? (
            <span>Released {formatDate(order.releasedAt)}</span>
          ) : (
            <span>Quote accepted {formatDate(order.createdAt)}</span>
          )}
          <Mono upper={false}>{order._id}</Mono>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.order(order._id)} />}
          nativeButton={false}
        >
          Open
        </Button>
      </div>
    </li>
  );
}
