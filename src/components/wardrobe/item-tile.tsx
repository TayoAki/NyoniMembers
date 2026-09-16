"use client";

import { Coins, Copy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { ItemImage } from "@/components/common/item-image";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Item } from "@/hooks/use-items";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import { CATEGORY_LABELS } from "@convex/shared/wardrobe";

const LONG_PRESS_MS = 450;

type ItemTileProps = {
  item: Item;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (itemId: Id<"items">) => void;
};

/** A garment in the grid. Opens the item, or toggles selection once selection mode is on. */
export function ItemTile({ item, selected, selectionMode, onToggleSelect }: ItemTileProps) {
  const reduceMotion = useReducedMotion();
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function startLongPress() {
    cancelLongPress();
    longPressFired.current = false;
    longPress.current = setTimeout(() => {
      longPressFired.current = true;
      onToggleSelect(item._id);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPress.current === null) return;
    clearTimeout(longPress.current);
    longPress.current = null;
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="group relative"
    >
      <Link
        href={routes.item(item._id)}
        onClick={(event) => {
          // A long press already toggled selection; don't navigate on the click that follows it.
          if (longPressFired.current) {
            longPressFired.current = false;
            event.preventDefault();
            return;
          }
          if (!selectionMode) return;
          event.preventDefault();
          onToggleSelect(item._id);
        }}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        className={cn(
          "focus-visible:ring-ring/50 block space-y-2 rounded-xl outline-none focus-visible:ring-3",
          selected && "ring-primary ring-2",
        )}
        aria-label={item.name}
      >
        <div className="relative">
          <ItemImage src={item.url} alt={item.name} />
          {item.status === "needsCredits" ? (
            <Badge variant="outline" className="bg-background/90 absolute right-2 bottom-2 backdrop-blur">
              <Coins className="text-credit" aria-hidden />
              Needs credits
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="truncate text-sm leading-tight font-medium">{item.name}</p>
          <p className="text-muted-foreground truncate text-xs">{item.subcategory || CATEGORY_LABELS[item.category]}</p>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
            <span className="text-muted-foreground text-xs tabular-nums">
              {item.wearCount === 0 ? "Never worn" : `Worn ${pluralize(item.wearCount, "time")}`}
            </span>
          </div>
          {item.duplicateOfId ? (
            <Badge variant="outline" className="mt-1">
              <Copy aria-hidden />
              Possible duplicate
            </Badge>
          ) : null}
        </div>
      </Link>

      <div
        className={cn(
          "bg-background/90 absolute top-2 left-2 z-10 rounded-md p-1 shadow-sm backdrop-blur transition-opacity",
          selected || selectionMode
            ? "opacity-100"
            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item._id)}
          aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
        />
      </div>
    </motion.li>
  );
}
