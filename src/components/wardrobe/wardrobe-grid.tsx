"use client";

import { useMutation } from "convex/react";
import { AnimatePresence } from "motion/react";
import { Plus, Search, Shirt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingGrid } from "@/components/common/loading-grid";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveJobs } from "@/hooks/use-active-jobs";
import { colourOptions, useWardrobe, type Item } from "@/hooks/use-items";
import { reportError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Category } from "@convex/shared/wardrobe";
import { ItemTile } from "./item-tile";
import { SelectionBar } from "./selection-bar";
import { activeFilterCount, DEFAULT_FILTERS, WardrobeToolbar, type WardrobeFilters } from "./wardrobe-toolbar";

function sortItems(items: readonly Item[], sort: WardrobeFilters["sort"]): Item[] {
  const sorted = [...items];
  if (sort === "most-worn") return sorted.sort((a, b) => b.wearCount - a.wearCount || b.createdAt - a.createdAt);
  if (sort === "never-worn") return sorted.sort((a, b) => a.wearCount - b.wearCount || b.createdAt - a.createdAt);
  return sorted.sort((a, b) => b.createdAt - a.createdAt);
}

export function WardrobeGrid() {
  const [filters, setFilters] = useState<WardrobeFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<ReadonlySet<Id<"items">>>(new Set());
  const [pending, setPending] = useState(false);

  const { items, isSearching, isPending } = useWardrobe({
    query: filters.query,
    status: filters.showHidden ? "hidden" : undefined,
    category: filters.category === "all" ? undefined : filters.category,
  });

  const setStatus = useMutation(api.items.setStatus);
  const setCategory = useMutation(api.items.setCategory);
  const removeItems = useMutation(api.items.remove);
  const { jobs } = useActiveJobs();
  const ingesting = jobs?.some((job) => job.type === "ingest") ?? false;

  const colours = useMemo(() => colourOptions(items ?? []), [items]);

  const visible = useMemo(() => {
    if (!items) return undefined;
    const filtered = items.filter((item) => {
      if (filters.colours.length > 0 && !filters.colours.includes(item.colours.primary)) return false;
      if (filters.seasons.length > 0 && !filters.seasons.some((season) => item.season.includes(season))) return false;
      if (filters.formality.length > 0 && !filters.formality.includes(item.formality)) return false;
      return true;
    });
    return sortItems(filtered, filters.sort);
  }, [filters.colours, filters.formality, filters.seasons, filters.sort, items]);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const selectionMode = selected.size > 0;

  function patchFilters(patch: Partial<WardrobeFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    if (patch.showHidden !== undefined) setSelected(new Set());
  }

  function toggleSelect(itemId: Id<"items">) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function runBulk(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await action();
      toast.success(success);
      setSelected(new Set());
    } catch (error) {
      reportError(error);
    } finally {
      setPending(false);
    }
  }

  const hasFilters = activeFilterCount(filters) > 0 || filters.query.trim().length > 0 || filters.category !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wardrobe"
        description={
          visible === undefined
            ? "Everything we have cut out and tagged."
            : `${pluralize(visible.length, "item")}${filters.showHidden ? " hidden" : ""}${isSearching ? " matching your search" : ""}.`
        }
        actions={
          <Button render={<Link href={routes.add} />}>
            <Plus data-icon="inline-start" />
            Add clothes
          </Button>
        }
      />

      {ingesting ? (
        <div className="bg-muted/40 dark:bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Spinner className="size-4" aria-hidden />
          <span>New clothes are being processed.</span>
          <Link href={routes.add} className="font-medium underline underline-offset-4">
            Watch progress
          </Link>
        </div>
      ) : null}

      <WardrobeToolbar filters={filters} onChange={patchFilters} colours={colours} searching={isPending} />

      {visible === undefined ? (
        <LoadingGrid count={10} />
      ) : visible.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description="Try a different search, or clear the filters to see everything again."
            action={
              <Button
                variant="outline"
                onClick={() => setFilters({ ...DEFAULT_FILTERS, showHidden: filters.showHidden })}
              >
                Clear filters
              </Button>
            }
          />
        ) : filters.showHidden ? (
          <EmptyState icon={Shirt} title="Nothing hidden" description="Items you hide from the grid show up here." />
        ) : (
          <EmptyState
            icon={Shirt}
            title="Your wardrobe is empty"
            description="Photograph what you own and every garment gets cut out, tagged and filed here."
            action={
              <Button render={<Link href={routes.add} />}>
                <Plus data-icon="inline-start" />
                Add clothes
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence initial={false}>
            {visible.map((item) => (
              <ItemTile
                key={item._id}
                item={item}
                selected={selected.has(item._id)}
                selectionMode={selectionMode}
                onToggleSelect={toggleSelect}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {selectionMode ? (
        <SelectionBar
          count={selected.size}
          allHidden={filters.showHidden}
          pending={pending}
          onClear={() => setSelected(new Set())}
          onSetStatus={(status) =>
            void runBulk(
              () => setStatus({ itemIds: selectedIds, status }),
              status === "hidden" ? "Items hidden." : "Items are back in the grid.",
            )
          }
          onSetCategory={(category: Category) =>
            void runBulk(() => setCategory({ itemIds: selectedIds, category }), "Category updated.")
          }
          onDelete={async () => {
            await removeItems({ itemIds: selectedIds });
            toast.success(`${pluralize(selectedIds.length, "item")} deleted.`);
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
