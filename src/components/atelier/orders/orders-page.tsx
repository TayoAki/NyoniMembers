"use client";

import { useQuery } from "convex/react";
import { Package } from "lucide-react";
import Link from "next/link";
import { OrderRow } from "@/components/atelier/orders/order-row";
import { OrdersSkeleton } from "@/components/atelier/orders/orders-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

/**
 * S29 list (C22): every commission this browser or account holds, most recent activity first. A
 * commission exists once a quote is accepted; its words are the house's real stages, never a promise.
 */
export function OrdersPage() {
  const orders = useQuery(api.atelier.orders.listMine, useOwnerArgs({}));
  if (orders === undefined) return <OrdersSkeleton />;

  const empty = orders.length === 0;
  const designButton = (
    <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
      Design a suit
    </Button>
  );

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your commissions."
        description="Every suit the house is making or has made for you: release, making, shipping, your fit review and any aftercare. Estimated dates say so, shipped is not fitted, and a refund approved is not yet returned."
        actions={empty ? undefined : designButton}
      />
      {empty ? (
        <EmptyState
          icon={Package}
          title="Your commissions will appear here"
          description="When you accept a quote, the commission is tracked here from release to your fit review, with every stage dated and sourced."
          action={designButton}
          className="rounded-none"
        />
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your commissions">
          {orders.map((order) => (
            <OrderRow key={order._id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}
