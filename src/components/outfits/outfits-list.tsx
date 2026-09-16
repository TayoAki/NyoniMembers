"use client";

import { Plus, Shapes, Shirt, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingGrid } from "@/components/common/loading-grid";
import { PageHeader } from "@/components/common/page-header";
import { OutfitCard } from "@/components/outfits/outfit-card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOutfits, type OutfitSource } from "@/hooks/use-outfits";
import { useWardrobe } from "@/hooks/use-items";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";

type Filter = "all" | OutfitSource;

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "manual", label: "Mine" },
  { value: "agent", label: "Stylist" },
];

/** The /outfits grid with its source filter. Header and page chrome live in the route file. */
export function OutfitsList() {
  const [filter, setFilter] = useState<Filter>("all");
  const outfits = useOutfits(filter === "all" ? undefined : filter);
  const { items: wardrobe } = useWardrobe();
  const reduceMotion = useReducedMotion();
  const wardrobeEmpty = wardrobe !== undefined && wardrobe.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outfits"
        description="Looks you have put together, and the ones the stylist suggested."
        actions={
          <Button render={<Link href={routes.newOutfit} />}>
            <Plus data-icon="inline-start" />
            New outfit
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[filter]}
          onValueChange={(value) => {
            const next = value[0];
            if (next) setFilter(next as Filter);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter outfits by source"
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {outfits ? (
          <span className="text-muted-foreground text-xs tabular-nums">{pluralize(outfits.length, "outfit")}</span>
        ) : null}
      </div>

      {outfits === undefined ? (
        <LoadingGrid count={8} />
      ) : outfits.length === 0 ? (
        <OutfitsEmpty filter={filter} wardrobeEmpty={wardrobeEmpty} onClearFilter={() => setFilter("all")} />
      ) : (
        <motion.div
          layout={!reduceMotion}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          <AnimatePresence initial={false}>
            {outfits.map((outfit) => (
              <motion.div
                key={outfit._id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <OutfitCard outfit={outfit} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function OutfitsEmpty({
  filter,
  wardrobeEmpty,
  onClearFilter,
}: {
  filter: Filter;
  wardrobeEmpty: boolean;
  onClearFilter: () => void;
}) {
  if (filter === "agent") {
    return (
      <EmptyState
        icon={Sparkles}
        title="No stylist outfits yet"
        description="Ask the stylist what to wear and the outfits it proposes show up here."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href={routes.stylist} />}>
              <Sparkles data-icon="inline-start" />
              Ask the stylist
            </Button>
            <Button variant="outline" onClick={onClearFilter}>
              Show all outfits
            </Button>
          </div>
        }
      />
    );
  }

  if (filter === "manual") {
    return (
      <EmptyState
        icon={Shapes}
        title="You haven't built an outfit yet"
        description="Put pieces together in the builder and they land here."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href={routes.newOutfit} />}>
              <Plus data-icon="inline-start" />
              New outfit
            </Button>
            <Button variant="outline" onClick={onClearFilter}>
              Show all outfits
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={wardrobeEmpty ? Shirt : Shapes}
      title={wardrobeEmpty ? "Add some clothes first" : "No outfits yet"}
      description={
        wardrobeEmpty
          ? "Your wardrobe is empty, so there is nothing to build with. Photograph a few pieces, then come back and put them together."
          : "Pick a top, a bottom and some shoes, name it, then render it on yourself."
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button render={<Link href={routes.newOutfit} />}>
            <Plus data-icon="inline-start" />
            New outfit
          </Button>
          {wardrobeEmpty ? (
            <Button variant="outline" render={<Link href={routes.add} />}>
              <Shirt data-icon="inline-start" />
              Add clothes
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
