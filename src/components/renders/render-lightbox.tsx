"use client";

import { Download, Link2, Sparkles } from "lucide-react";
import { ItemImage } from "@/components/common/item-image";
import { OutfitCollage } from "@/components/common/outfit-collage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useRender, useRenderActions, type Render } from "@/hooks/use-renders";
import { formatCredits, formatDateTime } from "@/lib/format";

type RenderLightboxProps = {
  render: Render;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Full-size view of one render with the outfit it came from, what it cost and when it landed. */
export function RenderLightbox({ render, open, onOpenChange }: RenderLightboxProps) {
  const detail = useRender(open ? render._id : null);
  const actions = useRenderActions();
  const outfit = detail?.outfit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-3 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{render.outfitName}</DialogTitle>
          <DialogDescription>
            {formatDateTime(render.completedAt ?? render.createdAt)} · {formatCredits(render.creditsCharged)}
          </DialogDescription>
        </DialogHeader>

        <ItemImage
          src={render.url}
          alt={`${render.outfitName} rendered on you`}
          variant="photo"
          aspect="aspect-[3/4]"
          priority
          className="mx-auto w-full max-w-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={render.quality === "hq" ? "default" : "secondary"}>
            {render.quality === "hq" ? (
              <>
                <Sparkles aria-hidden />
                HQ
              </>
            ) : (
              "Standard"
            )}
          </Badge>
          {render.shareToken ? <Badge variant="outline">Shared</Badge> : null}
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">Worn in this look</p>
          {outfit ? (
            <OutfitCollage items={outfit.items} tile="size-12" max={6} className="flex-wrap" />
          ) : (
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="size-12 rounded-lg" />
              ))}
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
          {render.shareToken ? (
            <Button variant="outline" onClick={() => void actions.copyShareLink(render.shareToken ?? "")}>
              <Link2 data-icon="inline-start" />
              Copy link
            </Button>
          ) : null}
          {render.url ? (
            <Button variant="outline" onClick={() => window.open(render.url ?? "", "_blank", "noopener,noreferrer")}>
              <Download data-icon="inline-start" />
              Download
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
