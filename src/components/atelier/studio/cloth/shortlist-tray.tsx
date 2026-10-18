"use client";

import { X } from "lucide-react";
import { Mono } from "@/components/atelier/common/mono";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ClothSummary } from "@convex/atelier/views";
import { ShadeChip } from "./shade-chip";

type ShortlistTrayProps = {
  cloths: ClothSummary[];
  max: number;
  selectedCode: string | null;
  pendingCode: string | null;
  locked: boolean;
  onInspect: (code: string) => void;
  onRemove: (code: string) => void;
  onCompare: () => void;
};

/** The cloths being weighed (S05): chips with the shade and the name, a remove on each, and Compare. */
export function ShortlistTray({
  cloths,
  max,
  selectedCode,
  pendingCode,
  locked,
  onInspect,
  onRemove,
  onCompare,
}: ShortlistTrayProps) {
  const count = cloths.length;
  return (
    <section aria-labelledby="shortlist-title" className="space-y-3 border-y border-foreground/15 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="shortlist-title" className="text-sm font-medium">
          Shortlist{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {count} of {max}
          </span>
        </h3>
        <Button variant="outline" size="sm" className="h-9 rounded-none" onClick={onCompare} disabled={count < 2}>
          Compare
        </Button>
      </div>
      {count === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Shortlist up to {max} cloths to weigh them side by side. Shortlisting never changes your chosen cloth.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Shortlisted cloths">
          {cloths.map((cloth) => {
            const unavailable = cloth.status === "withdrawn";
            return (
              <li key={cloth.code} className="inline-flex max-w-full items-stretch border border-foreground/20">
                <button
                  type="button"
                  onClick={() => onInspect(cloth.code)}
                  disabled={unavailable}
                  className="flex h-11 min-w-0 items-center gap-2 px-2.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
                  aria-label={`Inspect ${cloth.name}`}
                >
                  <ShadeChip hex={cloth.hex} confirmed={cloth.shadeConfirmed} words={false} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{cloth.name}</span>
                    {cloth.code === selectedCode ? (
                      <Mono className="block">chosen</Mono>
                    ) : unavailable ? (
                      <span className="block text-[11px] text-warning">No longer offered</span>
                    ) : !cloth.inStock ? (
                      <span className="block text-[11px] text-warning">Not in stock</span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(cloth.code)}
                  disabled={pendingCode !== null || locked}
                  className="flex w-11 shrink-0 items-center justify-center border-l border-foreground/20 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  aria-label={`Remove ${cloth.name} from the shortlist`}
                >
                  {pendingCode === cloth.code ? (
                    <Spinner className="size-3.5" aria-label="Updating shortlist" />
                  ) : (
                    <X className="size-3.5" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {count === 1 ? <p className="text-xs text-muted-foreground">Add one more to compare.</p> : null}
    </section>
  );
}
