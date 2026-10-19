import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { DescribedLinesBook } from "@/components/atelier/requests/described-lines";
import { formatDate, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { OrderView } from "@convex/atelier/orders";
import { FIT_ROUTE_LABELS } from "@convex/shared/atelier/enums";

/** The specification frozen at acceptance, as the cutter reads it, with the fit profile version it is cut to. */
export function OrderSpecification({ order }: { order: OrderView }) {
  return (
    <AtelierSection
      id="specification"
      title="The specification"
      description="Frozen when you accepted the quote; the codes in mono are what the cutter reads. A change after release is a new proposal on your request, never an edit here."
    >
      <div className="space-y-6">
        <DescribedLinesBook lines={order.lines} aria-label="The specification of your commission" />
        <OrderBook aria-label="Fit and quote">
          <OrderBookRow
            label="Fit profile"
            value={
              order.fitProfileVersion !== null
                ? `Version ${order.fitProfileVersion}`
                : order.fitRoute === "atelier"
                  ? "Measured at a showroom"
                  : "Not recorded"
            }
            note={
              order.fitProfileVersion !== null
                ? "The profile this suit is cut to. A later profile never rewrites it."
                : null
            }
          />
          {order.fitRoute ? <OrderBookRow label="Fit route" value={FIT_ROUTE_LABELS[order.fitRoute]} /> : null}
          <OrderBookRow
            label="Quote"
            value={
              <>
                {order.quoteVersion !== null ? `Version ${order.quoteVersion}` : "Accepted"}
                {order.totalUsd !== null ? ` · ${formatUsd(order.totalUsd)}` : ""}
              </>
            }
            code={order.quoteId}
            action={
              <Link href={routes.atelier.request(order.caseId)} className="text-sm underline underline-offset-4">
                See the request
              </Link>
            }
          />
          <OrderBookRow label="Accepted" value={formatDate(order.createdAt)} code={order._id} />
          {order.releasedAt !== null ? <OrderBookRow label="Released" value={formatDate(order.releasedAt)} /> : null}
        </OrderBook>
      </div>
    </AtelierSection>
  );
}
