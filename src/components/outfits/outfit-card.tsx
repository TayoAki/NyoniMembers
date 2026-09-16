import { ImageIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { ItemImage } from "@/components/common/item-image";
import { OutfitCollage } from "@/components/common/outfit-collage";
import { Badge } from "@/components/ui/badge";
import type { Outfit } from "@/hooks/use-outfits";
import { formatRelative, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** One outfit in the grid: render cover when there is one, the garment collage otherwise. */
export function OutfitCard({ outfit, className }: { outfit: Outfit; className?: string }) {
  const wornCount = outfit.wornOn.length;
  const lastWorn = wornCount > 0 ? Math.max(...outfit.wornOn) : null;

  return (
    <Link
      href={routes.outfit(outfit._id)}
      className={cn(
        "group bg-card ring-foreground/10 flex h-full flex-col overflow-hidden rounded-xl text-left ring-1 transition-all",
        "hover:ring-foreground/25 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div className="relative">
        {outfit.coverUrl ? (
          <ItemImage
            src={outfit.coverUrl}
            alt={outfit.name}
            variant="photo"
            aspect="aspect-[3/4]"
            className="rounded-none transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="bg-muted/40 dark:bg-muted/20 flex aspect-[3/4] items-center justify-center p-4">
            <OutfitCollage items={outfit.items} tile="size-14" max={4} className="flex-wrap justify-center gap-2" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {outfit.source === "agent" ? (
            <Badge variant="secondary" className="shadow-sm backdrop-blur-sm">
              <Sparkles aria-hidden />
              Stylist
            </Badge>
          ) : (
            <span />
          )}
          {outfit.renderCount > 0 ? (
            <Badge variant="secondary" className="tabular-nums shadow-sm backdrop-blur-sm">
              <ImageIcon aria-hidden />
              {outfit.renderCount}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-1 text-sm font-medium">{outfit.name}</h3>
        {outfit.occasion ? (
          <Badge variant="outline" className="max-w-full">
            <span className="truncate">{outfit.occasion}</span>
          </Badge>
        ) : null}
        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-1 text-xs tabular-nums">
          <span>{wornCount > 0 ? pluralize(wornCount, "wear") : "Never worn"}</span>
          {lastWorn ? <span className="truncate">{formatRelative(lastWorn)}</span> : null}
        </div>
      </div>
    </Link>
  );
}
