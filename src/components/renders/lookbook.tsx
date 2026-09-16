"use client";

import { usePaginatedQuery } from "convex/react";
import { Images, Shapes } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { RenderGrid } from "@/components/renders/render-grid";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useOutfits } from "@/hooks/use-outfits";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const PAGE_SIZE = 24;
const ALL = "all";

/** Every render the user owns, newest first, filterable by outfit. */
export function Lookbook() {
  const outfits = useOutfits();
  const [outfitId, setOutfitId] = useState<Id<"outfits"> | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(api.renders.listMine, outfitId ? { outfitId } : {}, {
    initialNumItems: PAGE_SIZE,
  });

  const loadingFirstPage = status === "LoadingFirstPage";
  const selectedName = outfits?.find((outfit) => outfit._id === outfitId)?.name;

  return (
    <div className="space-y-6">
      <PageHeader title="Lookbook" description="Every image Fitcheck has rendered of you, newest first." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={outfitId ?? ALL}
          onValueChange={(value) => {
            const match = outfits?.find((outfit) => outfit._id === value);
            setOutfitId(match ? match._id : null);
          }}
        >
          <SelectTrigger className="w-56" aria-label="Filter by outfit">
            <SelectValue>{(value: string) => (value === ALL ? "All outfits" : (selectedName ?? "Outfit"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All outfits</SelectItem>
            {(outfits ?? []).map((outfit) => (
              <SelectItem key={outfit._id} value={outfit._id}>
                {outfit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loadingFirstPage ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {pluralize(results.length, "render")}
            {status === "Exhausted" ? "" : "+"}
          </span>
        ) : null}
      </div>

      <RenderGrid
        renders={loadingFirstPage ? undefined : results}
        showOutfit
        skeletonCount={PAGE_SIZE}
        empty={
          outfitId ? (
            <EmptyState
              icon={Images}
              title="Nothing rendered for this outfit yet"
              description="Open the outfit and hit “Render on me” to see it worn."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button render={<Link href={routes.outfit(outfitId)} />}>Open outfit</Button>
                  <Button variant="outline" onClick={() => setOutfitId(null)}>
                    Show all renders
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={Images}
              title="Your lookbook is empty"
              description="Build an outfit and render it on yourself — every image you make lands here."
              action={
                <Button render={<Link href={routes.outfits} />}>
                  <Shapes data-icon="inline-start" />
                  Go to outfits
                </Button>
              }
            />
          )
        }
      />

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)} disabled={status === "LoadingMore"}>
            {status === "LoadingMore" ? <Spinner data-icon="inline-start" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
