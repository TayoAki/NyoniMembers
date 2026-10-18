"use client";

import { Check, Plus } from "lucide-react";
import { ItemImage } from "@/components/common/item-image";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CatalogueEntryView } from "@convex/atelier/views";
import { CLOTH_WEIGHT_LABELS } from "@convex/shared/atelier/enums";
import { ShadeChip } from "./shade-chip";

export function clothPriceLine(cloth: Pick<CatalogueEntryView, "priceUsd">): string {
  return cloth.priceUsd !== undefined ? `From ${formatUsd(cloth.priceUsd)}` : "Price confirmed with your quote";
}

export function clothStockLine(cloth: Pick<CatalogueEntryView, "inStock">): string {
  return cloth.inStock ? "Available" : "Not in stock — ask your concierge";
}

type ClothCardProps = {
  cloth: CatalogueEntryView;
  selected: boolean;
  shortlisted: boolean;
  choosing: boolean;
  shortlistPending: boolean;
  /** The draft cannot be edited (sent to the house); the card still inspects. */
  locked: boolean;
  onInspect: () => void;
  onChoose: () => void;
  onToggleShortlist: () => void;
};

/** One cloth in the browser grid (S03): the mill-book photograph, the honest shade, and two actions. */
export function ClothCard({
  cloth,
  selected,
  shortlisted,
  choosing,
  shortlistPending,
  locked,
  onInspect,
  onChoose,
  onToggleShortlist,
}: ClothCardProps) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col border border-foreground/15 bg-background",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={onInspect}
        aria-label={`Inspect ${cloth.name}`}
        className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ItemImage
          src={cloth.imageUrl}
          alt={`Mill book of ${cloth.name}`}
          variant="photo"
          aspect="aspect-[3/4]"
          className="rounded-none"
        />
        <div className="space-y-1.5 p-3">
          <ShadeChip hex={cloth.hex} confirmed={cloth.shadeConfirmed} />
          <h3 className="font-display text-base leading-tight font-medium text-balance">{cloth.name}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {[cloth.mill, cloth.composition].filter(Boolean).join(" · ")}
          </p>
          {cloth.weight ? <p className="text-xs text-muted-foreground">{CLOTH_WEIGHT_LABELS[cloth.weight]}</p> : null}
          <p className="text-xs">{clothPriceLine(cloth)}</p>
          <StatusLine tone={cloth.inStock ? "success" : "warning"}>{clothStockLine(cloth)}</StatusLine>
        </div>
      </button>
      {selected ? (
        <StatusLine tone="gold" className="px-3 pb-2">
          Chosen for this design
        </StatusLine>
      ) : null}
      <div className="mt-auto grid grid-cols-2 border-t border-foreground/15">
        <Button
          variant={selected ? "secondary" : "ghost"}
          className="h-11 rounded-none px-2 text-xs"
          onClick={onChoose}
          disabled={selected || choosing || locked}
          aria-label={selected ? `${cloth.name} is chosen` : `Choose ${cloth.name}`}
        >
          {choosing ? (
            <Spinner data-icon="inline-start" aria-label="Choosing" />
          ) : selected ? (
            <Check data-icon="inline-start" aria-hidden />
          ) : null}
          {selected ? "Chosen" : "Choose"}
        </Button>
        <Button
          variant="ghost"
          className="h-11 rounded-none border-l border-foreground/15 px-2 text-xs"
          onClick={onToggleShortlist}
          disabled={shortlistPending || locked}
          aria-pressed={shortlisted}
          aria-label={shortlisted ? `Remove ${cloth.name} from the shortlist` : `Add ${cloth.name} to the shortlist`}
        >
          {shortlistPending ? (
            <Spinner data-icon="inline-start" aria-label="Updating shortlist" />
          ) : shortlisted ? (
            <Check data-icon="inline-start" aria-hidden />
          ) : (
            <Plus data-icon="inline-start" aria-hidden />
          )}
          {shortlisted ? "Shortlisted" : "Shortlist"}
        </Button>
      </div>
    </li>
  );
}
