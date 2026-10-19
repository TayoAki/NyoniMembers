"use client";

import { useRef, useState } from "react";
import { ItemImage } from "@/components/common/item-image";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { titleCase } from "@/lib/format";
import type { CatalogueEntryView } from "@convex/atelier/views";
import type { Id } from "@convex/_generated/dataModel";
import {
  ATELIER_LIMITS,
  CLOTH_PATTERN_LABELS,
  CLOTH_WEIGHT_LABELS,
  OCCASION_LABELS,
} from "@convex/shared/atelier/enums";
import { clothPriceLine, clothStockLine } from "./cloth-card";
import { SampleRequestForm } from "./sample-request-form";
import { ShadeChip } from "./shade-chip";

type ClothSheetProps = {
  /** The cloth being inspected; null closes the sheet. */
  cloth: CatalogueEntryView | null;
  onClose: () => void;
  draftId: Id<"atelierDrafts">;
  selected: boolean;
  shortlisted: boolean;
  shortlistFull: boolean;
  choosing: boolean;
  shortlistPending: boolean;
  locked: boolean;
  onChoose: () => void;
  onToggleShortlist: () => void;
};

const NOT_CONFIRMED = "Not confirmed";

/**
 * The inspection sheet (S04): the mill-book photograph large, the verified facts as order-book rows,
 * and the three actions. It is an overlay over the browser, so filters and scroll position survive;
 * closing it changes nothing in the draft.
 */
export function ClothSheet({
  cloth,
  onClose,
  draftId,
  selected,
  shortlisted,
  shortlistFull,
  choosing,
  shortlistPending,
  locked,
  onChoose,
  onToggleShortlist,
}: ClothSheetProps) {
  const isMobile = useIsMobile();
  // Focus lands on the scroll body, not the first button, so the sheet opens at the photograph.
  const bodyRef = useRef<HTMLDivElement>(null);
  // Keep the last cloth while the sheet animates closed, so the content does not vanish mid-transition.
  const [shown, setShown] = useState(cloth);
  if (cloth && cloth !== shown) setShown(cloth);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleFor, setSampleFor] = useState<string | null>(null);
  if (cloth && sampleFor !== cloth.code) {
    setSampleFor(cloth.code);
    setSampleOpen(false);
  }

  // A full shortlist asks which cloth to replace in a dialog of its own, opened once this sheet has closed.
  const afterClose = useRef<(() => void) | null>(null);
  const replacing = !shortlisted && shortlistFull;

  const open = cloth !== null;
  const entry = cloth ?? shown;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      onOpenChangeComplete={(next) => {
        const then = afterClose.current;
        afterClose.current = null;
        if (!next && then) then();
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col gap-0 p-0 data-[side=bottom]:h-[92dvh] data-[side=bottom]:rounded-t-none data-[side=right]:sm:max-w-xl"
        initialFocus={bodyRef}
      >
        {entry ? (
          <>
            <SheetHeader className="border-b border-foreground/15 p-5 pr-14">
              {entry.mill ? <p className="text-xs text-muted-foreground">{entry.mill}</p> : null}
              <SheetTitle className="font-display text-2xl leading-tight font-medium tracking-tight text-balance">
                {entry.name}
              </SheetTitle>
              <SheetDescription>{entry.description}</SheetDescription>
            </SheetHeader>
            <div ref={bodyRef} tabIndex={-1} className="flex-1 space-y-6 overflow-y-auto p-5 outline-none">
              <figure className="space-y-2">
                <ItemImage
                  src={entry.imageUrl}
                  alt={`Mill book of ${entry.name}`}
                  variant="photo"
                  aspect="aspect-[4/3]"
                  className="rounded-none"
                  priority
                />
                <figcaption className="text-xs text-muted-foreground">
                  The mill book as the house photographs it, not a flat swatch.
                </figcaption>
              </figure>

              <OrderBook>
                <OrderBookRow
                  label="Supplier reference"
                  value={
                    entry.supplierRef ? (
                      <Mono upper={false} className="text-foreground">
                        {entry.supplierRef}
                      </Mono>
                    ) : (
                      NOT_CONFIRMED
                    )
                  }
                />
                <OrderBookRow label="Composition" value={entry.composition ?? NOT_CONFIRMED} />
                <OrderBookRow label="Weight" value={entry.weight ? CLOTH_WEIGHT_LABELS[entry.weight] : NOT_CONFIRMED} />
                <OrderBookRow label="Pattern" value={CLOTH_PATTERN_LABELS[entry.pattern]} />
                <OrderBookRow
                  label="Seasons"
                  value={entry.season.length > 0 ? entry.season.map(titleCase).join(", ") : NOT_CONFIRMED}
                />
                <OrderBookRow
                  label="Occasions"
                  value={
                    entry.occasions.length > 0
                      ? entry.occasions.map((occasion) => OCCASION_LABELS[occasion]).join(", ")
                      : NOT_CONFIRMED
                  }
                />
                <OrderBookRow
                  label="Shade"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <ShadeChip hex={entry.hex} confirmed={entry.shadeConfirmed} words={false} size="md" />
                      <span>{titleCase(entry.colour)}</span>
                    </span>
                  }
                  note={
                    entry.shadeConfirmed
                      ? "Confirmed by the house against the real cloth."
                      : "Representative shade: it fills the studio figure, but only the real cloth, at a fitting or as a sample, shows the true colour."
                  }
                />
                <OrderBookRow
                  label="Price"
                  value={clothPriceLine(entry)}
                  note={
                    entry.priceUsd !== undefined
                      ? "For a suit in this cloth, as the house lists it; your quote confirms the figure."
                      : undefined
                  }
                />
                <OrderBookRow
                  label="Stock"
                  value={<StatusLine tone={entry.inStock ? "success" : "warning"}>{clothStockLine(entry)}</StatusLine>}
                />
              </OrderBook>

              <section aria-labelledby="sample-title" className="space-y-3 border-t border-foreground/15 pt-5">
                <h3 id="sample-title" className="text-base font-medium">
                  A sample by post
                </h3>
                {entry.sampleAvailable ? (
                  sampleOpen ? (
                    <SampleRequestForm clothCode={entry.code} clothName={entry.name} draftId={draftId} />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        The house can send a cutting of this cloth. It is a separate request, confirmed by a concierge;
                        it does not order a suit.
                      </p>
                      <Button variant="outline" className="h-11 rounded-none px-5" onClick={() => setSampleOpen(true)}>
                        Request a sample
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A sample of this cloth is not available to send at the moment. Ask your concierge if you would like
                    to see it.
                  </p>
                )}
              </section>
            </div>
            <SheetFooter className="gap-3 border-t border-foreground/15 p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="h-11 flex-1 rounded-none px-5"
                  onClick={onChoose}
                  disabled={selected || choosing || locked}
                >
                  {choosing ? <Spinner data-icon="inline-start" aria-label="Choosing" /> : null}
                  {selected ? "Chosen for this design" : "Choose this cloth"}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-none px-5"
                  onClick={() => {
                    if (!replacing) return onToggleShortlist();
                    afterClose.current = onToggleShortlist;
                    onClose();
                  }}
                  disabled={shortlistPending || locked}
                  aria-pressed={shortlisted}
                >
                  {shortlistPending ? <Spinner data-icon="inline-start" aria-label="Updating shortlist" /> : null}
                  {shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                </Button>
              </div>
              {replacing && !locked ? (
                <p className="text-xs text-muted-foreground">
                  Your shortlist holds {ATELIER_LIMITS.shortlistMax} cloths; adding this one asks which to replace.
                </p>
              ) : null}
              {locked ? (
                <p className="text-xs text-muted-foreground">
                  This design has been sent to the house; its cloth changes through your concierge.
                </p>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
