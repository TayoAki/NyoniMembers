"use client";

import { Fragment, useRef, type CSSProperties, type ReactNode } from "react";
import { ItemImage } from "@/components/common/item-image";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatUsd, titleCase } from "@/lib/format";
import type { CatalogueEntryView, ClothSummary } from "@convex/atelier/views";
import { CLOTH_PATTERN_LABELS, CLOTH_WEIGHT_LABELS } from "@convex/shared/atelier/enums";
import { ShadeChip } from "./shade-chip";

export type CompareEntry = {
  summary: ClothSummary;
  /** The approved catalogue entry, or null when the house has withdrawn the cloth since it was shortlisted. */
  entry: CatalogueEntryView | null;
};

type CompareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CompareEntry[];
  selectedCode: string | null;
  choosingCode: string | null;
  locked: boolean;
  onChoose: (code: string) => void;
  onRemove: (code: string) => void;
};

const NOT_CONFIRMED = "Not confirmed";

/** Side-by-side comparison of the shortlist (S05): equal photographs, the same rows, missing values named as unconfirmed. */
export function CompareSheet({
  open,
  onOpenChange,
  entries,
  selectedCode,
  choosingCode,
  locked,
  onChoose,
  onRemove,
}: CompareSheetProps) {
  const isMobile = useIsMobile();
  const bodyRef = useRef<HTMLDivElement>(null);
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${Math.max(entries.length, 1)}, minmax(0, 1fr))` };

  const rows: { label: string; value: (entry: CompareEntry) => ReactNode }[] = [
    { label: "Composition", value: ({ entry }) => entry?.composition ?? NOT_CONFIRMED },
    { label: "Weight", value: ({ entry }) => (entry?.weight ? CLOTH_WEIGHT_LABELS[entry.weight] : NOT_CONFIRMED) },
    { label: "Pattern", value: ({ summary }) => CLOTH_PATTERN_LABELS[summary.pattern] },
    {
      label: "Seasons",
      value: ({ entry }) => (entry && entry.season.length > 0 ? entry.season.map(titleCase).join(", ") : NOT_CONFIRMED),
    },
    {
      label: "Price",
      value: ({ entry }) =>
        entry
          ? entry.priceUsd !== undefined
            ? `From ${formatUsd(entry.priceUsd)}`
            : "With your quote"
          : NOT_CONFIRMED,
    },
    {
      label: "Stock",
      value: ({ summary }) =>
        summary.status === "withdrawn" ? (
          <StatusLine tone="warning">No longer offered</StatusLine>
        ) : summary.inStock ? (
          <StatusLine tone="success">Available</StatusLine>
        ) : (
          <StatusLine tone="warning">Not in stock</StatusLine>
        ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col gap-0 p-0 data-[side=bottom]:h-[90dvh] data-[side=bottom]:rounded-t-none data-[side=right]:sm:max-w-2xl"
        initialFocus={bodyRef}
      >
        <SheetHeader className="border-b border-foreground/15 p-5 pr-14">
          <SheetTitle className="font-display text-2xl font-medium tracking-tight">Compare cloths</SheetTitle>
          <SheetDescription>
            The same photograph size and the same rows for each. Choosing one keeps the rest of your shortlist.
          </SheetDescription>
        </SheetHeader>
        <div ref={bodyRef} tabIndex={-1} className="flex-1 overflow-y-auto p-5 outline-none">
          {entries.length < 2 ? (
            <p className="text-sm text-muted-foreground">Shortlist two or more cloths to compare them.</p>
          ) : (
            <div role="table" aria-label="Shortlisted cloths compared" className="space-y-1">
              <div role="row" className="grid gap-3" style={columns}>
                {entries.map(({ summary, entry }) => (
                  <div role="columnheader" key={summary.code} className="flex min-w-0 flex-col gap-2">
                    <ItemImage
                      src={summary.imageUrl}
                      alt={`Mill book of ${summary.name}`}
                      variant="photo"
                      aspect="aspect-square"
                      className="rounded-none"
                    />
                    <ShadeChip hex={summary.hex} confirmed={summary.shadeConfirmed} words={false} size="md" />
                    <p className="font-display text-sm leading-tight font-medium text-balance">{summary.name}</p>
                    {summary.mill ? <p className="truncate text-xs text-muted-foreground">{summary.mill}</p> : null}
                    {!summary.shadeConfirmed ? (
                      <p className="text-[11px] leading-snug text-muted-foreground">representative shade</p>
                    ) : null}
                    {summary.code === selectedCode ? <StatusLine tone="gold">Chosen</StatusLine> : null}
                    <div className="mt-auto space-y-2 pt-1">
                      {entry && summary.status !== "withdrawn" ? (
                        <Button
                          variant={summary.code === selectedCode ? "secondary" : "default"}
                          className="h-11 w-full rounded-none px-2 text-xs"
                          onClick={() => onChoose(summary.code)}
                          disabled={summary.code === selectedCode || choosingCode !== null || locked}
                          aria-label={
                            summary.code === selectedCode ? `${summary.name} is chosen` : `Choose ${summary.name}`
                          }
                        >
                          {choosingCode === summary.code ? (
                            <Spinner data-icon="inline-start" aria-label="Choosing" />
                          ) : null}
                          {summary.code === selectedCode ? "Chosen" : "Choose"}
                        </Button>
                      ) : (
                        <p className="text-[11px] leading-snug text-muted-foreground">Cannot be newly ordered.</p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full rounded-none text-xs"
                        onClick={() => onRemove(summary.code)}
                        disabled={locked}
                        aria-label={`Remove ${summary.name} from the shortlist`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {rows.map((row) => (
                <Fragment key={row.label}>
                  <p
                    className="pt-4 pb-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
                    aria-hidden
                  >
                    {row.label}
                  </p>
                  <div role="row" className="grid gap-3 border-t border-foreground/10 pt-2" style={columns}>
                    {entries.map((entry) => (
                      <div role="cell" key={entry.summary.code} className="min-w-0 text-xs leading-relaxed break-words">
                        <span className="sr-only">{row.label}: </span>
                        {row.value(entry)}
                      </div>
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>
        <SheetFooter className="border-t border-foreground/15 p-5">
          <Button variant="outline" className="h-11 rounded-none" onClick={() => onOpenChange(false)}>
            Back to the book
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
