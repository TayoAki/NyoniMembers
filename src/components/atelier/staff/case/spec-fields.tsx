"use client";

import type { ReactNode } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBookSection } from "@/components/atelier/common/order-book";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CatalogueEntryView } from "@convex/atelier/views";
import { MONOGRAM_RULES } from "@convex/shared/atelier/materials";
import {
  allowedOptions,
  BREAST_OPTIONS,
  BUTTON_STANCE_OPTIONS,
  CANVAS_OPTIONS,
  GARMENT_OPTIONS,
  HEM_OPTIONS,
  LAPEL_OPTIONS,
  LAPEL_WIDTH_OPTIONS,
  MONOGRAM_FONT_OPTIONS,
  MONOGRAM_PLACEMENT_OPTIONS,
  MONOGRAM_THREAD_OPTIONS,
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
import { WordSelect, type WordOption } from "./word-select";

export type SpecCatalogue = {
  cloths: CatalogueEntryView[];
  buttons: CatalogueEntryView[];
  linings: CatalogueEntryView[];
};

/** The "none" choice for buttons and lining: the house decides at the fitting, as the review step words it. */
const HOUSE_CHOICE = "__house_choice__";

function withAllowed<T extends string>(
  options: readonly Option<T>[],
  allowed: readonly T[],
  reason: string,
): WordOption<T>[] {
  return options.map((option) => ({
    code: option.code,
    label: option.label,
    description: allowed.includes(option.code) ? option.description : reason,
    disabled: !allowed.includes(option.code),
  }));
}

function plain<T extends string>(options: readonly Option<T>[]): WordOption<T>[] {
  return options.map((option) => ({ code: option.code, label: option.label, description: option.description }));
}

function productionId<T extends string>(options: readonly Option<T>[], code: T): string {
  return options.find((option) => option.code === code)?.productionId ?? code.toUpperCase();
}

function materialOptions(entries: CatalogueEntryView[], current: string | null): WordOption<string>[] {
  const options: WordOption<string>[] = [{ code: HOUSE_CHOICE, label: "House choice at fitting" }];
  for (const entry of entries)
    options.push({ code: entry.code, label: entry.name, description: entry.supplierRef ?? entry.description });
  if (current && !entries.some((entry) => entry.code === current))
    options.push({ code: current, label: `${current} (not currently offered)` });
  return options;
}

function FieldRow({
  id,
  label,
  code,
  children,
}: {
  id: string;
  label: string;
  code?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto] sm:items-center">
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
      {code ? <Mono className="sm:justify-self-end">{code}</Mono> : null}
    </div>
  );
}

/**
 * Every field of a suit specification as a compact control, in the order of the client's order book, with
 * the production id of the current value at the end of each row. `spec` is the resolved design (after the
 * tailoring rules ran); `onPatch` asks for one change, and the caller resolves it with `applyChange`.
 */
export function SpecFields({
  spec,
  catalogue,
  onPatch,
  idPrefix,
}: {
  spec: SuitSpec;
  catalogue: SpecCatalogue;
  onPatch: (patch: SpecPatch) => void;
  idPrefix: string;
}) {
  const allowed = allowedOptions(spec);
  const tuxedo = spec.garment === "tuxedo";
  const id = (name: string) => `${idPrefix}-${name}`;
  const cloth = catalogue.cloths.find((entry) => entry.code === spec.clothCode) ?? null;
  const clothOptions: WordOption<string>[] = catalogue.cloths.map((entry) => ({
    code: entry.code,
    label: entry.name,
    description: [entry.mill, entry.inStock ? null : "Not in stock"].filter(Boolean).join(" · ") || undefined,
  }));
  if (spec.clothCode && !cloth)
    clothOptions.push({ code: spec.clothCode, label: `${spec.clothCode} (not currently offered)` });

  return (
    <div className="divide-y divide-foreground/10 border-y border-foreground/15">
      <div>
        <OrderBookSection>Garment</OrderBookSection>
        <FieldRow id={id("garment")} label="Garment" code={productionId(GARMENT_OPTIONS, spec.garment)}>
          <WordSelect
            id={id("garment")}
            value={spec.garment}
            options={plain(GARMENT_OPTIONS)}
            onValueChange={(garment) => onPatch({ garment })}
          />
        </FieldRow>
      </div>
      <div>
        <OrderBookSection>Cloth</OrderBookSection>
        <FieldRow id={id("cloth")} label="Cloth" code={spec.clothCode}>
          <WordSelect
            id={id("cloth")}
            value={spec.clothCode}
            options={clothOptions}
            placeholder="Not yet chosen"
            onValueChange={(clothCode) => onPatch({ clothCode })}
          />
        </FieldRow>
      </div>
      <div>
        <OrderBookSection>Jacket</OrderBookSection>
        <FieldRow id={id("breast")} label="Front" code={productionId(BREAST_OPTIONS, spec.jacket.breast)}>
          <WordSelect
            id={id("breast")}
            value={spec.jacket.breast}
            options={plain(BREAST_OPTIONS)}
            onValueChange={(breast) => onPatch({ jacket: { breast } })}
          />
        </FieldRow>
        <FieldRow id={id("buttons")} label="Buttons" code={productionId(BUTTON_STANCE_OPTIONS, spec.jacket.buttons)}>
          <WordSelect
            id={id("buttons")}
            value={spec.jacket.buttons}
            options={withAllowed(
              BUTTON_STANCE_OPTIONS,
              allowed.buttons,
              spec.jacket.breast === "double" ? "Single-breasted stance" : "Double-breasted stance",
            )}
            onValueChange={(buttons) => onPatch({ jacket: { buttons } })}
          />
        </FieldRow>
        <FieldRow id={id("lapel")} label="Lapel" code={productionId(LAPEL_OPTIONS, spec.jacket.lapel)}>
          <WordSelect
            id={id("lapel")}
            value={spec.jacket.lapel}
            options={withAllowed(LAPEL_OPTIONS, allowed.lapels, "Not on this front")}
            onValueChange={(lapel) => onPatch({ jacket: { lapel } })}
          />
        </FieldRow>
        <FieldRow
          id={id("lapelWidth")}
          label="Lapel width"
          code={productionId(LAPEL_WIDTH_OPTIONS, spec.jacket.lapelWidth)}
        >
          <WordSelect
            id={id("lapelWidth")}
            value={spec.jacket.lapelWidth}
            options={plain(LAPEL_WIDTH_OPTIONS)}
            onValueChange={(lapelWidth) => onPatch({ jacket: { lapelWidth } })}
          />
        </FieldRow>
        <FieldRow id={id("vents")} label="Vents" code={productionId(VENT_OPTIONS, spec.jacket.vents)}>
          <WordSelect
            id={id("vents")}
            value={spec.jacket.vents}
            options={withAllowed(VENT_OPTIONS, allowed.vents, "Not on a tuxedo")}
            onValueChange={(vents) => onPatch({ jacket: { vents } })}
          />
        </FieldRow>
        <FieldRow id={id("pockets")} label="Pockets" code={productionId(POCKET_OPTIONS, spec.jacket.pockets)}>
          <WordSelect
            id={id("pockets")}
            value={spec.jacket.pockets}
            options={withAllowed(POCKET_OPTIONS, allowed.pockets, "A tuxedo has jetted pockets")}
            onValueChange={(pockets) => onPatch({ jacket: { pockets } })}
          />
        </FieldRow>
        <FieldRow id={id("ticket")} label="Ticket pocket" code={spec.jacket.ticketPocket ? "TKT_YES" : "TKT_NO"}>
          <div className="flex min-h-8 items-center gap-3">
            <Switch
              id={id("ticket")}
              checked={spec.jacket.ticketPocket}
              disabled={tuxedo || spec.jacket.pockets === "patch"}
              onCheckedChange={(ticketPocket) => onPatch({ jacket: { ticketPocket } })}
            />
            <span className="text-xs text-muted-foreground">
              {tuxedo
                ? "Not on a tuxedo"
                : spec.jacket.pockets === "patch"
                  ? "Not with patch pockets"
                  : spec.jacket.ticketPocket
                    ? "Yes"
                    : "No"}
            </span>
          </div>
        </FieldRow>
        <FieldRow id={id("canvas")} label="Construction" code={productionId(CANVAS_OPTIONS, spec.jacket.canvas)}>
          <WordSelect
            id={id("canvas")}
            value={spec.jacket.canvas}
            options={plain(CANVAS_OPTIONS)}
            onValueChange={(canvas) => onPatch({ jacket: { canvas } })}
          />
        </FieldRow>
        <FieldRow id={id("shoulder")} label="Shoulder" code={productionId(SHOULDER_OPTIONS, spec.jacket.shoulder)}>
          <WordSelect
            id={id("shoulder")}
            value={spec.jacket.shoulder}
            options={plain(SHOULDER_OPTIONS)}
            onValueChange={(shoulder) => onPatch({ jacket: { shoulder } })}
          />
        </FieldRow>
        <FieldRow
          id={id("sleeve")}
          label="Sleeve buttons"
          code={productionId(SLEEVE_BUTTON_OPTIONS, spec.jacket.sleeveButtons)}
        >
          <WordSelect
            id={id("sleeve")}
            value={spec.jacket.sleeveButtons}
            options={plain(SLEEVE_BUTTON_OPTIONS)}
            onValueChange={(sleeveButtons) => onPatch({ jacket: { sleeveButtons } })}
          />
        </FieldRow>
        <FieldRow
          id={id("cuffs")}
          label="Working cuffs"
          code={spec.jacket.workingCuffs ? "CUFF_WORKING" : "CUFF_FIXED"}
        >
          <div className="flex min-h-8 items-center gap-3">
            <Switch
              id={id("cuffs")}
              checked={spec.jacket.workingCuffs}
              onCheckedChange={(workingCuffs) => onPatch({ jacket: { workingCuffs } })}
            />
            <span className="text-xs text-muted-foreground">{spec.jacket.workingCuffs ? "Yes" : "No"}</span>
          </div>
        </FieldRow>
      </div>
      <div>
        <OrderBookSection>Trousers</OrderBookSection>
        <FieldRow id={id("fit")} label="Fit" code={productionId(TROUSER_FIT_OPTIONS, spec.trousers.fit)}>
          <WordSelect
            id={id("fit")}
            value={spec.trousers.fit}
            options={plain(TROUSER_FIT_OPTIONS)}
            onValueChange={(fit) => onPatch({ trousers: { fit } })}
          />
        </FieldRow>
        <FieldRow id={id("pleats")} label="Front" code={productionId(PLEAT_OPTIONS, spec.trousers.pleats)}>
          <WordSelect
            id={id("pleats")}
            value={spec.trousers.pleats}
            options={plain(PLEAT_OPTIONS)}
            onValueChange={(pleats) => onPatch({ trousers: { pleats } })}
          />
        </FieldRow>
        <FieldRow id={id("rise")} label="Rise" code={productionId(RISE_OPTIONS, spec.trousers.rise)}>
          <WordSelect
            id={id("rise")}
            value={spec.trousers.rise}
            options={plain(RISE_OPTIONS)}
            onValueChange={(rise) => onPatch({ trousers: { rise } })}
          />
        </FieldRow>
        <FieldRow id={id("hem")} label="Hem" code={productionId(HEM_OPTIONS, spec.trousers.hem)}>
          <WordSelect
            id={id("hem")}
            value={spec.trousers.hem}
            options={withAllowed(HEM_OPTIONS, allowed.hems, "A tuxedo has a plain hem")}
            onValueChange={(hem) => onPatch({ trousers: { hem } })}
          />
        </FieldRow>
        <FieldRow
          id={id("waistband")}
          label="Waistband"
          code={productionId(WAISTBAND_OPTIONS, spec.trousers.waistband)}
        >
          <WordSelect
            id={id("waistband")}
            value={spec.trousers.waistband}
            options={plain(WAISTBAND_OPTIONS)}
            onValueChange={(waistband) => onPatch({ trousers: { waistband } })}
          />
        </FieldRow>
      </div>
      {spec.waistcoat ? (
        <div>
          <OrderBookSection>Waistcoat</OrderBookSection>
          <FieldRow
            id={id("wc-style")}
            label="Style"
            code={productionId(WAISTCOAT_STYLE_OPTIONS, spec.waistcoat.style)}
          >
            <WordSelect
              id={id("wc-style")}
              value={spec.waistcoat.style}
              options={plain(WAISTCOAT_STYLE_OPTIONS)}
              onValueChange={(style) => onPatch({ waistcoat: { style } })}
            />
          </FieldRow>
          <FieldRow
            id={id("wc-lapel")}
            label="Lapel"
            code={productionId(WAISTCOAT_LAPEL_OPTIONS, spec.waistcoat.lapel)}
          >
            <WordSelect
              id={id("wc-lapel")}
              value={spec.waistcoat.lapel}
              options={plain(WAISTCOAT_LAPEL_OPTIONS)}
              onValueChange={(lapel) => onPatch({ waistcoat: { lapel } })}
            />
          </FieldRow>
          <FieldRow id={id("wc-back")} label="Back" code={productionId(WAISTCOAT_BACK_OPTIONS, spec.waistcoat.back)}>
            <WordSelect
              id={id("wc-back")}
              value={spec.waistcoat.back}
              options={plain(WAISTCOAT_BACK_OPTIONS)}
              onValueChange={(back) => onPatch({ waistcoat: { back } })}
            />
          </FieldRow>
        </div>
      ) : null}
      <div>
        <OrderBookSection>Details</OrderBookSection>
        <FieldRow id={id("button")} label="Buttons" code={spec.buttonCode}>
          <WordSelect
            id={id("button")}
            value={spec.buttonCode ?? HOUSE_CHOICE}
            options={materialOptions(catalogue.buttons, spec.buttonCode)}
            onValueChange={(code) => onPatch({ buttonCode: code === HOUSE_CHOICE ? null : code })}
          />
        </FieldRow>
        <FieldRow id={id("lining")} label="Lining" code={spec.liningCode}>
          <WordSelect
            id={id("lining")}
            value={spec.liningCode ?? HOUSE_CHOICE}
            options={materialOptions(catalogue.linings, spec.liningCode)}
            onValueChange={(code) => onPatch({ liningCode: code === HOUSE_CHOICE ? null : code })}
          />
        </FieldRow>
        {spec.monogram ? (
          <>
            <FieldRow id={id("mono-text")} label="Monogram" code={null}>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={id("mono-text")}
                  value={spec.monogram.text}
                  maxLength={MONOGRAM_RULES.maxChars}
                  className="w-28 font-mono uppercase"
                  onChange={(event) =>
                    spec.monogram && onPatch({ monogram: { ...spec.monogram, text: event.target.value.toUpperCase() } })
                  }
                />
                <Button variant="ghost" size="sm" className="h-8" onClick={() => onPatch({ monogram: null })}>
                  Remove monogram
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{MONOGRAM_RULES.help}</p>
            </FieldRow>
            <FieldRow
              id={id("mono-placement")}
              label="Placement"
              code={productionId(MONOGRAM_PLACEMENT_OPTIONS, spec.monogram.placement)}
            >
              <WordSelect
                id={id("mono-placement")}
                value={spec.monogram.placement}
                options={plain(MONOGRAM_PLACEMENT_OPTIONS)}
                onValueChange={(placement) => spec.monogram && onPatch({ monogram: { ...spec.monogram, placement } })}
              />
            </FieldRow>
            <FieldRow
              id={id("mono-thread")}
              label="Thread"
              code={productionId(MONOGRAM_THREAD_OPTIONS, spec.monogram.thread)}
            >
              <WordSelect
                id={id("mono-thread")}
                value={spec.monogram.thread}
                options={plain(MONOGRAM_THREAD_OPTIONS)}
                onValueChange={(thread) => spec.monogram && onPatch({ monogram: { ...spec.monogram, thread } })}
              />
            </FieldRow>
            <FieldRow id={id("mono-font")} label="Font" code={productionId(MONOGRAM_FONT_OPTIONS, spec.monogram.font)}>
              <WordSelect
                id={id("mono-font")}
                value={spec.monogram.font}
                options={plain(MONOGRAM_FONT_OPTIONS)}
                onValueChange={(font) => spec.monogram && onPatch({ monogram: { ...spec.monogram, font } })}
              />
            </FieldRow>
          </>
        ) : (
          <FieldRow id={id("mono-add")} label="Monogram" code="MONO_NONE">
            <Button
              id={id("mono-add")}
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() =>
                onPatch({ monogram: { text: "", placement: "inside_pocket", thread: "gold", font: "script" } })
              }
            >
              Add a monogram
            </Button>
          </FieldRow>
        )}
      </div>
    </div>
  );
}
