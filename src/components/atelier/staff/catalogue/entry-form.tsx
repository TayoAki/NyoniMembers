"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { WordSelect } from "@/components/atelier/staff/case/word-select";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toClientError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import {
  CLOTH_PATTERN_LABELS,
  CLOTH_PATTERNS,
  CLOTH_WEIGHT_LABELS,
  CLOTH_WEIGHTS,
  OCCASION_LABELS,
  OCCASIONS,
  type CatalogueKind,
  type ClothPattern,
  type ClothWeight,
  type Occasion,
} from "@convex/shared/atelier/enums";
import type { Season } from "@convex/shared/wardrobe";
import type { StaffEntry } from "./catalogue-table";
import { CATALOGUE_KIND_WORDS, CATALOGUE_KINDS_ORDER, SEASON_WORDS, SEASONS } from "./catalogue-words";
import { ShadeChip } from "./shade-chip";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const NO_WEIGHT = "__none__";

type FormState = {
  kind: CatalogueKind;
  code: string;
  name: string;
  mill: string;
  supplierRef: string;
  productUrl: string;
  productId: string;
  description: string;
  composition: string;
  weight: ClothWeight | typeof NO_WEIGHT;
  pattern: ClothPattern;
  colour: string;
  hex: string;
  season: Season[];
  occasions: Occasion[];
  priceUsd: string;
  image: string;
  sortOrder: string;
  inStock: boolean;
  sampleAvailable: boolean;
  provenance: string;
};

function fromEntry(entry: StaffEntry | null, kind: CatalogueKind): FormState {
  return {
    kind: entry?.kind ?? kind,
    code: entry?.code ?? "",
    name: entry?.name ?? "",
    mill: entry?.mill ?? "",
    supplierRef: entry?.supplierRef ?? "",
    productUrl: entry?.productUrl ?? "",
    productId: entry?.productId !== undefined ? String(entry.productId) : "",
    description: entry?.description ?? "",
    composition: entry?.composition ?? "",
    weight: entry?.weight ?? NO_WEIGHT,
    pattern: entry?.pattern ?? "solid",
    colour: entry?.colour ?? "",
    hex: entry?.hex ?? "#",
    season: entry ? [...entry.season] : [],
    occasions: entry ? [...entry.occasions] : [],
    priceUsd: entry?.priceUsd !== undefined ? String(entry.priceUsd) : "",
    image: entry?.imageUrl ?? "",
    sortOrder: "",
    inStock: entry?.inStock ?? true,
    sampleAvailable: entry?.sampleAvailable ?? false,
    provenance: "",
  };
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  return Number(value);
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

const KIND_OPTIONS = CATALOGUE_KINDS_ORDER.map((kind) => ({ code: kind, label: CATALOGUE_KIND_WORDS[kind].singular }));
const WEIGHT_OPTIONS = [
  { code: NO_WEIGHT as ClothWeight | typeof NO_WEIGHT, label: "Not stated" },
  ...CLOTH_WEIGHTS.map((weight) => ({ code: weight, label: CLOTH_WEIGHT_LABELS[weight] })),
];
const PATTERN_OPTIONS = CLOTH_PATTERNS.map((pattern) => ({ code: pattern, label: CLOTH_PATTERN_LABELS[pattern] }));

/**
 * Add or edit an entry (`catalogue.upsert`). A new entry starts as a draft, unpublished and with its shade
 * unconfirmed, and must say where it comes from (O02: every option has provenance). Editing keeps status,
 * approval and version; a changed shade is unconfirmed again until a fitter confirms it.
 */
export function EntryForm({
  open,
  onOpenChange,
  entry,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: StaffEntry | null;
  kind: CatalogueKind;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {open ? (
          <EntryFormBody
            key={entry?._id ?? `new-${kind}`}
            entry={entry}
            kind={kind}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EntryFormBody({
  entry,
  kind,
  onClose,
}: {
  entry: StaffEntry | null;
  kind: CatalogueKind;
  onClose: () => void;
}) {
  const upsert = useMutation(api.atelier.catalogue.upsert);
  const [form, setForm] = useState<FormState>(() => fromEntry(entry, kind));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = entry !== null;
  const id = `entry-${entry?._id ?? "new"}`;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const codeOk = CODE_PATTERN.test(form.code.trim().toLowerCase());
  const hexOk = HEX_PATTERN.test(form.hex.trim());
  const provenanceOk = editing || form.provenance.trim().length > 0;
  const canSubmit =
    codeOk &&
    hexOk &&
    provenanceOk &&
    form.name.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.colour.trim().length > 0 &&
    !pending;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await upsert({
        kind: form.kind,
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        ...(form.mill.trim() ? { mill: form.mill.trim() } : {}),
        ...(form.supplierRef.trim() ? { supplierRef: form.supplierRef.trim() } : {}),
        ...(form.productUrl.trim() ? { productUrl: form.productUrl.trim() } : {}),
        ...(optionalNumber(form.productId) !== undefined ? { productId: optionalNumber(form.productId) } : {}),
        description: form.description.trim(),
        ...(form.composition.trim() ? { composition: form.composition.trim() } : {}),
        ...(form.weight !== NO_WEIGHT ? { weight: form.weight } : {}),
        pattern: form.pattern,
        colour: form.colour.trim(),
        hex: form.hex.trim().toUpperCase(),
        season: form.season,
        occasions: form.occasions,
        ...(optionalNumber(form.priceUsd) !== undefined ? { priceUsd: optionalNumber(form.priceUsd) } : {}),
        ...(editing ? {} : { inStock: form.inStock, sampleAvailable: form.sampleAvailable }),
        ...(form.image.trim() ? { image: form.image.trim() } : {}),
        ...(optionalNumber(form.sortOrder) !== undefined ? { sortOrder: optionalNumber(form.sortOrder) } : {}),
        ...(form.provenance.trim() ? { provenance: form.provenance.trim() } : {}),
      });
      toast.success(
        result.created
          ? `${form.name.trim()} added as a draft. Approve it to show it to clients, then publish a version.`
          : `${form.name.trim()} updated. Publish a version to stamp the change.`,
      );
      onClose();
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  const cloth = form.kind === "cloth";

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {editing ? `Edit ${entry.name}` : `Add a ${CATALOGUE_KIND_WORDS[form.kind].singular.toLowerCase()}`}
        </SheetTitle>
        <SheetDescription>
          {editing
            ? "Status, approval and version stay as they are. A changed shade reads “Representative shade” again until a fitter confirms it."
            : "A new entry starts as a draft that clients do not see, unpublished, with a representative shade. Record where it comes from."}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-kind`}>Kind</FieldLabel>
            <WordSelect
              id={`${id}-kind`}
              value={form.kind}
              options={KIND_OPTIONS}
              onValueChange={(value) => set("kind", value)}
              disabled={editing}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-code`}>Code</FieldLabel>
            <FieldDescription>Lowercase letters, digits and hyphens.</FieldDescription>
            <Input
              id={`${id}-code`}
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              disabled={editing}
              className="font-mono"
              autoComplete="off"
              aria-invalid={form.code.length > 0 && !codeOk}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input id={`${id}-name`} value={form.name} onChange={(event) => set("name", event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-mill`}>{cloth ? "Mill" : "Maker"}</FieldLabel>
            <Input id={`${id}-mill`} value={form.mill} onChange={(event) => set("mill", event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-ref`}>Supplier reference</FieldLabel>
            <Input
              id={`${id}-ref`}
              value={form.supplierRef}
              onChange={(event) => set("supplierRef", event.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <FieldDescription>What the client reads on the card.</FieldDescription>
          <Textarea
            id={`${id}-description`}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            rows={3}
          />
        </Field>
        {cloth ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-composition`}>Composition</FieldLabel>
              <Input
                id={`${id}-composition`}
                value={form.composition}
                onChange={(event) => set("composition", event.target.value)}
                placeholder="100% wool"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-weight`}>Weight</FieldLabel>
              <WordSelect
                id={`${id}-weight`}
                value={form.weight}
                options={WEIGHT_OPTIONS}
                onValueChange={(value) => set("weight", value)}
              />
            </Field>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-pattern`}>Pattern</FieldLabel>
            <WordSelect
              id={`${id}-pattern`}
              value={form.pattern}
              options={PATTERN_OPTIONS}
              onValueChange={(value) => set("pattern", value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-colour`}>Colour word</FieldLabel>
            <Input
              id={`${id}-colour`}
              value={form.colour}
              onChange={(event) => set("colour", event.target.value)}
              placeholder="Midnight navy"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-hex`}>Representative shade</FieldLabel>
          <FieldDescription>
            Six hex digits after a #. It stays “representative” until a fitter confirms it against the cloth.
          </FieldDescription>
          <div className="flex items-center gap-3">
            <Input
              id={`${id}-hex`}
              value={form.hex}
              onChange={(event) => set("hex", event.target.value)}
              className="w-32 font-mono uppercase"
              autoComplete="off"
              aria-invalid={form.hex.length > 1 && !hexOk}
            />
            <ShadeChip hex={hexOk ? form.hex.trim() : "#808080"} confirmed={false} words={false} />
          </div>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Seasons</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SEASONS.map((season) => (
              <Label key={season} htmlFor={`${id}-season-${season}`} className="min-h-8 font-normal">
                <Checkbox
                  id={`${id}-season-${season}`}
                  checked={form.season.includes(season)}
                  onCheckedChange={() => set("season", toggle(form.season, season))}
                />
                {SEASON_WORDS[season]}
              </Label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Occasions</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {OCCASIONS.map((occasion) => (
              <Label key={occasion} htmlFor={`${id}-occasion-${occasion}`} className="min-h-8 font-normal">
                <Checkbox
                  id={`${id}-occasion-${occasion}`}
                  checked={form.occasions.includes(occasion)}
                  onCheckedChange={() => set("occasions", toggle(form.occasions, occasion))}
                />
                {OCCASION_LABELS[occasion]}
              </Label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${id}-price`}>Price from (USD)</FieldLabel>
            <FieldDescription>Blank reads “Price confirmed with your quote”.</FieldDescription>
            <Input
              id={`${id}-price`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.priceUsd}
              onChange={(event) => set("priceUsd", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-product-id`}>Store product id</FieldLabel>
            <Input
              id={`${id}-product-id`}
              type="number"
              inputMode="numeric"
              value={form.productId}
              onChange={(event) => set("productId", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-sort`}>Sort order</FieldLabel>
            <FieldDescription>Blank keeps its place.</FieldDescription>
            <Input
              id={`${id}-sort`}
              type="number"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(event) => set("sortOrder", event.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>Product page</FieldLabel>
          <Input
            id={`${id}-url`}
            type="url"
            value={form.productUrl}
            onChange={(event) => set("productUrl", event.target.value)}
            placeholder="https://nyonicouture.com/product/…"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-image`}>Mill-book photograph</FieldLabel>
          <FieldDescription>
            A path under public/ or a full URL. No image means no photograph is claimed.
          </FieldDescription>
          <Input
            id={`${id}-image`}
            value={form.image}
            onChange={(event) => set("image", event.target.value)}
            placeholder="/atelier/cloth/….webp"
            className="font-mono text-xs"
          />
        </Field>
        {!editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Label htmlFor={`${id}-stock`} className="flex min-h-11 items-center justify-between gap-4 font-normal">
              <span className="text-sm">In stock</span>
              <Switch
                id={`${id}-stock`}
                checked={form.inStock}
                onCheckedChange={(checked) => set("inStock", checked)}
              />
            </Label>
            <Label htmlFor={`${id}-sample`} className="flex min-h-11 items-center justify-between gap-4 font-normal">
              <span className="text-sm">Sample available</span>
              <Switch
                id={`${id}-sample`}
                checked={form.sampleAvailable}
                onCheckedChange={(checked) => set("sampleAvailable", checked)}
              />
            </Label>
          </div>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-provenance`}>Provenance{editing ? "" : " (required)"}</FieldLabel>
          <FieldDescription>
            {editing
              ? `Currently: ${entry.provenance}. Leave blank to keep it.`
              : "Where this entry comes from: the supplier document, the export, the person who verified it."}
          </FieldDescription>
          <Textarea
            id={`${id}-provenance`}
            value={form.provenance}
            onChange={(event) => set("provenance", event.target.value)}
            rows={2}
            aria-invalid={!provenanceOk && form.provenance.length === 0 && !editing}
          />
        </Field>
        {error ? (
          <ErrorAlert title={editing ? "The entry was not updated" : "The entry was not added"} message={error} />
        ) : null}
      </div>
      <SheetFooter className="flex-row flex-wrap items-center gap-3">
        <Button className="h-10 rounded-none px-5" disabled={!canSubmit} onClick={() => void submit()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {editing ? "Save changes" : "Add as draft"}
        </Button>
        <Button variant="ghost" className="h-10" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </SheetFooter>
    </>
  );
}
