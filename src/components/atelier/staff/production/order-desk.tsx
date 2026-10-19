"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { SpecOrderBook } from "@/components/atelier/staff/case/case-design";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { formatDate, formatDateTime, formatUsd, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import { FIT_ROUTE_LABELS } from "@convex/shared/atelier/enums";
import { MilestoneForm } from "./milestone-form";
import { MilestoneTimeline } from "./milestone-timeline";
import { PaymentPanel } from "./payment-form";
import { OrderDeskSkeleton } from "./production-skeleton";
import { ORDER_STATUS_TONES, PAYMENT_STATE_TONES } from "./production-words";
import { ReleasePanel } from "./release-panel";
import { RiskForm } from "./risk-form";
import { ShippingPanel } from "./shipping-panel";

/** A05 detail (O05). `staffGet` reads a malformed or unknown id as null, which becomes the segment's not-found page. */
export function OrderDesk({ orderId }: { orderId: string }) {
  return (
    <StaffRoleGate
      role="operations"
      fallback={
        <StaffShell title="Commission">
          <OrderDeskSkeleton />
        </StaffShell>
      }
    >
      <OrderLoader orderId={orderId} />
    </StaffRoleGate>
  );
}

function OrderLoader({ orderId }: { orderId: string }) {
  const order = useQuery(api.atelier.orders.staffGet, { orderId });
  if (order === undefined) {
    return (
      <StaffShell title="Commission">
        <OrderDeskSkeleton />
      </StaffShell>
    );
  }
  if (order === null) notFound();
  return <OrderDeskView order={order} />;
}

/** Pure composition: give it the staff order view and it renders deterministically. */
export function OrderDeskView({ order }: { order: StaffOrderView }) {
  const readiness = order.eventReadiness;
  return (
    <StaffShell
      title={`${order.clientName} · commission`}
      description={`${order.statusLabel} · ${order.payment.stateLabel}${order.quoteVersion !== null ? ` · quote v${order.quoteVersion}` : ""}${order.totalUsd !== null ? ` · ${formatUsd(order.totalUsd)}` : ""}.`}
    >
      <div className="space-y-2">
        <AtelierSection
          id="commission"
          title="Commission"
          description="The facts as the client reads them, plus the references only the house holds."
        >
          <OrderBook>
            <OrderBookRow
              label="Status"
              value={<StatusLine tone={ORDER_STATUS_TONES[order.status]}>{order.statusLabel}</StatusLine>}
              note="The client reads the same words."
            />
            <OrderBookRow
              label="Payment"
              value={
                <StatusLine tone={PAYMENT_STATE_TONES[order.payment.state]}>{order.payment.stateLabel}</StatusLine>
              }
              note={
                order.payment.amountUsd !== null
                  ? `${formatUsd(order.payment.amountUsd)}${order.paymentReference ? ` · ${order.paymentReference}` : ""}`
                  : undefined
              }
            />
            <OrderBookRow
              label="Client"
              value={order.clientName}
              note={
                order.clientEmail ? (
                  <a
                    href={`mailto:${order.clientEmail}`}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    {order.clientEmail}
                  </a>
                ) : (
                  "Owned by a browser, not an account."
                )
              }
            />
            <OrderBookRow
              label="Quote"
              value={
                order.quoteVersion !== null
                  ? `Version ${order.quoteVersion}${order.totalUsd !== null ? ` · ${formatUsd(order.totalUsd)}` : ""}`
                  : "Not available"
              }
              action={
                <Link href={routes.staffAtelier.case(order.caseId)} className="text-sm underline underline-offset-4">
                  Open the request
                </Link>
              }
            />
            <OrderBookRow
              label="Design"
              value={order.summary}
              code={order.specHash.slice(0, 12)}
              note={
                order.cloth
                  ? `${order.cloth.name}${order.cloth.mill ? ` · ${order.cloth.mill}` : ""}${order.cloth.shadeConfirmed ? "" : " · representative shade"}`
                  : "No cloth on the specification."
              }
            />
            <OrderBookRow
              label="Fit"
              value={
                order.fitProfileVersion !== null ? `Fit profile v${order.fitProfileVersion}` : "No approved fit profile"
              }
              tone={order.fitProfileVersion !== null ? "default" : "warning"}
              note={order.fitRoute ? FIT_ROUTE_LABELS[order.fitRoute] : "No fit route recorded."}
            />
            <OrderBookRow
              label="Event"
              value={order.eventDate !== null ? formatDate(order.eventDate) : "No date given"}
              tone={
                readiness.state === "tight" || readiness.state === "unlikely"
                  ? "warning"
                  : order.eventDate !== null
                    ? "default"
                    : "muted"
              }
              note={readiness.state !== "none" ? readiness.copy : undefined}
            />
            <OrderBookRow
              label="Estimated ready"
              value={
                order.estimatedReadyAt !== null ? `${formatDate(order.estimatedReadyAt)} · Estimate` : "No estimate"
              }
              tone={order.estimatedReadyAt !== null ? "default" : "muted"}
            />
            {order.riskNote ? (
              <OrderBookRow
                label="Risk note"
                value={<span className="whitespace-pre-wrap">{order.riskNote}</span>}
                tone="warning"
              />
            ) : null}
            <OrderBookRow
              label="Maker"
              value={order.makerRef ? <Mono upper={false}>{order.makerRef}</Mono> : "Not released"}
              tone={order.makerRef ? "default" : "muted"}
              note={
                order.releasedAt !== null
                  ? `Released ${formatDateTime(order.releasedAt)}${order.releasedBy ? ` by ${order.releasedBy}` : ""}.`
                  : undefined
              }
            />
            <OrderBookRow
              label="Corrections"
              value={order.corrections.length === 0 ? "None" : pluralize(order.corrections.length, "correction")}
              tone={order.corrections.length === 0 ? "muted" : "default"}
              note={
                order.corrections.length > 0 ? (
                  <span className="flex flex-col gap-0.5">
                    {order.corrections.map((correction) => (
                      <Link
                        key={correction.correctionId}
                        href={routes.staffAtelier.correction(correction.correctionId)}
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        {correction.kindLabel} · {correction.statusLabel} · {formatDate(correction.createdAt)}
                      </Link>
                    ))}
                  </span>
                ) : undefined
              }
            />
            <OrderBookRow
              label="Receipt"
              value={<Mono upper={false}>{order._id}</Mono>}
              note={`Opened ${formatDateTime(order.createdAt)}.`}
            />
          </OrderBook>
        </AtelierSection>

        <AtelierSection
          id="release"
          title="Preflight and release"
          description="What stands between this commission and the cutter. Release sends the immutable package with the production ids below."
        >
          <ReleasePanel order={order} />
        </AtelierSection>

        <AtelierSection
          id="payment"
          title="Payment"
          description="Recorded from the house's payment system with its reference. There is no checkout here."
        >
          <PaymentPanel order={order} />
        </AtelierSection>

        <AtelierSection
          id="specification"
          title="Specification"
          description={`The order book frozen at acceptance, with the production ids the maker receives${order.fitProfileVersion !== null ? `, cut against fit profile v${order.fitProfileVersion}` : ""}. It never changes on this row.`}
        >
          <SpecOrderBook lines={order.lines} />
        </AtelierSection>

        <AtelierSection
          id="milestones"
          title="Milestones"
          description="The client's timeline. Facts move the commission; estimates carry the word “Estimate”."
        >
          <div className="space-y-8">
            <MilestoneTimeline milestones={order.milestones} />
            <MilestoneForm order={order} />
          </div>
        </AtelierSection>

        <AtelierSection
          id="shipping"
          title="Shipping and delivery"
          description="Shipped is not fitted. Delivery opens the client's fit review; only they accept the fit."
        >
          <ShippingPanel order={order} />
        </AtelierSection>

        <AtelierSection
          id="risk"
          title="Risk to the date"
          description="When the event date is at risk, tell the client honestly on their request."
        >
          <RiskForm order={order} />
        </AtelierSection>
      </div>
    </StaffShell>
  );
}
