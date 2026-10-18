import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { ShadeChip } from "@/components/atelier/entry/shade-chip";
import { SuitFigure } from "@/components/atelier/studio/suit-figure";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { SharedDesignView } from "@convex/atelier/shares";
import { OCCASION_LABELS } from "@convex/shared/atelier/enums";
import type { DescribedLine } from "@convex/shared/atelier/spec";

const SECTION_ORDER: readonly DescribedLine["section"][] = [
  "Garment",
  "Cloth",
  "Jacket",
  "Trousers",
  "Waistcoat",
  "Details",
];

function groupLines(lines: readonly DescribedLine[]): { section: DescribedLine["section"]; lines: DescribedLine[] }[] {
  return SECTION_ORDER.map((section) => ({ section, lines: lines.filter((line) => line.section === section) })).filter(
    (group) => group.lines.length > 0,
  );
}

/**
 * S17: a design as a recipient sees it. The studio illustration in the cloth's shade and the order
 * book, read-only. No contact, photographs or measurements exist in this view by construction.
 */
export function SharedDesign({ design }: { design: SharedDesignView }) {
  const { cloth } = design;
  const groups = groupLines(design.lines);
  return (
    <article className="space-y-10 pt-6 pb-8">
      <header className="space-y-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Shared design · read-only
        </p>
        <DisplayLine>{design.name}</DisplayLine>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {design.occasion ? <span>{OCCASION_LABELS[design.occasion]}</span> : null}
          {design.occasion ? <span aria-hidden>·</span> : null}
          <span>Designed {formatDate(design.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>Link open until {formatDate(design.expiresAt)}</span>
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <figure className="flex flex-col items-center gap-4 lg:col-span-5">
          <div className="flex h-[48svh] max-h-[560px] w-full items-center justify-center lg:sticky lg:top-24">
            <SuitFigure spec={design.spec} hex={cloth?.hex ?? null} pattern={cloth?.pattern} className="h-full" />
          </div>
          <figcaption className="flex flex-col items-center gap-1 text-center">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Studio illustration
            </span>
            {cloth ? (
              <>
                <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm">
                  <ShadeChip hex={cloth.hex} size="sm" />
                  <span className="font-display">{cloth.name}</span>
                  {cloth.mill ? <span className="text-muted-foreground">· {cloth.mill}</span> : null}
                </span>
                {!cloth.shadeConfirmed ? (
                  <span className="text-xs text-muted-foreground">Representative shade</span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No cloth chosen yet</span>
            )}
          </figcaption>
        </figure>

        <div className="space-y-6 lg:col-span-7">
          <OrderBook aria-label="The design">
            {groups.map((group) => (
              <div key={group.section} className="py-1">
                <OrderBookSection>{group.section}</OrderBookSection>
                {group.lines.map((line) => (
                  <OrderBookRow
                    key={`${group.section}-${line.label}`}
                    label={line.label}
                    value={line.value}
                    code={line.productionId}
                    note={
                      line.section === "Cloth" && cloth && !cloth.shadeConfirmed
                        ? "Representative shade until the house confirms it against the cloth."
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </OrderBook>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This page shows the design only. Contact details, photographs and measurements are never part of a shared
            link, and nothing here can change the owner&rsquo;s draft.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-none px-5"
              render={<Link href={routes.atelier.home} />}
              nativeButton={false}
            >
              Design your own suit
            </Button>
            <Mono>Nyoni Atelier</Mono>
          </div>
        </div>
      </div>
    </article>
  );
}
