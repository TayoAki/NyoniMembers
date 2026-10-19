import {
  allowedOptions,
  applyChange,
  BREAST_OPTIONS,
  BUTTON_STANCE_OPTIONS,
  CANVAS_OPTIONS,
  DEFAULT_SPEC,
  DEFAULT_WAISTCOAT,
  describeSpec,
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
  type Garment,
  type Option,
  type SpecPatch,
  type SuitSpec,
} from "@convex/shared/atelier/spec";

/**
 * The tailoring details of the style step (S06/S07), one entry per decision. Every option, label and
 * production id comes from `convex/shared/atelier/spec.ts`; this file only says which field each row
 * reads, how a choice becomes a patch, and what the engine's rules allow right now.
 */

export type DetailPart = "jacket" | "trousers" | "waistcoat";

export const DETAIL_PART_LABELS: Record<DetailPart, string> = {
  jacket: "Jacket",
  trousers: "Trousers",
  waistcoat: "Waistcoat",
};

export type DetailGroup = {
  key: string;
  part: DetailPart;
  label: string;
  /** One line on why the decision matters, at the top of the detail sheet. */
  why: string;
  options: readonly Option<string>[];
  /** The committed code for this detail. */
  current: (spec: SuitSpec) => string;
  /** Which codes the garment and front allow right now; null when every option is open. */
  allowed: (spec: SuitSpec) => readonly string[] | null;
  /** Why some options are not offered right now, in the engine's own words. */
  limitNote: (spec: SuitSpec) => string | null;
  patch: (code: string) => SpecPatch;
};

type GroupDef<T extends string> = {
  key: string;
  part: DetailPart;
  label: string;
  why: string;
  options: readonly Option<T>[];
  current: (spec: SuitSpec) => T;
  allowed?: (spec: SuitSpec) => readonly T[];
  limitNote?: (spec: SuitSpec) => string | null;
  patch: (code: T) => SpecPatch;
};

function defineGroup<T extends string>({
  options,
  current,
  allowed,
  limitNote,
  patch,
  ...rest
}: GroupDef<T>): DetailGroup {
  return {
    ...rest,
    options,
    current,
    allowed: allowed ?? (() => null),
    limitNote: limitNote ?? (() => null),
    patch: (code) => {
      const option = options.find((entry) => entry.code === code);
      if (!option) throw new Error(`Unknown ${rest.label.toLowerCase()} option: ${code}`);
      return patch(option.code);
    },
  };
}

export type DetailToggle = {
  key: string;
  part: DetailPart;
  label: string;
  why: string;
  get: (spec: SuitSpec) => boolean;
  patch: (value: boolean) => SpecPatch;
  /** Why the switch cannot be turned on right now; null when it can. */
  disabledReason: (spec: SuitSpec) => string | null;
};

export type DetailRowDef = { kind: "choice"; group: DetailGroup } | { kind: "toggle"; toggle: DetailToggle };

const choice = (def: DetailGroup): DetailRowDef => ({ kind: "choice", group: def });
const toggle = (def: DetailToggle): DetailRowDef => ({ kind: "toggle", toggle: def });

export const DETAIL_ROWS: readonly DetailRowDef[] = [
  choice(
    defineGroup({
      key: "breast",
      part: "jacket",
      label: "Front",
      why: "One row of buttons or two: the front sets the whole character of the jacket.",
      options: BREAST_OPTIONS,
      current: (spec) => spec.jacket.breast,
      patch: (code) => ({ jacket: { breast: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "buttons",
      part: "jacket",
      label: "Buttons",
      why: "Where the jacket closes decides how much of the shirt and tie show.",
      options: BUTTON_STANCE_OPTIONS,
      current: (spec) => spec.jacket.buttons,
      allowed: (spec) => allowedOptions(spec).buttons,
      limitNote: (spec) =>
        spec.jacket.breast === "double"
          ? "A double-breasted jacket closes with two of its buttons. Change the front for one, two or three."
          : "A single-breasted jacket has one, two or three buttons. Change the front for a double-breasted stance.",
      patch: (code) => ({ jacket: { buttons: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "lapel",
      part: "jacket",
      label: "Lapel",
      why: "The line the eye follows first; it should suit the occasion and your frame.",
      options: LAPEL_OPTIONS,
      current: (spec) => spec.jacket.lapel,
      allowed: (spec) => allowedOptions(spec).lapels,
      limitNote: (spec) => {
        if (spec.jacket.breast !== "double") return null;
        return spec.garment === "tuxedo"
          ? "A double-breasted jacket is cut with a peak lapel, or a shawl lapel on a tuxedo."
          : "A double-breasted jacket is cut with a peak lapel.";
      },
      patch: (code) => ({ jacket: { lapel: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "lapelWidth",
      part: "jacket",
      label: "Lapel width",
      why: "Balance the lapel against your shoulders and the width of your tie.",
      options: LAPEL_WIDTH_OPTIONS,
      current: (spec) => spec.jacket.lapelWidth,
      patch: (code) => ({ jacket: { lapelWidth: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "vents",
      part: "jacket",
      label: "Vents",
      why: "How the jacket moves and sits when you walk or put your hands in your pockets.",
      options: VENT_OPTIONS,
      current: (spec) => spec.jacket.vents,
      allowed: (spec) => allowedOptions(spec).vents,
      limitNote: (spec) => (spec.garment === "tuxedo" ? "A tuxedo is cut without a vent or with side vents." : null),
      patch: (code) => ({ jacket: { vents: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "pockets",
      part: "jacket",
      label: "Pockets",
      why: "Flaps for business, jetted for the evening, patch for ease.",
      options: POCKET_OPTIONS,
      current: (spec) => spec.jacket.pockets,
      allowed: (spec) => allowedOptions(spec).pockets,
      limitNote: (spec) => (spec.garment === "tuxedo" ? "A tuxedo is finished with jetted pockets." : null),
      patch: (code) => ({ jacket: { pockets: code } }),
    }),
  ),
  toggle({
    key: "ticketPocket",
    part: "jacket",
    label: "Ticket pocket",
    why: "A small third pocket above the right hip pocket.",
    get: (spec) => spec.jacket.ticketPocket,
    patch: (value) => ({ jacket: { ticketPocket: value } }),
    disabledReason: (spec) => {
      if (spec.garment === "tuxedo") return "A tuxedo has no ticket pocket.";
      if (spec.jacket.pockets === "patch") return "Patch pockets are cut without a ticket pocket.";
      return null;
    },
  }),
  choice(
    defineGroup({
      key: "canvas",
      part: "jacket",
      label: "Construction",
      why: "What gives the chest its shape, and how the jacket settles to you over time.",
      options: CANVAS_OPTIONS,
      current: (spec) => spec.jacket.canvas,
      patch: (code) => ({ jacket: { canvas: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "shoulder",
      part: "jacket",
      label: "Shoulder",
      why: "Soft or structured: the shoulder sets the jacket's posture.",
      options: SHOULDER_OPTIONS,
      current: (spec) => spec.jacket.shoulder,
      patch: (code) => ({ jacket: { shoulder: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "sleeveButtons",
      part: "jacket",
      label: "Sleeve buttons",
      why: "A small signature at the cuff.",
      options: SLEEVE_BUTTON_OPTIONS,
      current: (spec) => spec.jacket.sleeveButtons,
      patch: (code) => ({ jacket: { sleeveButtons: code } }),
    }),
  ),
  toggle({
    key: "workingCuffs",
    part: "jacket",
    label: "Working cuffs",
    why: "Buttonholes at the cuff that really open.",
    get: (spec) => spec.jacket.workingCuffs,
    patch: (value) => ({ jacket: { workingCuffs: value } }),
    disabledReason: () => null,
  }),
  choice(
    defineGroup({
      key: "fit",
      part: "trousers",
      label: "Fit",
      why: "How closely the leg follows you.",
      options: TROUSER_FIT_OPTIONS,
      current: (spec) => spec.trousers.fit,
      patch: (code) => ({ trousers: { fit: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "pleats",
      part: "trousers",
      label: "Front",
      why: "Pleats give ease when you sit; a flat front is the cleaner line.",
      options: PLEAT_OPTIONS,
      current: (spec) => spec.trousers.pleats,
      patch: (code) => ({ trousers: { pleats: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "rise",
      part: "trousers",
      label: "Rise",
      why: "Where the trousers sit on you, and how long the leg reads.",
      options: RISE_OPTIONS,
      current: (spec) => spec.trousers.rise,
      patch: (code) => ({ trousers: { rise: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "hem",
      part: "trousers",
      label: "Hem",
      why: "A cuff adds weight and a classic finish; a plain hem is cleaner.",
      options: HEM_OPTIONS,
      current: (spec) => spec.trousers.hem,
      allowed: (spec) => allowedOptions(spec).hems,
      limitNote: (spec) => (spec.garment === "tuxedo" ? "Tuxedo trousers are finished with a plain hem." : null),
      patch: (code) => ({ trousers: { hem: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "waistband",
      part: "trousers",
      label: "Waistband",
      why: "With a belt, or a clean waist without one.",
      options: WAISTBAND_OPTIONS,
      current: (spec) => spec.trousers.waistband,
      patch: (code) => ({ trousers: { waistband: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "waistcoatStyle",
      part: "waistcoat",
      label: "Style",
      why: "How the waistcoat fronts and how high it closes.",
      options: WAISTCOAT_STYLE_OPTIONS,
      current: (spec) => spec.waistcoat?.style ?? DEFAULT_WAISTCOAT.style,
      patch: (code) => ({ waistcoat: { style: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "waistcoatLapel",
      part: "waistcoat",
      label: "Lapel",
      why: "A clean V, or a soft roll under the jacket.",
      options: WAISTCOAT_LAPEL_OPTIONS,
      current: (spec) => spec.waistcoat?.lapel ?? DEFAULT_WAISTCOAT.lapel,
      patch: (code) => ({ waistcoat: { lapel: code } }),
    }),
  ),
  choice(
    defineGroup({
      key: "waistcoatBack",
      part: "waistcoat",
      label: "Back",
      why: "Cloth to wear it without the jacket; lining to sit lighter under it.",
      options: WAISTCOAT_BACK_OPTIONS,
      current: (spec) => spec.waistcoat?.back ?? DEFAULT_WAISTCOAT.back,
      patch: (code) => ({ waistcoat: { back: code } }),
    }),
  ),
];

export function detailRowsFor(part: DetailPart): readonly DetailRowDef[] {
  return DETAIL_ROWS.filter((row) => (row.kind === "choice" ? row.group.part : row.toggle.part) === part);
}

export function findGroup(key: string): DetailGroup | null {
  for (const row of DETAIL_ROWS) if (row.kind === "choice" && row.group.key === key) return row.group;
  return null;
}

export function optionLabel(options: readonly Option<string>[], code: string): string {
  return options.find((option) => option.code === code)?.label ?? code;
}

export function optionCode(options: readonly Option<string>[], code: string): string | null {
  return options.find((option) => option.code === code)?.productionId ?? null;
}

/** The production id the order book prints for a yes/no detail, read from the same describeSpec lines. */
export function toggleCode(spec: SuitSpec, toggle: DetailToggle): string | null {
  const line = describeSpec(spec).find(
    (entry) => entry.section === DETAIL_PART_LABELS[toggle.part] && entry.label === toggle.label,
  );
  return line?.productionId ?? null;
}

const lower = (options: readonly Option<string>[], codes: readonly string[]) =>
  codes.map((code) => optionLabel(options, code).toLowerCase());

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

/**
 * What choosing a base style brings with it, derived from the engine's defaults and rules so the words
 * cannot drift from what `applyChange` will do.
 */
export function garmentIncludes(garment: Garment): string[] {
  const resolved = applyChange(DEFAULT_SPEC, { garment }).spec;
  const allowed = allowedOptions(resolved);
  const lines: string[] = [];
  if (garment === "three_piece") {
    const waistcoat = resolved.waistcoat ?? DEFAULT_WAISTCOAT;
    lines.push("Jacket, waistcoat and trousers.");
    lines.push(
      `Brings a waistcoat: ${optionLabel(WAISTCOAT_STYLE_OPTIONS, waistcoat.style).toLowerCase()}, ${optionLabel(WAISTCOAT_LAPEL_OPTIONS, waistcoat.lapel).toLowerCase()}, ${optionLabel(WAISTCOAT_BACK_OPTIONS, waistcoat.back).toLowerCase()}. Each is a decision below.`,
    );
    return lines;
  }
  lines.push("Jacket and trousers.");
  if (garment === "tuxedo") {
    lines.push(
      `Brings satin facings, ${list(lower(POCKET_OPTIONS, allowed.pockets))}, ${list(lower(VENT_OPTIONS, allowed.vents))}, and a ${list(lower(HEM_OPTIONS, allowed.hems))} on the trousers. No ticket pocket.`,
    );
  } else {
    lines.push("Every pocket, vent and hem is open to you.");
  }
  return lines;
}
