"use client";

import {
  AlertCircle,
  Download,
  EllipsisVertical,
  Link2,
  Lock,
  Maximize2,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ItemImage } from "@/components/common/item-image";
import { RenderLightbox } from "@/components/renders/render-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useElapsed, useRenderActions, type Render } from "@/hooks/use-renders";
import { formatCredits, formatDuration, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CREDIT_COSTS } from "@convex/shared/credits";

type RenderCardProps = {
  render: Render;
  /** Adds the outfit name under the tile — on for the lookbook, off on an outfit's own page. */
  showOutfit?: boolean;
  className?: string;
};

/**
 * One render tile. Shared by the outfit page and the lookbook, so it owns every per-render
 * action: open, download, share, regenerate and delete.
 */
export function RenderCard({ render, showOutfit = false, className }: RenderCardProps) {
  const { user } = useCurrentUser();
  const actions = useRenderActions();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canShare = user?.balance.features.includes("sharing") ?? false;
  const regenerateCost = CREDIT_COSTS.render[render.quality];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  return (
    <figure className={cn("group/render flex flex-col gap-2", className)}>
      <div className="relative">
        {render.status === "pending" ? (
          <PendingTile createdAt={render.createdAt} />
        ) : render.status === "failed" ? (
          <FailedTile error={render.error} busy={busy} onRetry={() => void run(() => actions.regenerate(render._id))} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`Open ${render.outfitName}`}
              className="focus-visible:ring-ring block w-full rounded-xl transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:outline-none"
            >
              <ItemImage src={render.url} alt={render.outfitName} variant="photo" aspect="aspect-[3/4]" />
            </button>
            {render.shareToken ? (
              <Badge variant="secondary" className="absolute top-2 left-2 shadow-sm backdrop-blur-sm">
                <Link2 aria-hidden />
                Shared
              </Badge>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2 right-2 shadow-sm backdrop-blur-sm"
                    aria-label="Render options"
                  />
                }
              >
                {busy ? <Spinner className="size-3.5" /> : <EllipsisVertical />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setLightboxOpen(true)}>
                  <Maximize2 />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!render.url}
                  onClick={() => window.open(render.url ?? "", "_blank", "noopener,noreferrer")}
                >
                  <Download />
                  Download
                </DropdownMenuItem>

                {render.shareToken ? (
                  <>
                    <DropdownMenuItem onClick={() => void actions.copyShareLink(render.shareToken ?? "")}>
                      <Link2 />
                      Copy share link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void run(() => actions.unshare(render._id))}>
                      <Lock />
                      Stop sharing
                    </DropdownMenuItem>
                  </>
                ) : canShare ? (
                  <DropdownMenuItem onClick={() => void run(() => actions.shareAndCopy(render._id))}>
                    <Share2 />
                    Share
                  </DropdownMenuItem>
                ) : (
                  <Tooltip>
                    <TooltipTrigger render={<span className="block" />}>
                      <DropdownMenuItem disabled>
                        <Lock />
                        Share
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent side="left">Pro plan</TooltipContent>
                  </Tooltip>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void run(() => actions.regenerate(render._id))}>
                  <RefreshCw />
                  Regenerate
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {formatCredits(regenerateCost)}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {showOutfit ? (
        <figcaption className="space-y-0.5 px-0.5">
          <p className="line-clamp-1 text-sm font-medium">{render.outfitName}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatRelative(render.completedAt ?? render.createdAt)}
          </p>
        </figcaption>
      ) : null}

      <RenderLightbox render={render} open={lightboxOpen} onOpenChange={setLightboxOpen} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this render?"
        description="The image is removed for good. Credits already spent are not refunded."
        confirmLabel="Delete"
        destructive
        onConfirm={() => actions.remove(render._id)}
      />
    </figure>
  );
}

function PendingTile({ createdAt }: { createdAt: number }) {
  const elapsed = useElapsed(createdAt);
  return (
    <div
      className="bg-muted relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl text-center"
      role="status"
    >
      <div
        className="via-foreground/5 absolute inset-0 animate-pulse bg-gradient-to-br from-transparent to-transparent motion-reduce:animate-none"
        aria-hidden
      />
      <Spinner className="text-muted-foreground relative size-5" />
      <p className="relative px-2 text-xs font-medium">Rendering… ~40 s</p>
      <p className="text-muted-foreground relative text-[11px] tabular-nums">{formatDuration(elapsed)} elapsed</p>
    </div>
  );
}

function FailedTile({ error, busy, onRetry }: { error: string | undefined; busy: boolean; onRetry: () => void }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center">
      <AlertCircle className="text-destructive size-5" aria-hidden />
      <p className="text-destructive line-clamp-3 text-xs">{error ?? "This render failed."}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Retry
      </Button>
    </div>
  );
}
