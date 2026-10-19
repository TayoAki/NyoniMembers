import type { StatusTone } from "@/components/atelier/common/status-line";
import { pluralize } from "@/lib/format";
import type { FitProfileStatus } from "@convex/shared/atelier/enums";
import { MEASUREMENT_FIELDS, type MeasurementGroup, measurementField } from "@convex/shared/atelier/measurements";

/**
 * Words for the fit review desk (A03, O03). Every status word comes from the view's `statusLabel`
 * (FIT_PROFILE_STATUS_LABELS); this file only adds tones and the fitter-side phrasing of the flags.
 */

export const FIT_TITLE = "Fit review";
export const FIT_DESCRIPTION =
  "Measurement sheets awaiting a fitter, oldest first. Approve with the values you settle on and a note the client can read, or send one question back. A version a released commission was cut against never changes.";

export const FIT_STATUS_TONES: Record<FitProfileStatus, StatusTone> = {
  provisional: "warning",
  needs_clarification: "warning",
  approved: "success",
  superseded: "neutral",
};

export const PENDING_FIT_STATUSES: readonly FitProfileStatus[] = ["provisional", "needs_clarification"];

export function isPendingFit(status: FitProfileStatus): boolean {
  return PENDING_FIT_STATUSES.includes(status);
}

type Flags = { implausible: readonly string[]; uncertainFields: readonly string[]; missingRequired: readonly string[] };

/** The sheet's flags counted in words, never as bare numbers or colour. */
export function flagWords(flags: Flags): string[] {
  const words: string[] = [];
  if (flags.missingRequired.length > 0)
    words.push(`${pluralize(flags.missingRequired.length, "required field")} missing`);
  if (flags.implausible.length > 0)
    words.push(`${pluralize(flags.implausible.length, "value")} outside the usual range`);
  if (flags.uncertainFields.length > 0)
    words.push(`${pluralize(flags.uncertainFields.length, "field")} the client was unsure of`);
  return words;
}

export function fieldLabel(key: string): string {
  return measurementField(key)?.label ?? key;
}

/** The sheet's fields in guide order, grouped; keys the guide does not know come last so nothing is hidden. */
export function groupedMeasurementKeys(
  keys: readonly string[],
): { group: MeasurementGroup | "other"; keys: string[] }[] {
  const known = MEASUREMENT_FIELDS.filter((field) => keys.includes(field.key) || field.required);
  const groups: { group: MeasurementGroup | "other"; keys: string[] }[] = [];
  for (const field of known) {
    const entry = groups.find((candidate) => candidate.group === field.group);
    if (entry) entry.keys.push(field.key);
    else groups.push({ group: field.group, keys: [field.key] });
  }
  const unknown = keys.filter((key) => !measurementField(key));
  if (unknown.length > 0) groups.push({ group: "other", keys: [...unknown] });
  return groups;
}
