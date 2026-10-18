/**
 * The measurement sheet for guided remote measurements (C17, S21). Field order, guide text and
 * plausible ranges come from the house's size guide and a standard made-to-measure sheet; a fitter
 * reviews every submission before it can be approved, so these ranges are a sanity check, not a fit rule.
 */
export const UNITS = ["cm", "in"] as const;
export type Unit = (typeof UNITS)[number];

export type MeasurementGroup = "body" | "jacket" | "trousers";

export type MeasurementField = {
  key: string;
  label: string;
  group: MeasurementGroup;
  guide: string;
  /** Plausible range in centimetres; values outside are flagged for the fitter, not rejected. */
  minCm: number;
  maxCm: number;
  required: boolean;
};

export const MEASUREMENT_FIELDS: readonly MeasurementField[] = [
  { key: "height", label: "Height", group: "body", guide: "Stand straight against a wall without shoes.", minCm: 140, maxCm: 220, required: true },
  { key: "chest", label: "Chest", group: "body", guide: "Around the fullest part of the chest, under the arms, tape level and snug but not tight.", minCm: 80, maxCm: 150, required: true },
  { key: "waist", label: "Natural waist", group: "body", guide: "Around the narrowest point of the torso, usually just above the navel.", minCm: 65, maxCm: 150, required: true },
  { key: "seat", label: "Seat", group: "body", guide: "Around the fullest part of the seat, feet together.", minCm: 80, maxCm: 160, required: true },
  { key: "neck", label: "Neck", group: "body", guide: "Around the base of the neck where a collar sits.", minCm: 32, maxCm: 55, required: false },
  { key: "shoulder", label: "Shoulder width", group: "jacket", guide: "Across the back from shoulder bone to shoulder bone.", minCm: 38, maxCm: 60, required: true },
  { key: "sleeve", label: "Sleeve length", group: "jacket", guide: "From the shoulder seam over a slightly bent arm to the wrist bone.", minCm: 50, maxCm: 75, required: true },
  { key: "jacketLength", label: "Jacket length", group: "jacket", guide: "From the base of the collar at the back to where you want the hem, usually mid-hand.", minCm: 60, maxCm: 90, required: true },
  { key: "bicep", label: "Bicep", group: "jacket", guide: "Around the fullest part of the upper arm, relaxed.", minCm: 24, maxCm: 50, required: false },
  { key: "wrist", label: "Wrist", group: "jacket", guide: "Around the wrist bone.", minCm: 14, maxCm: 24, required: false },
  { key: "trouserWaist", label: "Trouser waist", group: "trousers", guide: "Where you wear your trousers; often a little below the natural waist.", minCm: 65, maxCm: 150, required: true },
  { key: "inseam", label: "Inseam", group: "trousers", guide: "From the crotch seam to the top of the shoe.", minCm: 60, maxCm: 100, required: true },
  { key: "outseam", label: "Outseam", group: "trousers", guide: "From the top of the waistband at the side to the top of the shoe.", minCm: 85, maxCm: 130, required: false },
  { key: "thigh", label: "Thigh", group: "trousers", guide: "Around the fullest part of the thigh, just below the seat.", minCm: 40, maxCm: 85, required: true },
  { key: "knee", label: "Knee", group: "trousers", guide: "Around the knee, leg straight.", minCm: 30, maxCm: 60, required: false },
  { key: "legOpening", label: "Leg opening", group: "trousers", guide: "The width you like at the hem, measured flat and doubled.", minCm: 30, maxCm: 55, required: false },
];

export const MEASUREMENT_GROUP_LABELS: Record<MeasurementGroup, string> = {
  body: "Body",
  jacket: "Jacket",
  trousers: "Trousers",
};

export function measurementField(key: string): MeasurementField | undefined {
  return MEASUREMENT_FIELDS.find((field) => field.key === key);
}

const CM_PER_INCH = 2.54;

/** Values are stored in centimetres; the client converts for display and entry. */
export function toCm(value: number, unit: Unit): number {
  return unit === "cm" ? value : value * CM_PER_INCH;
}

export function fromCm(valueCm: number, unit: Unit): number {
  return unit === "cm" ? valueCm : valueCm / CM_PER_INCH;
}

/** The agreed rounding rule: 0.5 cm, or a quarter inch. Round-tripping twice returns the same value. */
export function roundMeasurement(value: number, unit: Unit): number {
  const step = unit === "cm" ? 0.5 : 0.25;
  return Math.round(value / step) * step;
}

export function formatMeasurement(valueCm: number, unit: Unit): string {
  const value = roundMeasurement(fromCm(valueCm, unit), unit);
  return `${unit === "cm" ? value.toFixed(1).replace(/\.0$/, "") : value.toFixed(2).replace(/\.?0+$/, "")} ${unit}`;
}

/** Fields whose values fall outside the plausible range, for the fitter's attention. */
export function implausibleFields(measurementsCm: Record<string, number>): string[] {
  return Object.entries(measurementsCm)
    .filter(([key, value]) => {
      const field = measurementField(key);
      return field ? value < field.minCm || value > field.maxCm : true;
    })
    .map(([key]) => key);
}

export function missingRequiredFields(measurementsCm: Record<string, number>): string[] {
  return MEASUREMENT_FIELDS.filter((field) => field.required && measurementsCm[field.key] === undefined).map((field) => field.key);
}

export const JACKET_COMFORT = ["close", "easy", "relaxed"] as const;
export type JacketComfort = (typeof JACKET_COMFORT)[number];
export const JACKET_COMFORT_LABELS: Record<JacketComfort, string> = {
  close: "Close to the body",
  easy: "Easy through the chest",
  relaxed: "Relaxed",
};

export const TROUSER_COMFORT = ["close", "easy", "relaxed"] as const;
export type TrouserComfort = (typeof TROUSER_COMFORT)[number];
export const TROUSER_COMFORT_LABELS: Record<TrouserComfort, string> = {
  close: "Close through the leg",
  easy: "Easy through the seat and thigh",
  relaxed: "Relaxed",
};

/** How the suit will be worn; recorded explicitly (C17 acceptance). */
export const MOVEMENT_OPTIONS = ["seated_long", "driving", "performing", "dancing", "travel", "standing_long"] as const;
export type Movement = (typeof MOVEMENT_OPTIONS)[number];
export const MOVEMENT_LABELS: Record<Movement, string> = {
  seated_long: "Long hours seated",
  driving: "Driving",
  performing: "Performing on stage",
  dancing: "Dancing",
  travel: "Travel",
  standing_long: "Long hours standing",
};

export const POSTURE_OPTIONS = ["upright", "forward", "erect_shoulders", "sloping_shoulders"] as const;
export type Posture = (typeof POSTURE_OPTIONS)[number];
export const POSTURE_LABELS: Record<Posture, string> = {
  upright: "Upright",
  forward: "Forward-leaning",
  erect_shoulders: "Square shoulders",
  sloping_shoulders: "Sloping shoulders",
};
