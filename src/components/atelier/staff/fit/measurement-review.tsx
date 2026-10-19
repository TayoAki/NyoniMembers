"use client";

import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { Input } from "@/components/ui/input";
import type { FitReviewView } from "@convex/atelier/fit";
import {
  formatMeasurement,
  MEASUREMENT_GROUP_LABELS,
  measurementField,
  roundMeasurement,
  fromCm,
  toCm,
  type Unit,
} from "@convex/shared/atelier/measurements";
import { fieldLabel, groupedMeasurementKeys } from "./fit-words";

export type ParsedValues = { cm: Record<string, number>; problems: string[] };

/**
 * The fitter's inputs, typed in the client's unit, snapped to the agreed grid (0.5 cm or a quarter inch) and
 * sent as centimetres, exactly as the client's own entry is; every problem named.
 */
export function parseFitterValues(
  values: Record<string, string>,
  units: Unit,
  required: readonly string[],
): ParsedValues {
  const cm: Record<string, number> = {};
  const problems: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const text = raw.trim();
    if (!text) continue;
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      problems.push(`${fieldLabel(key)} needs a number greater than zero.`);
      continue;
    }
    cm[key] = toCm(roundMeasurement(parsed, units), units);
  }
  const missing = required.filter((key) => cm[key] === undefined);
  if (missing.length > 0) problems.push(`Still needed: ${missing.map(fieldLabel).join(", ")}.`);
  return { cm, problems };
}

/** The input's starting text: the approved value where there is one, else the client's, in their unit. */
export function initialFitterValues(profile: FitReviewView["profile"]): Record<string, string> {
  const source = profile.approvedValues ?? profile.measurements;
  return Object.fromEntries(
    Object.entries(source).map(([key, valueCm]) => [key, displayNumber(valueCm, profile.units)]),
  );
}

function displayNumber(valueCm: number, units: Unit): string {
  const value = roundMeasurement(fromCm(valueCm, units), units);
  return units === "cm" ? value.toFixed(1).replace(/\.0$/, "") : value.toFixed(2).replace(/\.?0+$/, "");
}

function otherUnit(units: Unit): Unit {
  return units === "cm" ? "in" : "cm";
}

function bothUnits(valueCm: number, units: Unit): string {
  return `${formatMeasurement(valueCm, units)} · ${formatMeasurement(valueCm, otherUnit(units))}`;
}

/**
 * The measurement sheet as an order book (A03): the client's value, what to look at, the previous
 * approved value, and the fitter's own value. Values are stored in centimetres; the fitter types in the
 * unit the client used so the two columns read alike.
 */
export function MeasurementReview({
  profile,
  previousApproved,
  values,
  onChange,
  editable,
}: {
  profile: FitReviewView["profile"];
  previousApproved: FitReviewView["previousApproved"];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  editable: boolean;
}) {
  const units = profile.units;
  const keys = [
    ...new Set([
      ...Object.keys(profile.measurements),
      ...Object.keys(profile.approvedValues ?? {}),
      ...profile.missingRequired,
    ]),
  ];
  const groups = groupedMeasurementKeys(keys);
  const step = units === "cm" ? 0.5 : 0.25;

  return (
    <OrderBook>
      {groups.map((group) => (
        <div key={group.group}>
          <OrderBookSection>
            {group.group === "other" ? "Other" : MEASUREMENT_GROUP_LABELS[group.group]}
          </OrderBookSection>
          {group.keys.map((key) => {
            const field = measurementField(key);
            const submitted = profile.measurements[key];
            const approved = profile.approvedValues?.[key];
            const previous = previousApproved?.values[key];
            const implausible = profile.implausible.includes(key);
            const unsure = profile.uncertainFields.includes(key);
            const missing = submitted === undefined;
            const notes: string[] = [];
            if (missing && field?.required) notes.push("Not provided · required before approval");
            else if (missing) notes.push("Not provided");
            if (implausible && field) {
              notes.push(
                `Please check this one: the usual range is ${formatMeasurement(field.minCm, units)} to ${formatMeasurement(field.maxCm, units)}.`,
              );
            }
            if (unsure) notes.push("The client was unsure of this one.");
            if (previous !== undefined) {
              notes.push(`Previously approved (v${previousApproved?.version}): ${formatMeasurement(previous, units)}.`);
            }
            if (!editable && approved !== undefined && Math.abs(approved - (submitted ?? approved)) >= 0.05) {
              notes.push(`Fitter's value: ${bothUnits(approved, units)}.`);
            }
            const id = `fitter-${key}`;
            return (
              <OrderBookRow
                key={key}
                label={fieldLabel(key)}
                value={missing ? "Not provided" : bothUnits(submitted, units)}
                tone={missing || implausible ? "warning" : "default"}
                code={field ? key : null}
                note={notes.length > 0 ? notes.join(" ") : undefined}
                action={
                  editable ? (
                    <label htmlFor={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="sr-only sm:not-sr-only">Fitter&rsquo;s value</span>
                      <Input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        step={step}
                        min={0}
                        value={values[key] ?? ""}
                        onChange={(event) => onChange(key, event.target.value)}
                        aria-label={`Fitter's value for ${fieldLabel(key)} in ${units}`}
                        className="h-9 w-28 rounded-sm text-right tabular-nums"
                      />
                      <span className="w-6">{units}</span>
                    </label>
                  ) : approved !== undefined ? (
                    <span className="text-sm tabular-nums">{formatMeasurement(approved, units)}</span>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      ))}
    </OrderBook>
  );
}
