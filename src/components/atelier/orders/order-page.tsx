"use client";

import { useQuery } from "convex/react";
import { notFound } from "next/navigation";
import { useRef, useState } from "react";
import { AftercareSection } from "@/components/atelier/aftercare/aftercare-section";
import { isAftercareKind, type CorrectionIntent } from "@/components/atelier/aftercare/aftercare-words";
import { PolicySection } from "@/components/atelier/aftercare/policy-section";
import { FirstFitChecklist } from "@/components/atelier/orders/first-fit-checklist";
import { MilestoneTimeline } from "@/components/atelier/orders/milestone-timeline";
import { OrderBoundary } from "@/components/atelier/orders/order-boundary";
import { OrderNotFound } from "@/components/atelier/orders/order-not-found";
import { OrderSkeleton } from "@/components/atelier/orders/order-skeleton";
import { OrderSpecification } from "@/components/atelier/orders/order-specification";
import { OrderStatus } from "@/components/atelier/orders/order-status";
import { looksLikeOrderId, showsFirstFit } from "@/components/atelier/orders/order-words";
import { Reorder } from "@/components/atelier/orders/reorder";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { OrderView } from "@convex/atelier/orders";
import type { CorrectionKind, FitRegion } from "@convex/shared/atelier/enums";

/**
 * S29–S33 (C22–C26): one commission. Production and its risks, the first-fit checklist once the suit is
 * in hand, aftercare, what the published policy allows, the frozen specification, and the reorder.
 * Unknown, malformed or someone else's ids are not found.
 */
export function OrderPage({ orderId }: { orderId: string }) {
  if (!looksLikeOrderId(orderId)) notFound();
  return (
    <OrderBoundary fallback={<OrderNotFound />}>
      {/* The shape was checked above; the server refuses an id of another table and the boundary renders not-found. */}
      <OrderLoader orderId={orderId as Id<"atelierOrders">} />
    </OrderBoundary>
  );
}

function OrderLoader({ orderId }: { orderId: Id<"atelierOrders"> }) {
  const order = useQuery(api.atelier.orders.get, useOwnerArgs({ orderId }));
  if (order === undefined) return <OrderSkeleton />;
  // Inline, not notFound(): the subscription stays live, so the account's answer can replace it.
  if (order === null) return <OrderNotFound />;
  return <OrderDetail order={order} />;
}

function OrderDetail({ order }: { order: OrderView }) {
  const corrections = useQuery(api.atelier.corrections.listForOrder, useOwnerArgs({ orderId: order._id }));
  const [intent, setIntent] = useState<CorrectionIntent | null>(null);
  const aftercareRef = useRef<HTMLDivElement>(null);
  const policyRef = useRef<HTMLDivElement>(null);

  function openForm(kind: CorrectionKind, region: FitRegion | null = null) {
    setIntent((prev) => ({ key: (prev?.key ?? 0) + 1, kind, region }));
    const target = isAftercareKind(kind) ? aftercareRef : policyRef;
    requestAnimationFrame(() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="space-y-8 pt-6">
      <OrderStatus order={order} />
      <MilestoneTimeline milestones={order.milestones} />
      {showsFirstFit(order.status) ? (
        <FirstFitChecklist order={order} onRaiseIssue={(region) => openForm("alteration", region)} />
      ) : null}
      <AftercareSection
        ref={aftercareRef}
        order={order}
        corrections={corrections}
        intent={intent}
        onOpenForm={(kind) => openForm(kind)}
        onCloseForm={() => setIntent(null)}
      />
      <PolicySection
        ref={policyRef}
        order={order}
        corrections={corrections}
        intent={intent}
        onOpenForm={(kind) => openForm(kind)}
        onCloseForm={() => setIntent(null)}
      />
      <OrderSpecification order={order} />
      <Reorder order={order} />
    </div>
  );
}
