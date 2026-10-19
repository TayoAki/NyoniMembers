"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  allowedOptions,
  BREAST_OPTIONS,
  BUTTON_STANCE_OPTIONS,
  CANVAS_OPTIONS,
  GARMENT_OPTIONS,
  HEM_OPTIONS,
  LAPEL_OPTIONS,
  LAPEL_WIDTH_OPTIONS,
  PLEAT_OPTIONS,
  POCKET_OPTIONS,
  RISE_OPTIONS,
  SHOULDER_OPTIONS,
  SLEEVE_BUTTON_OPTIONS,
  TROUSER_FIT_OPTIONS,
  VENT_OPTIONS,
  WAISTBAND_OPTIONS,
  WAISTCOAT_BACK_OPTIONS,
  WAISTCOAT_LAPEL_OPTIONS,
  WAISTCOAT_STYLE_OPTIONS,
  type Option,
  type SpecPatch,
  type SuitSpec,
} from "@convex/shared/atelier/spec";

type Props = {
  spec: SuitSpec;
  /** Applied through `applyChange` by the owner, so the engine keeps the shared design consistent. */
  onChange: (patch: SpecPatch) => void;
  disabled?: boolean;
  idPrefix: string;
};

/**
 * The shared design as compact selects, one per decision, using the studio's own option labels. Options the
 * dependency engine would refuse for the current garment are not offered; a change the engine has to make
 * elsewhere is reported by the owner, never hidden.
 */
export function SharedSpecFields({ spec, onChange, disabled = false, idPrefix }: Props) {
  const allowed = allowedOptions(spec);
  const only = <T extends string>(options: readonly Option<T>[], codes: readonly T[]) =>
    options.filter((option) => codes.includes(option.code));

  return (
    <div className="space-y-6">
      <SpecSelect
        id={`${idPrefix}-garment`}
        label="Garment"
        options={GARMENT_OPTIONS}
        value={spec.garment}
        onChange={(garment) => onChange({ garment })}
        disabled={disabled}
      />

      <Part title="Jacket">
        <SpecSelect
          id={`${idPrefix}-breast`}
          label="Front"
          options={BREAST_OPTIONS}
          value={spec.jacket.breast}
          onChange={(breast) => onChange({ jacket: { breast } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-buttons`}
          label="Buttons"
          options={only(BUTTON_STANCE_OPTIONS, allowed.buttons)}
          value={spec.jacket.buttons}
          onChange={(buttons) => onChange({ jacket: { buttons } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-lapel`}
          label="Lapel"
          options={only(LAPEL_OPTIONS, allowed.lapels)}
          value={spec.jacket.lapel}
          onChange={(lapel) => onChange({ jacket: { lapel } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-lapel-width`}
          label="Lapel width"
          options={LAPEL_WIDTH_OPTIONS}
          value={spec.jacket.lapelWidth}
          onChange={(lapelWidth) => onChange({ jacket: { lapelWidth } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-vents`}
          label="Vents"
          options={only(VENT_OPTIONS, allowed.vents)}
          value={spec.jacket.vents}
          onChange={(vents) => onChange({ jacket: { vents } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-pockets`}
          label="Pockets"
          options={only(POCKET_OPTIONS, allowed.pockets)}
          value={spec.jacket.pockets}
          onChange={(pockets) => onChange({ jacket: { pockets } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-canvas`}
          label="Construction"
          options={CANVAS_OPTIONS}
          value={spec.jacket.canvas}
          onChange={(canvas) => onChange({ jacket: { canvas } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-shoulder`}
          label="Shoulder"
          options={SHOULDER_OPTIONS}
          value={spec.jacket.shoulder}
          onChange={(shoulder) => onChange({ jacket: { shoulder } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-sleeve-buttons`}
          label="Sleeve buttons"
          options={SLEEVE_BUTTON_OPTIONS}
          value={spec.jacket.sleeveButtons}
          onChange={(sleeveButtons) => onChange({ jacket: { sleeveButtons } })}
          disabled={disabled}
        />
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <ToggleRow
            id={`${idPrefix}-ticket-pocket`}
            label="Ticket pocket"
            checked={spec.jacket.ticketPocket}
            onChange={(ticketPocket) => onChange({ jacket: { ticketPocket } })}
            disabled={disabled}
          />
          <ToggleRow
            id={`${idPrefix}-working-cuffs`}
            label="Working cuffs"
            checked={spec.jacket.workingCuffs}
            onChange={(workingCuffs) => onChange({ jacket: { workingCuffs } })}
            disabled={disabled}
          />
        </div>
      </Part>

      <Part title="Trousers">
        <SpecSelect
          id={`${idPrefix}-fit`}
          label="Fit"
          options={TROUSER_FIT_OPTIONS}
          value={spec.trousers.fit}
          onChange={(fit) => onChange({ trousers: { fit } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-pleats`}
          label="Front"
          options={PLEAT_OPTIONS}
          value={spec.trousers.pleats}
          onChange={(pleats) => onChange({ trousers: { pleats } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-rise`}
          label="Rise"
          options={RISE_OPTIONS}
          value={spec.trousers.rise}
          onChange={(rise) => onChange({ trousers: { rise } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-hem`}
          label="Hem"
          options={only(HEM_OPTIONS, allowed.hems)}
          value={spec.trousers.hem}
          onChange={(hem) => onChange({ trousers: { hem } })}
          disabled={disabled}
        />
        <SpecSelect
          id={`${idPrefix}-waistband`}
          label="Waistband"
          options={WAISTBAND_OPTIONS}
          value={spec.trousers.waistband}
          onChange={(waistband) => onChange({ trousers: { waistband } })}
          disabled={disabled}
        />
      </Part>

      {spec.waistcoat ? (
        <Part title="Waistcoat">
          <SpecSelect
            id={`${idPrefix}-waistcoat-style`}
            label="Style"
            options={WAISTCOAT_STYLE_OPTIONS}
            value={spec.waistcoat.style}
            onChange={(style) => onChange({ waistcoat: { style } })}
            disabled={disabled}
          />
          <SpecSelect
            id={`${idPrefix}-waistcoat-lapel`}
            label="Lapel"
            options={WAISTCOAT_LAPEL_OPTIONS}
            value={spec.waistcoat.lapel}
            onChange={(lapel) => onChange({ waistcoat: { lapel } })}
            disabled={disabled}
          />
          <SpecSelect
            id={`${idPrefix}-waistcoat-back`}
            label="Back"
            options={WAISTCOAT_BACK_OPTIONS}
            value={spec.waistcoat.back}
            onChange={(back) => onChange({ waistcoat: { back } })}
            disabled={disabled}
          />
        </Part>
      ) : null}
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-foreground/10 pt-4">
      <legend className="float-left mb-3 w-full font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </legend>
      <div className="clear-left grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function SpecSelect<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const items = Object.fromEntries(options.map((option) => [option.code, option.label]));
  const current = options.find((option) => option.code === value);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.code === String(next));
          if (option) onChange(option.code);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-11 w-full rounded-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-none">
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current ? <p className="text-xs leading-relaxed text-muted-foreground">{current.description}</p> : null}
    </Field>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-y border-foreground/10 py-2">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={(next) => onChange(next)} disabled={disabled} />
    </div>
  );
}
