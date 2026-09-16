"use client";

import { Lock, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { ItemImage } from "@/components/common/item-image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Item as WardrobeItem } from "@/hooks/use-items";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import { SLOT_LABELS, type Slot } from "@convex/shared/wardrobe";

type SlotCardProps = {
  slot: Slot;
  /** The items currently in this slot: at most one, or several for accessories. */
  items: WardrobeItem[];
  multiple?: boolean;
  /** When set the slot is unavailable; the reason is shown in a tooltip. */
  lockedReason?: string;
  onOpen: () => void;
  onRemove: (itemId: Id<"items">) => void;
  className?: string;
};

/** One tappable slot on the builder board. Tap opens the picker; filled slots can be cleared in place. */
export function SlotCard({ slot, items, multiple = false, lockedReason, onOpen, onRemove, className }: SlotCardProps) {
  const label = SLOT_LABELS[slot];
  const locked = Boolean(lockedReason);

  const card = (
    <div
      className={cn(
        "bg-card flex flex-col gap-2 rounded-xl border p-2 transition-colors",
        locked && "opacity-60",
        multiple && "col-span-full",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {locked ? <Lock className="size-3" aria-hidden /> : null}
          {label}
        </span>
        {items.length > 0 ? <span className="text-muted-foreground text-xs tabular-nums">{items.length}</span> : null}
      </div>

      {multiple ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item._id} className="relative">
              <ItemImage src={item.url} alt={item.name} aspect="aspect-square" className="size-20 rounded-lg p-1.5" />
              <RemoveButton label={`Remove ${item.name}`} onClick={() => onRemove(item._id)} />
            </div>
          ))}
          <SlotButton locked={locked} onOpen={onOpen} label={label} className="size-20">
            <Placeholder label={items.length > 0 ? "Add" : label} compact />
          </SlotButton>
        </div>
      ) : items[0] ? (
        <div className="relative">
          <SlotButton locked={locked} onOpen={onOpen} label={label}>
            <ItemImage src={items[0].url} alt={items[0].name} aspect="aspect-[3/4]" className="w-full rounded-lg" />
          </SlotButton>
          <RemoveButton label={`Clear ${label}`} onClick={() => onRemove(items[0]._id)} />
          <p className="text-muted-foreground mt-1.5 line-clamp-1 px-1 text-xs">{items[0].name}</p>
        </div>
      ) : (
        <SlotButton locked={locked} onOpen={onOpen} label={label} className="aspect-[3/4]">
          <Placeholder label={label} />
        </SlotButton>
      )}
    </div>
  );

  if (!lockedReason) return card;
  return (
    <Tooltip>
      <TooltipTrigger render={<div className={cn(multiple && "col-span-full")} />}>{card}</TooltipTrigger>
      <TooltipContent>{lockedReason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Locked slots stay focusable and keep `aria-disabled` rather than `disabled`, so the tooltip
 * explaining why still reaches keyboard and pointer users.
 */
function SlotButton({
  locked,
  onOpen,
  label,
  className,
  children,
}: {
  locked: boolean;
  onOpen: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-disabled={locked || undefined}
      aria-label={`Choose ${label.toLowerCase()}`}
      onClick={() => {
        if (!locked) onOpen();
      }}
      className={cn(
        "focus-visible:ring-ring block w-full rounded-lg text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        locked ? "cursor-not-allowed" : "hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Placeholder({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "bg-muted/30 text-muted-foreground flex size-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed",
        compact ? "gap-1 text-[11px]" : "text-xs",
      )}
    >
      <Plus className={compact ? "size-4" : "size-5"} aria-hidden />
      <span className="px-1 text-center leading-tight">{label}</span>
    </span>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bg-background/90 text-muted-foreground ring-foreground/10 hover:text-foreground focus-visible:ring-ring absolute top-1 right-1 flex size-6 items-center justify-center rounded-full ring-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}
