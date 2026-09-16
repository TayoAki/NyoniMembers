"use client";

import { Check, Save, Shapes } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemPickerSheet } from "@/components/outfits/item-picker-sheet";
import { SlotCard } from "@/components/outfits/slot-card";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOutfitActions, type Outfit } from "@/hooks/use-outfits";
import { useWardrobe, type Item as WardrobeItem } from "@/hooks/use-items";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Id } from "@convex/_generated/dataModel";
import { SLOTS, type Slot } from "@convex/shared/wardrobe";

export type DraftSlots = {
  outerwear?: Id<"items">;
  top?: Id<"items">;
  bottom?: Id<"items">;
  dress?: Id<"items">;
  shoes?: Id<"items">;
  accessories: Id<"items">[];
};

export type OutfitDraft = { name: string; occasion: string; slots: DraftSlots };

type SingleSlot = Exclude<Slot, "accessories">;

export const EMPTY_DRAFT: OutfitDraft = { name: "", occasion: "", slots: { accessories: [] } };

export function draftFromOutfit(outfit: Outfit): OutfitDraft {
  return {
    name: outfit.name,
    occasion: outfit.occasion ?? "",
    slots: {
      outerwear: outfit.slots.outerwear,
      top: outfit.slots.top,
      bottom: outfit.slots.bottom,
      dress: outfit.slots.dress,
      shoes: outfit.slots.shoes,
      accessories: [...outfit.slots.accessories],
    },
  };
}

type OutfitFormProps = {
  /** Existing outfit count, used for the "Outfit N" name suggestion. */
  outfitCount: number;
  initial: OutfitDraft;
} & ({ mode: "create" } | { mode: "edit"; outfitId: Id<"outfits"> });

/** The slot board plus name/occasion. Owns the draft; saving is create-then-redirect or patch-in-place. */
export function OutfitForm(props: OutfitFormProps) {
  const { initial, outfitCount } = props;
  const router = useRouter();
  const { items: wardrobe } = useWardrobe();
  const actions = useOutfitActions();

  const [slots, setSlots] = useState<DraftSlots>(() => cloneSlots(initial.slots));
  const [occasion, setOccasion] = useState(initial.occasion);
  const [name, setName] = useState(initial.name);
  const [nameTouched, setNameTouched] = useState(initial.name.length > 0);
  const [useDress, setUseDress] = useState(Boolean(initial.slots.dress));
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);
  const [baseline, setBaseline] = useState<OutfitDraft>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map((wardrobe ?? []).map((item) => [item._id, item])), [wardrobe]);
  const chosen = useMemo(() => pickItems(slots, itemsById), [slots, itemsById]);
  const itemCount = countItems(slots);
  const suggestedName = useMemo(() => suggestName(chosen, outfitCount), [chosen, outfitCount]);
  const effectiveName = nameTouched ? name : suggestedName;

  const dirty =
    effectiveName !== baseline.name ||
    occasion.trim() !== baseline.occasion.trim() ||
    !slotsEqual(slots, baseline.slots);
  const canSave = itemCount > 0 && dirty && !pending;

  useUnsavedChangesWarning(dirty && itemCount > 0);

  function setSlot(slot: SingleSlot, itemId: Id<"items"> | undefined) {
    setSlots((current) => {
      const next: DraftSlots = cloneSlots(current);
      next[slot] = itemId;
      return next;
    });
  }

  function toggleAccessory(itemId: Id<"items">) {
    setSlots((current) => ({
      ...current,
      accessories: current.accessories.includes(itemId)
        ? current.accessories.filter((id) => id !== itemId)
        : [...current.accessories, itemId],
    }));
  }

  function handleToggle(itemId: Id<"items">) {
    if (!pickerSlot) return;
    if (pickerSlot === "accessories") {
      toggleAccessory(itemId);
      return;
    }
    setSlot(pickerSlot, slots[pickerSlot] === itemId ? undefined : itemId);
    setPickerSlot(null);
  }

  function handleClearPicker() {
    if (!pickerSlot) return;
    if (pickerSlot === "accessories") setSlots((current) => ({ ...current, accessories: [] }));
    else setSlot(pickerSlot, undefined);
  }

  function switchLayer(next: "separates" | "dress") {
    setUseDress(next === "dress");
    setSlots((current) =>
      next === "dress" ? { ...current, top: undefined, bottom: undefined } : { ...current, dress: undefined },
    );
  }

  async function handleSave() {
    if (!canSave) return;
    setPending(true);
    setError(null);
    const payload = {
      name: effectiveName.trim() || suggestedName,
      slots: toSlotsArg(slots),
      occasion: occasion.trim(),
    };
    if (props.mode === "create") {
      const newId = await actions.create(payload, (clientError) => setError(clientError.message));
      setPending(false);
      if (!newId) return;
      toast.success("Outfit saved.");
      router.replace(routes.outfit(newId));
      return;
    }
    const result = await actions.update({ outfitId: props.outfitId, patch: payload }, (clientError) =>
      setError(clientError.message),
    );
    setPending(false);
    if (result === undefined) return;
    setBaseline({ name: payload.name, occasion: payload.occasion, slots: cloneSlots(slots) });
    setName(payload.name);
    setNameTouched(true);
    toast.success("Outfit updated.");
  }

  const lockedTopBottom = useDress
    ? "A dress fills the top and bottom. Switch back to separates to use them."
    : undefined;
  const lockedDress = useDress ? undefined : "Switch to Dress to wear one instead of a top and bottom.";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Shapes className="text-muted-foreground size-4" aria-hidden />
          The look
          <span className="text-muted-foreground text-xs font-normal tabular-nums">
            {pluralize(itemCount, "piece")}
          </span>
        </h2>
        <ToggleGroup
          value={[useDress ? "dress" : "separates"]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "dress" || next === "separates") switchLayer(next);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Top and bottom, or a dress"
        >
          <ToggleGroupItem value="separates">Top + bottom</ToggleGroupItem>
          <ToggleGroupItem value="dress">Dress</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SLOTS.map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            multiple={slot === "accessories"}
            items={slotItems(slot, slots, itemsById)}
            lockedReason={
              slot === "top" || slot === "bottom" ? lockedTopBottom : slot === "dress" ? lockedDress : undefined
            }
            onOpen={() => setPickerSlot(slot)}
            onRemove={(itemId) => {
              if (slot === "accessories") toggleAccessory(itemId);
              else setSlot(slot, undefined);
            }}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="outfit-name">Name</FieldLabel>
          <Input
            id="outfit-name"
            value={effectiveName}
            placeholder={suggestedName}
            onChange={(event) => {
              setNameTouched(true);
              setName(event.target.value);
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="outfit-occasion">Occasion</FieldLabel>
          <Input
            id="outfit-occasion"
            value={occasion}
            placeholder="Dinner, office, weekend…"
            onChange={(event) => setOccasion(event.target.value)}
          />
        </Field>
      </div>

      {error ? (
        <ErrorAlert title="Could not save this outfit" message={error} onRetry={() => void handleSave()} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          {itemCount === 0
            ? "Pick at least one piece to save this outfit."
            : dirty
              ? "Unsaved changes."
              : "All changes saved."}
        </p>
        <Button onClick={() => void handleSave()} disabled={!canSave}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : dirty ? (
            <Save data-icon="inline-start" />
          ) : (
            <Check data-icon="inline-start" />
          )}
          {props.mode === "create" ? "Save outfit" : "Save changes"}
        </Button>
      </div>

      <ItemPickerSheet
        slot={pickerSlot}
        items={wardrobe}
        multiple={pickerSlot === "accessories"}
        selected={pickerSlot ? selectedIds(pickerSlot, slots) : []}
        onOpenChange={(open) => {
          if (!open) setPickerSlot(null);
        }}
        onToggle={handleToggle}
        onClear={handleClearPicker}
      />
    </section>
  );
}

function slotItems(slot: Slot, slots: DraftSlots, itemsById: Map<Id<"items">, WardrobeItem>): WardrobeItem[] {
  if (slot === "accessories") {
    return slots.accessories.map((id) => itemsById.get(id)).filter((item): item is WardrobeItem => Boolean(item));
  }
  const id = slots[slot];
  const item = id ? itemsById.get(id) : undefined;
  return item ? [item] : [];
}

function selectedIds(slot: Slot, slots: DraftSlots): Id<"items">[] {
  if (slot === "accessories") return slots.accessories;
  const id = slots[slot];
  return id ? [id] : [];
}

function pickItems(slots: DraftSlots, itemsById: Map<Id<"items">, WardrobeItem>): WardrobeItem[] {
  const ids = [slots.outerwear, slots.dress, slots.top, slots.bottom, slots.shoes, ...slots.accessories];
  return ids.map((id) => (id ? itemsById.get(id) : undefined)).filter((item): item is WardrobeItem => Boolean(item));
}

function countItems(slots: DraftSlots): number {
  const single = [slots.outerwear, slots.top, slots.bottom, slots.dress, slots.shoes].filter(Boolean).length;
  return single + slots.accessories.length;
}

function cloneSlots(slots: DraftSlots): DraftSlots {
  return { ...slots, accessories: [...slots.accessories] };
}

function toSlotsArg(slots: DraftSlots): DraftSlots {
  return {
    outerwear: slots.outerwear,
    top: slots.top,
    bottom: slots.bottom,
    dress: slots.dress,
    shoes: slots.shoes,
    accessories: [...slots.accessories],
  };
}

function slotsEqual(a: DraftSlots, b: DraftSlots): boolean {
  return (
    a.outerwear === b.outerwear &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.dress === b.dress &&
    a.shoes === b.shoes &&
    a.accessories.length === b.accessories.length &&
    a.accessories.every((id, index) => id === b.accessories[index])
  );
}

/** "Black tee + indigo jeans", falling back to "Outfit 4" until something is picked. */
function suggestName(items: WardrobeItem[], outfitCount: number): string {
  const headline = items.filter((item) => item.category !== "accessory" && item.category !== "bag").slice(0, 2);
  if (headline.length === 0) return `Outfit ${outfitCount + 1}`;
  const name = headline.map((item) => item.name).join(" + ");
  return name.length > 60 ? `${name.slice(0, 57)}…` : name;
}

/** Catches a tab close or reload mid-edit. In-app navigation is not interceptable in the App Router yet. */
function useUnsavedChangesWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
