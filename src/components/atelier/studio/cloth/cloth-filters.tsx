"use client";

import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CLOTH_PATTERN_LABELS, CLOTH_WEIGHT_LABELS, OCCASION_LABELS } from "@convex/shared/atelier/enums";
import {
  activeFilterCount,
  COLOUR_FAMILY_LABELS,
  DEFAULT_CLOTH_FILTERS,
  describeActiveFilters,
  hasActiveFilters,
  toggleValue,
  type ClothFilters,
  type FilterOptions,
} from "./cloth-filtering";

type ClothFiltersProps = {
  filters: ClothFilters;
  onChange: (next: ClothFilters) => void;
  options: FilterOptions;
  /** How many cloths the active filters leave, and how many the house offers. */
  shown: number;
  total: number;
};

/**
 * Search and toggle chips over the approved cloths (S03). The count always describes the list under
 * it; active filters stay visible as removable chips even when the groups are folded away.
 */
export function ClothFiltersBar({ filters, onChange, options, shown, total }: ClothFiltersProps) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  const active = describeActiveFilters(filters);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={searchId}
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Search by name, mill or composition"
          aria-label="Search cloths by name, mill or composition"
          className="h-11 rounded-none pr-11 pl-10"
          autoComplete="off"
        />
        {filters.query ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-9 -translate-y-1/2 rounded-none"
            onClick={() => onChange({ ...filters, query: "" })}
            aria-label="Clear search"
          >
            <X />
          </Button>
        ) : null}
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm tabular-nums" role="status" aria-live="polite" aria-atomic="true">
            <span className="font-medium">{shown}</span> of {pluralize(total, "cloth")}
          </p>
          <div className="flex items-center gap-1">
            {hasActiveFilters(filters) ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-none"
                onClick={() => onChange(DEFAULT_CLOTH_FILTERS)}
              >
                Clear all
              </Button>
            ) : null}
            <CollapsibleTrigger render={<Button variant="outline" size="sm" className="h-9 rounded-none" />}>
              <SlidersHorizontal data-icon="inline-start" aria-hidden />
              Filters{count > 0 ? ` · ${count}` : ""}
            </CollapsibleTrigger>
          </div>
        </div>

        {active.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
            {active.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => onChange(entry.without)}
                  className="relative inline-flex h-8 items-center gap-1.5 rounded-sm border border-primary/60 bg-primary/10 px-2.5 text-xs font-medium outline-none after:absolute after:inset-x-0 after:-inset-y-2 hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`Remove filter ${entry.label}`}
                >
                  {entry.label}
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <CollapsibleContent className="mt-4 space-y-5 border-t border-foreground/10 pt-4">
          {options.colours.length > 0 ? (
            <ChipGroup label="Colour">
              {options.colours.map((family) => (
                <FilterChip
                  key={family}
                  pressed={filters.colours.includes(family)}
                  onToggle={() => onChange({ ...filters, colours: toggleValue(filters.colours, family) })}
                >
                  {COLOUR_FAMILY_LABELS[family]}
                </FilterChip>
              ))}
            </ChipGroup>
          ) : null}
          {options.patterns.length > 0 ? (
            <ChipGroup label="Pattern">
              {options.patterns.map((pattern) => (
                <FilterChip
                  key={pattern}
                  pressed={filters.patterns.includes(pattern)}
                  onToggle={() => onChange({ ...filters, patterns: toggleValue(filters.patterns, pattern) })}
                >
                  {CLOTH_PATTERN_LABELS[pattern]}
                </FilterChip>
              ))}
            </ChipGroup>
          ) : null}
          {options.weights.length > 0 ? (
            <ChipGroup label="Weight">
              {options.weights.map((weight) => (
                <FilterChip
                  key={weight}
                  pressed={filters.weights.includes(weight)}
                  onToggle={() => onChange({ ...filters, weights: toggleValue(filters.weights, weight) })}
                >
                  {CLOTH_WEIGHT_LABELS[weight]}
                </FilterChip>
              ))}
            </ChipGroup>
          ) : null}
          {options.occasions.length > 0 ? (
            <ChipGroup label="Occasion">
              {options.occasions.map((occasion) => (
                <FilterChip
                  key={occasion}
                  pressed={filters.occasions.includes(occasion)}
                  onToggle={() => onChange({ ...filters, occasions: toggleValue(filters.occasions, occasion) })}
                >
                  {OCCASION_LABELS[occasion]}
                </FilterChip>
              ))}
            </ChipGroup>
          ) : null}
          <ChipGroup label="Stock">
            <FilterChip
              pressed={filters.inStockOnly}
              onToggle={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
            >
              In stock
            </FilterChip>
          </ChipGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** A toggle chip; the ::after box extends the hit area to 48px without adding visual weight. */
export function FilterChip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-xs font-medium transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/20 text-foreground hover:border-foreground/50",
      )}
    >
      {pressed ? <Check className="size-3" aria-hidden /> : null}
      {children}
    </button>
  );
}
