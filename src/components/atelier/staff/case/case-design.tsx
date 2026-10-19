import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { formatDateTime } from "@/lib/format";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { DescribedLine } from "@convex/shared/atelier/spec";

/** Groups described lines by their garment part, in the order the review step uses. */
export function groupLines(
  lines: readonly DescribedLine[],
): { section: DescribedLine["section"]; lines: DescribedLine[] }[] {
  const groups: { section: DescribedLine["section"]; lines: DescribedLine[] }[] = [];
  for (const line of lines) {
    const group = groups.find((entry) => entry.section === line.section);
    if (group) group.lines.push(line);
    else groups.push({ section: line.section, lines: [line] });
  }
  return groups;
}

/** The order book of a specification: the same lines, labels and production ids the client reviewed. */
export function SpecOrderBook({
  lines,
  highlight,
}: {
  lines: readonly DescribedLine[];
  highlight?: ReadonlySet<string>;
}) {
  return (
    <OrderBook>
      {groupLines(lines).map((group) => (
        <div key={group.section}>
          <OrderBookSection>{group.section}</OrderBookSection>
          {group.lines.map((line) => (
            <OrderBookRow
              key={`${line.section}:${line.label}`}
              label={line.label}
              value={line.value}
              code={line.productionId ?? null}
              className={highlight?.has(`${line.section}:${line.label}`) ? "bg-primary/5" : undefined}
            />
          ))}
        </div>
      ))}
    </OrderBook>
  );
}

/**
 * The submitted design: the revision the client sent, frozen. When the live design has moved on, say so
 * plainly, because a quote prices the submitted revision only and a proposal is made against the live one.
 */
export function DesignSection({ caseView }: { caseView: StaffCaseView }) {
  const revision = caseView.revision;
  if (!revision) {
    return (
      <AtelierSection
        id="design"
        title="Design"
        description="This request carries no design. A sample, a fitting or a question stands on its own."
      >
        {caseView.draft ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            It is linked to the client&rsquo;s design “{caseView.draft.name}” (live revision {caseView.draft.revision}),
            which has not been submitted for review or pricing.
          </p>
        ) : null}
      </AtelierSection>
    );
  }
  const movedOn = caseView.draftRevision !== null && caseView.draftRevision !== revision.revision;
  return (
    <AtelierSection
      id="design"
      title={
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          Submitted design
          <Mono>revision {revision.revision}</Mono>
        </span>
      }
      description={`Frozen when the client sent it, ${formatDateTime(revision.createdAt)}. Production ids are the ones the cutter reads.`}
    >
      {movedOn ? (
        <p className="mb-5 text-sm leading-relaxed text-warning">
          The client&rsquo;s design has since moved to revision {caseView.draftRevision}. A quote prices this submitted
          revision only; the client must send the design again, or accept a proposal that changes it, before the new
          design can be priced.
        </p>
      ) : null}
      <SpecOrderBook lines={revision.lines} />
    </AtelierSection>
  );
}
