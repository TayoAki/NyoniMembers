"use client";

import type { CatalogueEntryView } from "@convex/atelier/views";
import type { MaterialSeed } from "@convex/shared/atelier/materials";
import { GARMENT_OPTIONS, type Garment } from "@convex/shared/atelier/spec";
import { Mono } from "@/components/atelier/common/mono";
import { OptionList, OptionRow } from "@/components/atelier/studio/style/option-list";
import { Skeleton } from "@/components/ui/skeleton";

export const HOUSE_CHOICE = "__house__";
export const HOUSE_CHOICE_LABEL = "House choice at fitting";

/** The seed's garment list, when it has one, says which base styles a material is offered on. */
export function materialReason(seed: MaterialSeed | undefined, garment: Garment): string | null {
  if (!seed || seed.garments.length === 0 || seed.garments.includes(garment)) return null;
  const names = seed.garments.map(
    (code) => GARMENT_OPTIONS.find((option) => option.code === code)?.label.toLowerCase() ?? code,
  );
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return `Offered on a ${list}.`;
}

/**
 * S09: buttons or linings from the studio catalogue as one ruled list, with "House choice at fitting" as
 * the explicit none. Materials the seed restricts to other garments stay visible, disabled, with the
 * reason. A chosen material that has since left the catalogue is named rather than silently dropped.
 */
export function MaterialPicker({
  kind,
  titleId,
  entries,
  seeds,
  garment,
  committedCode,
  disabled,
  onChoose,
}: {
  kind: "button" | "lining";
  titleId: string;
  /** undefined while the catalogue loads. */
  entries: CatalogueEntryView[] | undefined;
  seeds: readonly MaterialSeed[];
  garment: Garment;
  committedCode: string | null;
  disabled: boolean;
  /** null means the house chooses at the fitting. */
  onChoose: (code: string | null) => void;
}) {
  if (entries === undefined) return <MaterialPickerSkeleton />;

  const value = committedCode ?? HOUSE_CHOICE;
  const missing = committedCode !== null && !entries.some((entry) => entry.code === committedCode);

  return (
    <div className="space-y-3">
      <OptionList
        aria-labelledby={titleId}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === value) return;
          onChoose(next === HOUSE_CHOICE ? null : next);
        }}
      >
        <OptionRow
          id={`${kind}-house`}
          value={HOUSE_CHOICE}
          title={HOUSE_CHOICE_LABEL}
          description="Leave it to the house; the cutter proposes a match to your cloth at the first fitting."
          current={committedCode === null}
        />
        {entries.map((entry) => {
          const seed = seeds.find((candidate) => candidate.code === entry.code);
          const reason = materialReason(seed, garment);
          return (
            <OptionRow
              key={entry.code}
              id={`${kind}-${entry.code}`}
              value={entry.code}
              title={entry.name}
              description={entry.description}
              code={entry.supplierRef ?? entry.code}
              swatch={entry.hex}
              current={entry.code === committedCode}
              disabled={reason !== null && entry.code !== committedCode}
              reason={reason}
            />
          );
        })}
      </OptionList>
      {missing ? (
        <p className="text-xs leading-relaxed text-warning">
          Your chosen {kind} <Mono className="text-warning">{committedCode}</Mono> is no longer in the house&apos;s
          catalogue. Choose another, or leave it to the house.
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The house has not published its range yet. Your design keeps the house choice until it does.
        </p>
      ) : null}
    </div>
  );
}

export function MaterialPickerSkeleton() {
  return (
    <div
      className="divide-y divide-foreground/10 border-y border-foreground/15"
      aria-busy="true"
      aria-label="Loading the range"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex min-h-11 items-start gap-3 py-3">
          <Skeleton className="mt-0.5 size-4 rounded-full" />
          <Skeleton className="mt-px size-5 rounded-sm" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
