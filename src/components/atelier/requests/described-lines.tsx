import { Fragment } from "react";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { groupLines, lineKey } from "@/components/atelier/requests/case-words";
import type { DescribedLine } from "@convex/shared/atelier/spec";

/** A specification as the tailor's order book: grouped by garment part, production ids in mono. */
export function DescribedLinesBook({
  lines,
  "aria-label": ariaLabel,
}: {
  lines: readonly DescribedLine[];
  "aria-label"?: string;
}) {
  return (
    <OrderBook aria-label={ariaLabel}>
      {groupLines(lines).map((group) => (
        <Fragment key={group.section}>
          <OrderBookSection>{group.section}</OrderBookSection>
          {group.lines.map((line) => (
            <OrderBookRow key={lineKey(line)} label={line.label} value={line.value} code={line.productionId ?? null} />
          ))}
        </Fragment>
      ))}
    </OrderBook>
  );
}
