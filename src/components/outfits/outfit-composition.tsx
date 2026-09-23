import { ItemImage } from "@/components/common/item-image";
import type { OutfitItems } from "@/hooks/use-outfits";
import { cn } from "@/lib/utils";
import type { Slot } from "@convex/shared/wardrobe";

export type Silhouette = "separates" | "suit" | "dress";

export const BOARD_SLOT_CLASS: Record<Slot, string> = {
  outerwear: "col-start-1 col-span-2 row-start-2 row-span-4",
  top: "col-start-3 col-span-3 row-start-1 row-span-3",
  mid: "col-start-1 col-span-2 row-start-1 row-span-2",
  suit: "col-start-3 col-span-3 row-start-1 row-span-8",
  bottom: "col-start-3 col-span-3 row-start-4 row-span-5",
  dress: "col-start-3 col-span-3 row-start-1 row-span-8",
  shoes: "col-start-1 col-span-2 row-start-7 row-span-2",
  accessories: "col-start-6 col-span-1 row-start-2 row-span-6",
};

/** With a suit on the board the shirt moves beside it, since the suit runs the full height like a dress. */
export function boardSlotClass(slot: Slot, silhouette: Silhouette): string {
  if (silhouette === "suit") {
    if (slot === "suit") return "col-start-3 col-span-2 row-start-1 row-span-8";
    if (slot === "top") return "col-start-5 col-span-1 row-start-1 row-span-4";
  }
  return BOARD_SLOT_CLASS[slot];
}

export function OutfitComposition({ items, className }: { items: OutfitItems; className?: string }) {
  const hasLayer = Boolean(items.outerwear);
  const hasSuit = Boolean(items.suit);
  const singleSlots = ["outerwear", "top", "suit", "bottom", "dress", "shoes"] as const;
  const positions: Record<(typeof singleSlots)[number], string> = {
    outerwear: "left-[3%] top-[8%] h-[52%] w-[51%]",
    top: hasSuit
      ? "left-[4%] top-[34%] h-[30%] w-[36%]"
      : hasLayer
        ? "right-[3%] top-[4%] h-[42%] w-[49%]"
        : "left-[16%] top-[4%] h-[43%] w-[68%]",
    suit: "right-[8%] top-[5%] h-[84%] w-[62%]",
    bottom: "right-[8%] bottom-[5%] h-[53%] w-[53%]",
    dress: "right-[8%] top-[5%] h-[84%] w-[62%]",
    shoes: "left-[5%] bottom-[7%] h-[25%] w-[41%]",
  };
  return (
    <div className={cn("relative", className)}>
      {singleSlots.map((slot) => {
        const item = items[slot];
        return item ? (
          <ItemImage
            key={slot}
            src={item.url}
            alt={item.name}
            aspect="aspect-auto"
            className={cn("absolute rounded-none bg-transparent p-0 dark:bg-transparent", positions[slot])}
          />
        ) : null;
      })}
      {items.accessories.length > 0 ? (
        <div className="absolute top-[48%] left-[5%] flex h-[23%] w-[26%] items-center justify-center gap-1">
          {items.accessories.slice(0, 3).map((item) => (
            <ItemImage
              key={item._id}
              src={item.url}
              alt={item.name}
              aspect="aspect-square"
              className="min-w-0 flex-1 rounded-none bg-transparent p-0 dark:bg-transparent"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
