"use client";

import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ItemImage } from "@/components/common/item-image";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CatalogueEntryView, ClothSummary, DraftWarning } from "@convex/atelier/views";
import { CLOTH_PATTERN_LABELS } from "@convex/shared/atelier/enums";
import { ClothCard, clothPriceLine } from "./cloth-card";
import { DEFAULT_CLOTH_FILTERS, describeActiveFilters, type ClothFilters } from "./cloth-filtering";
import { ShadeChip } from "./shade-chip";

type ClothBrowserProps = {
  cloths: CatalogueEntryView[];
  filters: ClothFilters;
  onFiltersChange: (next: ClothFilters) => void;
  selectedCode: string | null;
  shortlist: readonly string[];
  choosingCode: string | null;
  shortlistPendingCode: string | null;
  locked: boolean;
  onInspect: (code: string) => void;
  onChoose: (code: string) => void;
  onToggleShortlist: (code: string) => void;
};

/** The grid of approved cloths after filtering (S03), or the no-matches state with the filters that caused it. */
export function ClothBrowser({
  cloths,
  filters,
  onFiltersChange,
  selectedCode,
  shortlist,
  choosingCode,
  shortlistPendingCode,
  locked,
  onInspect,
  onChoose,
  onToggleShortlist,
}: ClothBrowserProps) {
  if (cloths.length === 0) {
    const active = describeActiveFilters(filters);
    return (
      <EmptyState
        icon={Search}
        className="rounded-none"
        title="No cloths match"
        description={
          active.length > 0 ? (
            <span className="flex flex-col items-center gap-3">
              <span>None of the house&rsquo;s cloths match all of these:</span>
              <span className="flex flex-wrap justify-center gap-2">
                {active.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => onFiltersChange(entry.without)}
                    className="relative inline-flex h-8 items-center gap-1.5 rounded-sm border border-foreground/20 px-2.5 text-xs font-medium text-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-2 hover:border-foreground/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label={`Remove filter ${entry.label}`}
                  >
                    {entry.label}
                    <X className="size-3" aria-hidden />
                  </button>
                ))}
              </span>
            </span>
          ) : (
            "The house has no approved cloths to show at the moment. Your concierge can tell you what is coming."
          )
        }
        action={
          active.length > 0 ? (
            <Button
              variant="outline"
              className="h-11 rounded-none px-5"
              onClick={() => onFiltersChange(DEFAULT_CLOTH_FILTERS)}
            >
              Clear all
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4" aria-label="Cloths">
      {cloths.map((cloth) => (
        <ClothCard
          key={cloth.code}
          cloth={cloth}
          selected={cloth.code === selectedCode}
          shortlisted={shortlist.includes(cloth.code)}
          choosing={choosingCode === cloth.code}
          shortlistPending={shortlistPendingCode === cloth.code}
          locked={locked}
          onInspect={() => onInspect(cloth.code)}
          onChoose={() => onChoose(cloth.code)}
          onToggleShortlist={() => onToggleShortlist(cloth.code)}
        />
      ))}
    </ul>
  );
}

type SelectedClothNoticeProps = {
  cloth: ClothSummary;
  warnings: DraftWarning[];
  replacements: CatalogueEntryView[];
  choosingCode: string | null;
  locked: boolean;
  onChoose: (code: string) => void;
  onInspect: (code: string) => void;
};

/**
 * The chosen cloth when the house has withdrawn it or run out (C03): it stays visible and named, the
 * draft's own warning explains why, and the replacements are offered, never applied.
 */
export function SelectedClothNotice({
  cloth,
  warnings,
  replacements,
  choosingCode,
  locked,
  onChoose,
  onInspect,
}: SelectedClothNoticeProps) {
  const withdrawn = cloth.status === "withdrawn";
  const relevant = warnings.filter(
    (warning) => warning.code === "cloth_withdrawn" || warning.code === "cloth_out_of_stock",
  );
  return (
    <section aria-labelledby="selected-cloth-title" className="space-y-4 border-y border-foreground/15 py-4">
      <div className="flex gap-4">
        <ItemImage
          src={cloth.imageUrl}
          alt={`Mill book of ${cloth.name}`}
          variant="photo"
          aspect="aspect-[3/4]"
          className="w-20 shrink-0 rounded-none"
        />
        <div className="min-w-0 space-y-1.5">
          <h3 id="selected-cloth-title" className="font-display text-base leading-tight font-medium">
            {cloth.name}
          </h3>
          {cloth.mill ? <p className="text-xs text-muted-foreground">{cloth.mill}</p> : null}
          <ShadeChip hex={cloth.hex} confirmed={cloth.shadeConfirmed} />
          <StatusLine tone="warning">
            {withdrawn ? "No longer offered by the house" : "Not in stock — ask your concierge"}
          </StatusLine>
          <StatusLine tone="gold">Still your chosen cloth</StatusLine>
        </div>
      </div>
      {relevant.map((warning) => (
        <Alert key={warning.code} className="rounded-none border-warning/50">
          <AlertTitle>
            {withdrawn
              ? "Choose another cloth before this design is sent"
              : "Your concierge will confirm whether it can be sourced"}
          </AlertTitle>
          <AlertDescription>{warning.message}</AlertDescription>
        </Alert>
      ))}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {replacements.length > 0
            ? `Close to it in ${CLOTH_PATTERN_LABELS[cloth.pattern].toLowerCase()}`
            : "No close match in the catalogue right now"}
        </p>
        {replacements.length > 0 ? (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
            {replacements.map((option) => (
              <li key={option.code} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => onInspect(option.code)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`Inspect ${option.name}`}
                >
                  <ShadeChip hex={option.hex} confirmed={option.shadeConfirmed} words={false} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{option.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[option.mill, clothPriceLine(option)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                <Button
                  variant="outline"
                  className="h-11 shrink-0 rounded-none"
                  onClick={() => onChoose(option.code)}
                  disabled={choosingCode !== null || locked}
                  aria-label={`Choose ${option.name}`}
                >
                  {choosingCode === option.code ? <Spinner data-icon="inline-start" aria-label="Choosing" /> : null}
                  Choose
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Browse the book below, or ask your concierge what the house can source.
          </p>
        )}
      </div>
    </section>
  );
}
