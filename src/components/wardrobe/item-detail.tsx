"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ChevronDown, Copy, ImageIcon, PackageOpen, Shirt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ItemImage } from "@/components/common/item-image";
import { OutfitCollage } from "@/components/common/outfit-collage";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { useItem } from "@/hooks/use-items";
import { reportError } from "@/lib/errors";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CATEGORY_LABELS } from "@convex/shared/wardrobe";
import { ItemActions } from "./item-actions";
import { ItemDetailSkeleton } from "./item-detail-skeleton";
import { ItemForm } from "./item-form";

export function ItemDetail({ itemId }: { itemId: Id<"items"> }) {
  const data = useItem(itemId);
  const dismissDuplicate = useMutation(api.items.dismissDuplicate);
  const [dismissing, setDismissing] = useState(false);

  if (data === undefined) return <ItemDetailSkeleton />;

  if (data === null) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={PackageOpen}
          title="Item not found"
          description="It may have been deleted, or the link is wrong."
          action={
            <Button render={<Link href={routes.wardrobe} />}>
              <Shirt data-icon="inline-start" />
              Back to wardrobe
            </Button>
          }
        />
      </div>
    );
  }

  const { item, outfits, sourceUrl, duplicateOf } = data;

  async function handleKeepBoth() {
    setDismissing(true);
    try {
      await dismissDuplicate({ itemId });
      toast.success("Kept as a separate item.");
    } catch (error) {
      reportError(error);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        eyebrow={CATEGORY_LABELS[item.category]}
        title={item.name}
        description={[item.subcategory, item.colours.primary, item.material].filter(Boolean).join(" · ")}
        actions={item.status === "hidden" ? <Badge variant="outline">Hidden</Badge> : null}
      />

      {duplicateOf ? (
        <div className="border-warning/40 bg-warning/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
          <ItemImage
            src={duplicateOf.url}
            alt={duplicateOf.name}
            aspect="aspect-square"
            className="size-14 shrink-0 rounded-lg p-1.5"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Copy className="size-4 shrink-0" aria-hidden />
              Possible duplicate
            </p>
            <p className="text-muted-foreground text-sm">
              This looks a lot like{" "}
              <Link href={routes.item(duplicateOf._id)} className="font-medium underline underline-offset-4">
                {duplicateOf.name}
              </Link>
              . Nothing was merged — you decide.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleKeepBoth} disabled={dismissing} className="shrink-0">
            {dismissing ? <Spinner data-icon="inline-start" /> : null}
            Keep both
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <ItemImage src={item.url} alt={item.name} aspect="aspect-[4/5]" className="p-6" priority />

          {item.status === "extracting" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner className="size-4" aria-hidden />
              Still cutting this one out. The image appears here when it lands.
            </p>
          ) : item.status === "needsCredits" ? (
            <p className="text-muted-foreground text-sm">
              Extraction paused — you ran out of credits.{" "}
              <Link href={routes.billing} className="font-medium underline underline-offset-4">
                Top up
              </Link>{" "}
              and resume it from the add-clothes screen.
            </p>
          ) : item.status === "failed" ? (
            <p className="text-destructive text-sm">Extraction failed. Try &ldquo;Re-extract&rdquo; to run it again.</p>
          ) : null}

          {item.colours.hex.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Colours</p>
              <ul className="flex flex-wrap gap-2">
                {item.colours.hex.map((hex) => (
                  <li key={hex} className="flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1">
                    <span
                      className="ring-foreground/15 size-4 rounded-full ring-1"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    <span className="text-muted-foreground font-mono text-[11px] uppercase">{hex}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card size="sm">
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Worn" value={item.wearCount === 0 ? "Never" : `${item.wearCount}×`} />
              <Stat label="Last worn" value={item.lastWornAt ? formatRelative(item.lastWornAt) : "—"} />
              <Stat label="Added" value={formatDate(item.createdAt)} />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Outfits with this item</CardTitle>
            </CardHeader>
            <CardContent>
              {outfits.length === 0 ? (
                <p className="text-muted-foreground text-sm">Not in an outfit yet. Build one and it shows up here.</p>
              ) : (
                <ul className="space-y-3">
                  {outfits.map((outfit) => (
                    <li key={outfit._id}>
                      <Link
                        href={routes.outfit(outfit._id)}
                        className="hover:bg-muted focus-visible:ring-ring flex items-center gap-3 rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <OutfitCollage items={outfit.items} tile="size-10" max={4} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{outfit.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Collapsible>
            <CollapsibleTrigger
              render={
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="size-3.5" aria-hidden />
                    Source photo
                  </span>
                  <ChevronDown
                    className="size-3.5 transition-transform group-data-[panel-open]/button:rotate-180"
                    aria-hidden
                  />
                </Button>
              }
            />
            <CollapsibleContent className="pt-3">
              {sourceUrl ? (
                <ItemImage
                  src={sourceUrl}
                  alt={`Photo ${item.name} was cut out of`}
                  variant="photo"
                  aspect="aspect-[4/3]"
                />
              ) : (
                <p className="text-muted-foreground text-sm">The original photo has been deleted.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="space-y-6">
          <ItemActions item={item} />
          <ItemForm key={item._id} item={item} />
          {item.description ? (
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">How we describe it: </span>
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href={routes.wardrobe} />}>
      <ArrowLeft data-icon="inline-start" />
      Wardrobe
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
