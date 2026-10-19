import { ATELIER_LIMITS } from "./enums";

/**
 * The suit specification: the exact design a client commits to, and the production record the house
 * cuts from. Every option carries a stable `productionId` so the review, the export and the staff view
 * name the same thing (journeys C06, C07, C19). `applyChange` is the dependency engine behind S08.
 */

export const GARMENTS = ["two_piece", "three_piece", "tuxedo"] as const;
export type Garment = (typeof GARMENTS)[number];

export type Option<T extends string> = {
  code: T;
  label: string;
  description: string;
  productionId: string;
};

export const GARMENT_OPTIONS: readonly Option<Garment>[] = [
  {
    code: "two_piece",
    label: "Two-piece",
    description: "Versatile tailoring for work and beyond.",
    productionId: "GARMENT_2PC",
  },
  {
    code: "three_piece",
    label: "Three-piece",
    description: "Complete, considered elegance: jacket, waistcoat and trousers.",
    productionId: "GARMENT_3PC",
  },
  {
    code: "tuxedo",
    label: "Tuxedo",
    description: "Timeless formalwear for occasions, with satin facings.",
    productionId: "GARMENT_TUX",
  },
];

export const BREASTS = ["single", "double"] as const;
export type Breast = (typeof BREASTS)[number];
export const BREAST_OPTIONS: readonly Option<Breast>[] = [
  {
    code: "single",
    label: "Single-breasted",
    description: "One row of buttons; the classic line.",
    productionId: "BREAST_SB",
  },
  {
    code: "double",
    label: "Double-breasted",
    description: "Overlapping fronts with two rows of buttons; structured presence.",
    productionId: "BREAST_DB",
  },
];

export const BUTTON_STANCES = ["one", "two", "three", "four_by_two", "six_by_two"] as const;
export type ButtonStance = (typeof BUTTON_STANCES)[number];
export const BUTTON_STANCE_OPTIONS: readonly Option<ButtonStance>[] = [
  { code: "one", label: "One button", description: "The evening stance; a deep V.", productionId: "STANCE_1" },
  { code: "two", label: "Two buttons", description: "The modern standard.", productionId: "STANCE_2" },
  {
    code: "three",
    label: "Three buttons",
    description: "A higher, more traditional stance.",
    productionId: "STANCE_3",
  },
  {
    code: "four_by_two",
    label: "Four buttons, two to close",
    description: "A lower double-breasted front.",
    productionId: "STANCE_4X2",
  },
  {
    code: "six_by_two",
    label: "Six buttons, two to close",
    description: "The classic double-breasted front.",
    productionId: "STANCE_6X2",
  },
];
export const SINGLE_STANCES: readonly ButtonStance[] = ["one", "two", "three"];
export const DOUBLE_STANCES: readonly ButtonStance[] = ["four_by_two", "six_by_two"];

export const LAPELS = ["notch", "peak", "shawl"] as const;
export type Lapel = (typeof LAPELS)[number];
export const LAPEL_OPTIONS: readonly Option<Lapel>[] = [
  {
    code: "notch",
    label: "Notch lapel",
    description: "The everyday lapel; a step cut where collar meets lapel.",
    productionId: "LAPEL_NOTCH",
  },
  {
    code: "peak",
    label: "Peak lapel",
    description: "Points rising toward the shoulder; formal and assertive.",
    productionId: "LAPEL_PEAK",
  },
  {
    code: "shawl",
    label: "Shawl lapel",
    description: "A continuous curve; the dinner-jacket lapel.",
    productionId: "LAPEL_SHAWL",
  },
];

export const LAPEL_WIDTHS = ["slim", "standard", "wide"] as const;
export type LapelWidth = (typeof LAPEL_WIDTHS)[number];
export const LAPEL_WIDTH_OPTIONS: readonly Option<LapelWidth>[] = [
  { code: "slim", label: "Slim", description: "About 7 cm at the widest point.", productionId: "LAPELW_SLIM" },
  {
    code: "standard",
    label: "Standard",
    description: "About 9 cm; balanced for most frames.",
    productionId: "LAPELW_STD",
  },
  { code: "wide", label: "Wide", description: "About 11 cm; a classic, generous roll.", productionId: "LAPELW_WIDE" },
];

export const VENTS = ["none", "single", "double"] as const;
export type Vents = (typeof VENTS)[number];
export const VENT_OPTIONS: readonly Option<Vents>[] = [
  {
    code: "none",
    label: "No vent",
    description: "A clean back; traditional for a dinner jacket.",
    productionId: "VENT_NONE",
  },
  { code: "single", label: "Single vent", description: "One centre vent.", productionId: "VENT_SINGLE" },
  {
    code: "double",
    label: "Double vents",
    description: "Two side vents; the jacket sits well when you put your hands in your pockets.",
    productionId: "VENT_DOUBLE",
  },
];

export const POCKETS = ["flap", "jetted", "patch"] as const;
export type Pockets = (typeof POCKETS)[number];
export const POCKET_OPTIONS: readonly Option<Pockets>[] = [
  { code: "flap", label: "Flap pockets", description: "The standard business pocket.", productionId: "PKT_FLAP" },
  { code: "jetted", label: "Jetted pockets", description: "A clean, slim welt; formal.", productionId: "PKT_JETTED" },
  { code: "patch", label: "Patch pockets", description: "Sewn on the outside; relaxed.", productionId: "PKT_PATCH" },
];

export const CANVASES = ["half", "full"] as const;
export type Canvas = (typeof CANVASES)[number];
export const CANVAS_OPTIONS: readonly Option<Canvas>[] = [
  {
    code: "half",
    label: "Half canvas",
    description: "Canvassed through the chest and lapel.",
    productionId: "CANVAS_HALF",
  },
  {
    code: "full",
    label: "Full canvas",
    description: "Canvassed to the hem; shapes to you over time.",
    productionId: "CANVAS_FULL",
  },
];

export const SHOULDERS = ["natural", "roped"] as const;
export type Shoulder = (typeof SHOULDERS)[number];
export const SHOULDER_OPTIONS: readonly Option<Shoulder>[] = [
  {
    code: "natural",
    label: "Natural shoulder",
    description: "Soft, following your own line.",
    productionId: "SHLD_NATURAL",
  },
  {
    code: "roped",
    label: "Roped shoulder",
    description: "A raised sleevehead; structured.",
    productionId: "SHLD_ROPED",
  },
];

export const SLEEVE_BUTTONS = ["four", "five"] as const;
export type SleeveButtons = (typeof SLEEVE_BUTTONS)[number];
export const SLEEVE_BUTTON_OPTIONS: readonly Option<SleeveButtons>[] = [
  { code: "four", label: "Four buttons", description: "The standard cuff.", productionId: "CUFF_4" },
  { code: "five", label: "Five buttons", description: "A longer, more decorative run.", productionId: "CUFF_5" },
];

export const TROUSER_FITS = ["classic", "tailored", "slim"] as const;
export type TrouserFit = (typeof TROUSER_FITS)[number];
export const TROUSER_FIT_OPTIONS: readonly Option<TrouserFit>[] = [
  { code: "classic", label: "Classic", description: "A straight leg with room to move.", productionId: "TRS_CLASSIC" },
  {
    code: "tailored",
    label: "Tailored",
    description: "Follows the leg without gripping it.",
    productionId: "TRS_TAILORED",
  },
  { code: "slim", label: "Slim", description: "A narrow leg and a clean break.", productionId: "TRS_SLIM" },
];

export const PLEATS = ["flat", "single", "double"] as const;
export type Pleats = (typeof PLEATS)[number];
export const PLEAT_OPTIONS: readonly Option<Pleats>[] = [
  { code: "flat", label: "Flat front", description: "No pleats; the modern standard.", productionId: "PLEAT_FLAT" },
  {
    code: "single",
    label: "Single pleat",
    description: "One forward pleat for ease when seated.",
    productionId: "PLEAT_SINGLE",
  },
  {
    code: "double",
    label: "Double pleats",
    description: "Two pleats; classic and generous.",
    productionId: "PLEAT_DOUBLE",
  },
];

export const RISES = ["mid", "high"] as const;
export type Rise = (typeof RISES)[number];
export const RISE_OPTIONS: readonly Option<Rise>[] = [
  { code: "mid", label: "Mid rise", description: "Sits at the hip.", productionId: "RISE_MID" },
  {
    code: "high",
    label: "High rise",
    description: "Sits at the natural waist; lengthens the leg.",
    productionId: "RISE_HIGH",
  },
];

export const HEMS = ["plain", "cuffed"] as const;
export type Hem = (typeof HEMS)[number];
export const HEM_OPTIONS: readonly Option<Hem>[] = [
  { code: "plain", label: "Plain hem", description: "A clean finish.", productionId: "HEM_PLAIN" },
  { code: "cuffed", label: "Cuffed hem", description: "A 4 cm turn-up; weight at the hem.", productionId: "HEM_CUFF" },
];

export const WAISTBANDS = ["belt_loops", "side_adjusters"] as const;
export type Waistband = (typeof WAISTBANDS)[number];
export const WAISTBAND_OPTIONS: readonly Option<Waistband>[] = [
  { code: "belt_loops", label: "Belt loops", description: "For a belt.", productionId: "WB_LOOPS" },
  {
    code: "side_adjusters",
    label: "Side adjusters",
    description: "A clean waist without a belt.",
    productionId: "WB_ADJUSTERS",
  },
];

export const WAISTCOAT_STYLES = ["single_five", "single_six", "double"] as const;
export type WaistcoatStyle = (typeof WAISTCOAT_STYLES)[number];
export const WAISTCOAT_STYLE_OPTIONS: readonly Option<WaistcoatStyle>[] = [
  {
    code: "single_five",
    label: "Single-breasted, five buttons",
    description: "The standard waistcoat.",
    productionId: "WC_SB5",
  },
  {
    code: "single_six",
    label: "Single-breasted, six buttons",
    description: "A slightly higher front.",
    productionId: "WC_SB6",
  },
  { code: "double", label: "Double-breasted", description: "A statement under the jacket.", productionId: "WC_DB" },
];
export const WAISTCOAT_LAPELS = ["none", "shawl"] as const;
export type WaistcoatLapel = (typeof WAISTCOAT_LAPELS)[number];
export const WAISTCOAT_LAPEL_OPTIONS: readonly Option<WaistcoatLapel>[] = [
  { code: "none", label: "No lapel", description: "A clean V neckline.", productionId: "WCL_NONE" },
  { code: "shawl", label: "Shawl lapel", description: "A soft rolled lapel.", productionId: "WCL_SHAWL" },
];
export const WAISTCOAT_BACKS = ["cloth", "lining"] as const;
export type WaistcoatBack = (typeof WAISTCOAT_BACKS)[number];
export const WAISTCOAT_BACK_OPTIONS: readonly Option<WaistcoatBack>[] = [
  {
    code: "cloth",
    label: "Cloth back",
    description: "The suit cloth continues round; wearable without the jacket.",
    productionId: "WCB_CLOTH",
  },
  {
    code: "lining",
    label: "Lining back",
    description: "Traditional; lighter under the jacket.",
    productionId: "WCB_LINING",
  },
];

export const MONOGRAM_PLACEMENTS = ["inside_pocket", "inside_chest", "cuff"] as const;
export type MonogramPlacement = (typeof MONOGRAM_PLACEMENTS)[number];
export const MONOGRAM_PLACEMENT_OPTIONS: readonly Option<MonogramPlacement>[] = [
  {
    code: "inside_pocket",
    label: "Inside pocket",
    description: "Above the inside breast pocket.",
    productionId: "MONO_POCKET",
  },
  {
    code: "inside_chest",
    label: "Inside chest",
    description: "On the lining, below the collar.",
    productionId: "MONO_CHEST",
  },
  { code: "cuff", label: "Cuff", description: "Inside the left cuff.", productionId: "MONO_CUFF" },
];
export const MONOGRAM_THREADS = ["gold", "ivory", "navy", "tonal"] as const;
export type MonogramThread = (typeof MONOGRAM_THREADS)[number];
export const MONOGRAM_THREAD_OPTIONS: readonly Option<MonogramThread>[] = [
  { code: "gold", label: "Gold", description: "The house thread.", productionId: "THR_GOLD" },
  { code: "ivory", label: "Ivory", description: "Quiet on dark linings.", productionId: "THR_IVORY" },
  { code: "navy", label: "Navy", description: "Quiet on light linings.", productionId: "THR_NAVY" },
  { code: "tonal", label: "Tonal", description: "Matched to the lining.", productionId: "THR_TONAL" },
];
export const MONOGRAM_FONTS = ["script", "block"] as const;
export type MonogramFont = (typeof MONOGRAM_FONTS)[number];
export const MONOGRAM_FONT_OPTIONS: readonly Option<MonogramFont>[] = [
  { code: "script", label: "Script", description: "A flowing hand.", productionId: "FONT_SCRIPT" },
  { code: "block", label: "Block", description: "Upright capitals.", productionId: "FONT_BLOCK" },
];

export type JacketSpec = {
  breast: Breast;
  buttons: ButtonStance;
  lapel: Lapel;
  lapelWidth: LapelWidth;
  vents: Vents;
  pockets: Pockets;
  ticketPocket: boolean;
  canvas: Canvas;
  shoulder: Shoulder;
  sleeveButtons: SleeveButtons;
  workingCuffs: boolean;
};

export type TrouserSpec = {
  fit: TrouserFit;
  pleats: Pleats;
  rise: Rise;
  hem: Hem;
  waistband: Waistband;
};

export type WaistcoatSpec = {
  style: WaistcoatStyle;
  lapel: WaistcoatLapel;
  back: WaistcoatBack;
};

export type Monogram = {
  text: string;
  placement: MonogramPlacement;
  thread: MonogramThread;
  font: MonogramFont;
};

export type SuitSpec = {
  garment: Garment;
  clothCode: string | null;
  jacket: JacketSpec;
  trousers: TrouserSpec;
  waistcoat: WaistcoatSpec | null;
  buttonCode: string | null;
  liningCode: string | null;
  monogram: Monogram | null;
};

export const DEFAULT_WAISTCOAT: WaistcoatSpec = { style: "single_five", lapel: "none", back: "lining" };

export const DEFAULT_SPEC: SuitSpec = {
  garment: "two_piece",
  clothCode: null,
  jacket: {
    breast: "single",
    buttons: "two",
    lapel: "notch",
    lapelWidth: "standard",
    vents: "double",
    pockets: "flap",
    ticketPocket: false,
    canvas: "half",
    shoulder: "natural",
    sleeveButtons: "four",
    workingCuffs: true,
  },
  trousers: { fit: "tailored", pleats: "flat", rise: "mid", hem: "plain", waistband: "side_adjusters" },
  waistcoat: null,
  buttonCode: null,
  liningCode: null,
  monogram: null,
};

/** A partial change: top-level keys replace, `jacket`/`trousers`/`waistcoat` merge field by field. */
export type SpecPatch = {
  garment?: Garment;
  clothCode?: string | null;
  jacket?: Partial<JacketSpec>;
  trousers?: Partial<TrouserSpec>;
  waistcoat?: Partial<WaistcoatSpec> | null;
  buttonCode?: string | null;
  liningCode?: string | null;
  monogram?: Monogram | null;
};

export type Conflict = {
  /** Dot path of the field the engine had to change, e.g. "jacket.lapel". */
  field: string;
  label: string;
  from: string;
  to: string;
  reason: string;
};

export type ApplyResult = { spec: SuitSpec; conflicts: Conflict[] };

function mergePatch(spec: SuitSpec, patch: SpecPatch): SuitSpec {
  const next: SuitSpec = {
    ...spec,
    jacket: { ...spec.jacket, ...(patch.jacket ?? {}) },
    trousers: { ...spec.trousers, ...(patch.trousers ?? {}) },
  };
  if (patch.garment !== undefined) next.garment = patch.garment;
  if (patch.clothCode !== undefined) next.clothCode = patch.clothCode;
  if (patch.buttonCode !== undefined) next.buttonCode = patch.buttonCode;
  if (patch.liningCode !== undefined) next.liningCode = patch.liningCode;
  if (patch.monogram !== undefined) next.monogram = patch.monogram;
  if (patch.waistcoat === null) next.waistcoat = null;
  else if (patch.waistcoat !== undefined)
    next.waistcoat = { ...(spec.waistcoat ?? DEFAULT_WAISTCOAT), ...patch.waistcoat };
  return next;
}

function labelOf<T extends string>(options: readonly Option<T>[], code: T): string {
  return options.find((option) => option.code === code)?.label ?? code;
}

const JACKET_OPTION_TABLES: { readonly [K in keyof JacketSpec]?: readonly Option<string>[] } = {
  breast: BREAST_OPTIONS,
  buttons: BUTTON_STANCE_OPTIONS,
  lapel: LAPEL_OPTIONS,
  lapelWidth: LAPEL_WIDTH_OPTIONS,
  vents: VENT_OPTIONS,
  pockets: POCKET_OPTIONS,
  canvas: CANVAS_OPTIONS,
  shoulder: SHOULDER_OPTIONS,
  sleeveButtons: SLEEVE_BUTTON_OPTIONS,
};

/** A jacket value in the words the client reads: the option's label, or Yes / No, as `describeSpec` says it. */
function jacketValueLabel<K extends keyof JacketSpec>(key: K, value: JacketSpec[K]): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const table = JACKET_OPTION_TABLES[key];
  return table ? labelOf(table, String(value)) : String(value);
}

/**
 * Applies a change and resolves the tailoring dependencies (contract §3). The returned spec is always
 * manufacturable; `conflicts` lists every field the engine moved beyond what the patch asked for, so
 * the client can confirm the whole change or cancel and keep the original.
 */
export function applyChange(spec: SuitSpec, patch: SpecPatch): ApplyResult {
  const next = mergePatch(spec, patch);
  const conflicts: Conflict[] = [];
  const touched = new Set<string>();
  const note = (field: keyof SpecPatch | "jacket" | "trousers" | "waistcoat", sub?: string) => {
    if (sub) touched.add(`${field}.${sub}`);
    else touched.add(field);
  };
  if (patch.garment !== undefined) note("garment");
  for (const key of Object.keys(patch.jacket ?? {})) note("jacket", key);
  for (const key of Object.keys(patch.trousers ?? {})) note("trousers", key);
  if (patch.waistcoat !== undefined) note("waistcoat");

  // Every move away from what the merged patch asked for is reported, whether or not the client touched
  // the field: an impossible request is told so, never silently corrected (S08).
  const move = <K extends keyof JacketSpec>(key: K, to: JacketSpec[K], label: string, reason: string) => {
    const from = next.jacket[key];
    if (from === to) return;
    conflicts.push({
      field: `jacket.${key}`,
      label,
      from: jacketValueLabel(key, from),
      to: jacketValueLabel(key, to),
      reason,
    });
    next.jacket[key] = to;
  };

  // Rule 1: breast and stance, lapel.
  if (next.jacket.breast === "double") {
    if (!DOUBLE_STANCES.includes(next.jacket.buttons)) {
      move("buttons", "six_by_two", "Button stance", "A double-breasted jacket closes with two of its buttons.");
    }
    if (next.jacket.lapel === "notch") {
      move("lapel", "peak", "Lapel", "A double-breasted jacket is cut with a peak lapel.");
    }
  } else if (!SINGLE_STANCES.includes(next.jacket.buttons)) {
    move("buttons", "two", "Button stance", "A single-breasted jacket has one, two or three buttons.");
  }

  // Rule 2: shawl lapel belongs to the dinner jacket or a one-button single-breasted jacket.
  if (next.jacket.lapel === "shawl" && next.garment !== "tuxedo") {
    if (next.jacket.breast === "double") {
      move("lapel", "peak", "Lapel", "A shawl lapel is cut on a tuxedo or a one-button single-breasted jacket.");
    } else if (next.jacket.buttons !== "one") {
      if (touched.has("jacket.lapel")) {
        move("buttons", "one", "Button stance", "A shawl lapel is cut with a single button.");
      } else {
        move("lapel", "notch", "Lapel", "A shawl lapel is cut with a single button.");
      }
    }
  }

  // Rule 3: tuxedo details.
  if (next.garment === "tuxedo") {
    if (next.jacket.pockets !== "jetted") {
      move("pockets", "jetted", "Pockets", "A tuxedo is finished with jetted pockets.");
    }
    if (next.jacket.ticketPocket) {
      move("ticketPocket", false, "Ticket pocket", "A tuxedo has no ticket pocket.");
    }
    if (next.jacket.vents === "single") {
      move("vents", "none", "Vents", "A tuxedo is cut without a vent or with side vents.");
    }
    // Rule 5: no cuffs on tuxedo trousers.
    if (next.trousers.hem === "cuffed") {
      conflicts.push({
        field: "trousers.hem",
        label: "Trouser hem",
        from: labelOf(HEM_OPTIONS, next.trousers.hem),
        to: labelOf(HEM_OPTIONS, "plain"),
        reason: "Tuxedo trousers are finished with a plain hem.",
      });
      next.trousers.hem = "plain";
    }
  } else if (next.jacket.pockets === "patch" && next.jacket.ticketPocket) {
    move("ticketPocket", false, "Ticket pocket", "Patch pockets are cut without a ticket pocket.");
  }

  // Rule 4: the waistcoat exists only on a three-piece.
  if (next.garment === "three_piece" && next.waistcoat === null) {
    conflicts.push({
      field: "waistcoat",
      label: "Waistcoat",
      from: "none",
      to: labelOf(WAISTCOAT_STYLE_OPTIONS, DEFAULT_WAISTCOAT.style),
      reason: "A three-piece includes a waistcoat.",
    });
    next.waistcoat = { ...DEFAULT_WAISTCOAT };
  }
  if (next.garment !== "three_piece" && next.waistcoat !== null) {
    conflicts.push({
      field: "waistcoat",
      label: "Waistcoat",
      from: labelOf(WAISTCOAT_STYLE_OPTIONS, next.waistcoat.style),
      to: "none",
      reason: `A ${labelOf(GARMENT_OPTIONS, next.garment).toLowerCase()} has no waistcoat.`,
    });
    next.waistcoat = null;
  }

  return { spec: next, conflicts: mergeConflicts(conflicts) };
}

/** One line per field: the first value it held, the value it ends on, and every reason in order. */
function mergeConflicts(conflicts: Conflict[]): Conflict[] {
  const merged: Conflict[] = [];
  for (const conflict of conflicts) {
    const existing = merged.find((entry) => entry.field === conflict.field);
    if (!existing) {
      merged.push({ ...conflict });
      continue;
    }
    existing.to = conflict.to;
    if (!existing.reason.includes(conflict.reason)) existing.reason = `${existing.reason} ${conflict.reason}`;
  }
  return merged.filter((entry) => entry.from !== entry.to);
}

/** Which pocket, vent and hem options the current garment may show at all (rule 3 and 5). */
export function allowedOptions(spec: SuitSpec): {
  pockets: readonly Pockets[];
  vents: readonly Vents[];
  hems: readonly Hem[];
  lapels: readonly Lapel[];
  buttons: readonly ButtonStance[];
} {
  const tuxedo = spec.garment === "tuxedo";
  return {
    pockets: tuxedo ? ["jetted"] : POCKETS,
    vents: tuxedo ? ["none", "double"] : VENTS,
    hems: tuxedo ? ["plain"] : HEMS,
    lapels: spec.jacket.breast === "double" ? (tuxedo ? ["peak", "shawl"] : ["peak"]) : LAPELS,
    buttons: spec.jacket.breast === "double" ? DOUBLE_STANCES : SINGLE_STANCES,
  };
}

const MONOGRAM_PATTERN = /^[A-Z.]+$/;

/**
 * Field errors that block committing or submitting a spec; an empty array means the design is complete
 * and valid. This is the one gate (contract §3): the tailoring rules 1 to 5 are read off the dependency
 * engine itself, so a spec the engine would still move cannot pass, whichever writer produced it.
 */
export function validateSpec(spec: SuitSpec): string[] {
  const errors: string[] = [];
  if (!spec.clothCode) errors.push("Choose a cloth.");
  if (spec.monogram) {
    const text = spec.monogram.text.trim();
    if (text.length === 0) errors.push("Enter the monogram letters or remove the monogram.");
    else if (text.length > ATELIER_LIMITS.monogramMaxChars)
      errors.push(`A monogram is at most ${ATELIER_LIMITS.monogramMaxChars} characters.`);
    else if (!MONOGRAM_PATTERN.test(text)) errors.push("A monogram uses capital letters A to Z and full stops only.");
  }
  for (const conflict of applyChange(spec, {}).conflicts) {
    if (!errors.includes(conflict.reason)) errors.push(conflict.reason);
  }
  return errors;
}

/**
 * One decision in the design as a dot path, at the grain a group's brief uses (C28): each jacket and
 * trouser line on its own, the waistcoat and the monogram as one line each.
 */
export type SpecPath =
  | "garment"
  | "clothCode"
  | `jacket.${keyof JacketSpec}`
  | `trousers.${keyof TrouserSpec}`
  | "waistcoat"
  | "buttonCode"
  | "liningCode"
  | "monogram";

/** The label each line carries when named on its own, in order-book order. */
export const SPEC_PATH_LABELS: Record<SpecPath, string> = {
  garment: "Garment",
  clothCode: "Cloth",
  "jacket.breast": "Front",
  "jacket.buttons": "Button stance",
  "jacket.lapel": "Lapel",
  "jacket.lapelWidth": "Lapel width",
  "jacket.vents": "Vents",
  "jacket.pockets": "Pockets",
  "jacket.ticketPocket": "Ticket pocket",
  "jacket.canvas": "Construction",
  "jacket.shoulder": "Shoulder",
  "jacket.sleeveButtons": "Sleeve buttons",
  "jacket.workingCuffs": "Working cuffs",
  "trousers.fit": "Trouser fit",
  "trousers.pleats": "Trouser front",
  "trousers.rise": "Rise",
  "trousers.hem": "Trouser hem",
  "trousers.waistband": "Waistband",
  waistcoat: "Waistcoat",
  buttonCode: "Buttons",
  liningCode: "Lining",
  monogram: "Monogram",
};

export const SPEC_PATHS: readonly SpecPath[] = Object.keys(SPEC_PATH_LABELS) as SpecPath[];

export function isSpecPath(value: string): value is SpecPath {
  return value in SPEC_PATH_LABELS;
}

/** The line's label, or the path itself for one this vocabulary does not know. */
export function specPathLabel(path: string): string {
  return isSpecPath(path) ? SPEC_PATH_LABELS[path] : path;
}

function valueAt(spec: SuitSpec, path: SpecPath): unknown {
  const [head, key] = path.split(".");
  if (head === "jacket" && key) return spec.jacket[key as keyof JacketSpec];
  if (head === "trousers" && key) return spec.trousers[key as keyof TrouserSpec];
  return spec[head as keyof SuitSpec];
}

/** The lines on which two designs differ, in order-book order; empty when they are the same design. */
export function specDifferences(a: SuitSpec, b: SuitSpec): SpecPath[] {
  return SPEC_PATHS.filter((path) => canonicalJson(valueAt(a, path)) !== canonicalJson(valueAt(b, path)));
}

/** JSON with keys sorted at every level, so two equal values read alike whatever order they were written in. */
function canonicalJson(value: unknown): string {
  const sort = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sort);
    if (entry && typeof entry === "object") {
      return Object.fromEntries(
        Object.keys(entry as Record<string, unknown>)
          .sort()
          .map((key) => [key, sort((entry as Record<string, unknown>)[key])]),
      );
    }
    return entry;
  };
  return JSON.stringify(sort(value));
}

/** Deterministic string for hashing: keys sorted at every level, so two equal specs hash alike. */
export function canonicalSpec(spec: SuitSpec): string {
  return canonicalJson(spec);
}

/** FNV-1a (64-bit, as two 32-bit halves) over the canonical spec. Runs in the browser and in Convex. */
export function specHash(spec: SuitSpec): string {
  const text = canonicalSpec(spec);
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c * 31) & 0xff), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export type DescribedLine = {
  section: "Garment" | "Cloth" | "Jacket" | "Trousers" | "Waistcoat" | "Details";
  label: string;
  value: string;
  productionId?: string;
};

export type SpecNames = {
  cloth?: { name: string; mill?: string; code: string } | null;
  button?: { name: string; code: string } | null;
  lining?: { name: string; code: string } | null;
};

/** The order-book lines for the review step, the export and the staff view. Same function, same words. */
export function describeSpec(spec: SuitSpec, names: SpecNames = {}): DescribedLine[] {
  const pick = <T extends string>(options: readonly Option<T>[], code: T) => {
    const option = options.find((o) => o.code === code);
    return { value: option?.label ?? code, productionId: option?.productionId ?? code.toUpperCase() };
  };
  const lines: DescribedLine[] = [];
  lines.push({ section: "Garment", label: "Garment", ...pick(GARMENT_OPTIONS, spec.garment) });
  lines.push({
    section: "Cloth",
    label: "Cloth",
    value: names.cloth
      ? `${names.cloth.name}${names.cloth.mill ? ` · ${names.cloth.mill}` : ""}`
      : spec.clothCode
        ? spec.clothCode
        : "Not yet chosen",
    productionId: names.cloth?.code ?? spec.clothCode ?? undefined,
  });
  const j = spec.jacket;
  lines.push({ section: "Jacket", label: "Front", ...pick(BREAST_OPTIONS, j.breast) });
  lines.push({ section: "Jacket", label: "Buttons", ...pick(BUTTON_STANCE_OPTIONS, j.buttons) });
  lines.push({ section: "Jacket", label: "Lapel", ...pick(LAPEL_OPTIONS, j.lapel) });
  lines.push({ section: "Jacket", label: "Lapel width", ...pick(LAPEL_WIDTH_OPTIONS, j.lapelWidth) });
  lines.push({ section: "Jacket", label: "Vents", ...pick(VENT_OPTIONS, j.vents) });
  lines.push({ section: "Jacket", label: "Pockets", ...pick(POCKET_OPTIONS, j.pockets) });
  lines.push({
    section: "Jacket",
    label: "Ticket pocket",
    value: j.ticketPocket ? "Yes" : "No",
    productionId: j.ticketPocket ? "TKT_YES" : "TKT_NO",
  });
  lines.push({ section: "Jacket", label: "Construction", ...pick(CANVAS_OPTIONS, j.canvas) });
  lines.push({ section: "Jacket", label: "Shoulder", ...pick(SHOULDER_OPTIONS, j.shoulder) });
  lines.push({ section: "Jacket", label: "Sleeve buttons", ...pick(SLEEVE_BUTTON_OPTIONS, j.sleeveButtons) });
  lines.push({
    section: "Jacket",
    label: "Working cuffs",
    value: j.workingCuffs ? "Yes" : "No",
    productionId: j.workingCuffs ? "CUFF_WORKING" : "CUFF_FIXED",
  });
  const t = spec.trousers;
  lines.push({ section: "Trousers", label: "Fit", ...pick(TROUSER_FIT_OPTIONS, t.fit) });
  lines.push({ section: "Trousers", label: "Front", ...pick(PLEAT_OPTIONS, t.pleats) });
  lines.push({ section: "Trousers", label: "Rise", ...pick(RISE_OPTIONS, t.rise) });
  lines.push({ section: "Trousers", label: "Hem", ...pick(HEM_OPTIONS, t.hem) });
  lines.push({ section: "Trousers", label: "Waistband", ...pick(WAISTBAND_OPTIONS, t.waistband) });
  if (spec.waistcoat) {
    lines.push({ section: "Waistcoat", label: "Style", ...pick(WAISTCOAT_STYLE_OPTIONS, spec.waistcoat.style) });
    lines.push({ section: "Waistcoat", label: "Lapel", ...pick(WAISTCOAT_LAPEL_OPTIONS, spec.waistcoat.lapel) });
    lines.push({ section: "Waistcoat", label: "Back", ...pick(WAISTCOAT_BACK_OPTIONS, spec.waistcoat.back) });
  }
  lines.push({
    section: "Details",
    label: "Buttons",
    value: names.button?.name ?? spec.buttonCode ?? "House choice at fitting",
    productionId: names.button?.code ?? spec.buttonCode ?? undefined,
  });
  lines.push({
    section: "Details",
    label: "Lining",
    value: names.lining?.name ?? spec.liningCode ?? "House choice at fitting",
    productionId: names.lining?.code ?? spec.liningCode ?? undefined,
  });
  if (spec.monogram) {
    const placement = pick(MONOGRAM_PLACEMENT_OPTIONS, spec.monogram.placement);
    const thread = pick(MONOGRAM_THREAD_OPTIONS, spec.monogram.thread);
    const font = pick(MONOGRAM_FONT_OPTIONS, spec.monogram.font);
    lines.push({
      section: "Details",
      label: "Monogram",
      value: `${spec.monogram.text} · ${placement.value} · ${thread.value} · ${font.value}`,
      productionId: `${placement.productionId}+${thread.productionId}+${font.productionId}`,
    });
  } else {
    lines.push({ section: "Details", label: "Monogram", value: "None", productionId: "MONO_NONE" });
  }
  return lines;
}

/** One line for lists and job labels: "Two-piece · peak lapel · Loro Piana 365". */
export function specSummary(spec: SuitSpec, clothName?: string | null): string {
  const garment = GARMENT_OPTIONS.find((o) => o.code === spec.garment)?.label ?? spec.garment;
  const breast = spec.jacket.breast === "double" ? "double-breasted" : null;
  const lapel = `${LAPEL_OPTIONS.find((o) => o.code === spec.jacket.lapel)?.label.toLowerCase() ?? spec.jacket.lapel}`;
  return [garment, breast, lapel, clothName ?? (spec.clothCode ? spec.clothCode : "no cloth yet")]
    .filter(Boolean)
    .join(" · ");
}

/** Which of the seven studio steps are satisfied by the spec and draft facts. */
export function completedStepsFor(
  spec: SuitSpec,
  facts: { occasionSet: boolean; previewDone: boolean; fitRouteSet: boolean },
): string[] {
  const done: string[] = [];
  if (facts.occasionSet) done.push("occasion");
  if (spec.clothCode) done.push("cloth");
  done.push("style");
  if (spec.buttonCode || spec.liningCode || spec.monogram) done.push("details");
  if (facts.previewDone) done.push("preview");
  if (facts.fitRouteSet) done.push("fit");
  return done;
}
