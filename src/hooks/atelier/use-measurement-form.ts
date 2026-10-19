"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FitProfileView, FitSubmission } from "@convex/atelier/fit";
import {
  formatMeasurement,
  JACKET_COMFORT,
  MEASUREMENT_FIELDS,
  measurementField,
  MOVEMENT_OPTIONS,
  POSTURE_OPTIONS,
  roundMeasurement,
  toCm,
  TROUSER_COMFORT,
  UNITS,
  type JacketComfort,
  type MeasurementField,
  type Movement,
  type Posture,
  type TrouserComfort,
  type Unit,
} from "@convex/shared/atelier/measurements";

/**
 * The guided measurement sheet (S21, C17). Values are kept in centimetres exactly as entered and
 * converted; only the text in the inputs is rounded to the agreed step (0.5 cm or a quarter inch), so
 * switching units any number of times returns the same numbers (acceptance scenario 6). Nothing here
 * approves anything: the sheet becomes a provisional version a fitter reviews.
 */
export type SheetValues = {
  unit: Unit;
  /** Canonical values in centimetres, keyed by `MEASUREMENT_FIELDS[].key`. */
  cm: Record<string, number>;
  uncertain: string[];
  jacket: JacketComfort | null;
  trousers: TrouserComfort | null;
  movement: Movement[];
  posture: Posture | null;
  notes: string;
};

export const EMPTY_SHEET: SheetValues = {
  unit: "cm",
  cm: {},
  uncertain: [],
  jacket: null,
  trousers: null,
  movement: [],
  posture: null,
  notes: "",
};

/** Where an unsent sheet waits in this browser, so signing in does not lose what was typed. */
export const SHEET_STORAGE_KEY = "nyoni.atelier.fit-sheet";

export const UNIT_LABELS: Record<Unit, string> = { cm: "Centimetres", in: "Inches" };

/** The number alone, rounded to the unit's step: "38.5" or "15.25". */
export function formatValue(valueCm: number, unit: Unit): string {
  return formatMeasurement(valueCm, unit).replace(/ (cm|in)$/, "");
}

/** Accepts "38.5", "38,5" or ".5"; anything else is not a number. */
export function parseEntry(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** A revision starts from the values the fitter approved, or the submitted ones before approval. */
export function sheetFromProfile(profile: FitProfileView): SheetValues {
  return {
    unit: profile.units,
    cm: { ...(profile.approvedValues ?? profile.measurements) },
    uncertain: [...profile.uncertainFields],
    jacket: profile.comfort.jacket,
    trousers: profile.comfort.trousers,
    movement: [...profile.comfort.movement],
    posture: profile.posture,
    notes: profile.notes ?? "",
  };
}

function textsFor(cm: Record<string, number>, unit: Unit): Record<string, string> {
  return Object.fromEntries(Object.entries(cm).map(([key, value]) => [key, formatValue(value, unit)]));
}

function oneOf<T extends string>(options: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;
}

/** Storage can hold anything; only sheet-shaped, on-sheet values come back. */
function sanitize(raw: unknown): SheetValues | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Record<keyof SheetValues, unknown>>;
  const cm: Record<string, number> = {};
  if (value.cm && typeof value.cm === "object") {
    for (const [key, entry] of Object.entries(value.cm as Record<string, unknown>)) {
      if (measurementField(key) && typeof entry === "number" && Number.isFinite(entry) && entry > 0) cm[key] = entry;
    }
  }
  const list = <T extends string>(options: readonly T[], entries: unknown): T[] =>
    Array.isArray(entries)
      ? entries.map((entry) => oneOf(options, entry)).filter((entry): entry is T => entry !== null)
      : [];
  return {
    unit: oneOf(UNITS, value.unit) ?? "cm",
    cm,
    uncertain: Array.isArray(value.uncertain)
      ? value.uncertain.filter((key): key is string => typeof key === "string" && Boolean(measurementField(key)))
      : [],
    jacket: oneOf(JACKET_COMFORT, value.jacket),
    trousers: oneOf(TROUSER_COMFORT, value.trousers),
    movement: list(MOVEMENT_OPTIONS, value.movement),
    posture: oneOf(POSTURE_OPTIONS, value.posture),
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function readPersisted(key: string): SheetValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writePersisted(key: string, sheet: SheetValues): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(sheet));
  } catch {
    // Storage refused: the sheet lives in memory for this page only, and the form says so.
  }
}

function clearPersistedKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

function isEmptySheet(sheet: SheetValues): boolean {
  return (
    Object.keys(sheet.cm).length === 0 &&
    sheet.uncertain.length === 0 &&
    sheet.jacket === null &&
    sheet.trousers === null &&
    sheet.movement.length === 0 &&
    sheet.posture === null &&
    sheet.notes.trim() === ""
  );
}

type FormState = {
  sheet: SheetValues;
  texts: Record<string, string>;
  /** True when the sheet shown was brought back from this browser's storage. */
  restored: boolean;
};

function startState(sheet: SheetValues, restored: boolean): FormState {
  return { sheet, texts: textsFor(sheet.cm, sheet.unit), restored };
}

export type MeasurementFieldState = {
  text: string;
  valueCm: number | null;
  uncertain: boolean;
  /** A blocking problem, shown once the field was left or a submit was attempted. */
  error: string | null;
  /** A plausibility hint: never blocks ("Please check this one"). */
  hint: string | null;
  implausible: boolean;
};

export type MeasurementFormOptions = {
  /** Prefilled values for a revision; taken once, at mount. */
  initial?: SheetValues;
  /** Keep an unsent sheet in this browser under this key; null keeps nothing. */
  persistKey?: string | null;
};

/**
 * Storage is read in the first render, so the component using this hook must render on the client
 * only (the fit page loads the sheet with `ssr: false`); otherwise the server and the browser would
 * disagree about the first paint.
 */
export function useMeasurementForm({ initial, persistKey = null }: MeasurementFormOptions = {}) {
  const [initialSheet] = useState<SheetValues>(() => initial ?? EMPTY_SHEET);
  const [state, setState] = useState<FormState>(() => {
    const start = initial ?? EMPTY_SHEET;
    const stored = initial === undefined && persistKey ? readPersisted(persistKey) : null;
    return stored && !isEmptySheet(stored) ? startState(stored, true) : startState(start, false);
  });
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const persisting = persistKey !== null && initial === undefined;

  useEffect(() => {
    if (!persisting || !persistKey) return;
    if (isEmptySheet(state.sheet)) clearPersistedKey(persistKey);
    else writePersisted(persistKey, state.sheet);
  }, [state.sheet, persistKey, persisting]);

  const { sheet, texts, restored } = state;
  const unit = sheet.unit;

  const setUnit = useCallback((next: Unit) => {
    setState((prev) => {
      if (prev.sheet.unit === next) return prev;
      const converted = textsFor(prev.sheet.cm, next);
      return { ...prev, sheet: { ...prev.sheet, unit: next }, texts: { ...prev.texts, ...converted } };
    });
  }, []);

  const setText = useCallback((key: string, raw: string) => {
    setState((prev) => {
      const parsed = parseEntry(raw);
      const cm = { ...prev.sheet.cm };
      if (parsed !== null && parsed > 0) cm[key] = toCm(parsed, prev.sheet.unit);
      else delete cm[key];
      return { ...prev, sheet: { ...prev.sheet, cm }, texts: { ...prev.texts, [key]: raw } };
    });
  }, []);

  /** On leaving a field: snap to the unit's step and show the rounded text. The stored value follows the snap, so round trips are exact. */
  const commit = useCallback((key: string) => {
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setState((prev) => {
      const parsed = parseEntry(prev.texts[key] ?? "");
      if (parsed === null || parsed <= 0) return prev;
      const snapped = roundMeasurement(parsed, prev.sheet.unit);
      if (snapped <= 0) return prev;
      const valueCm = toCm(snapped, prev.sheet.unit);
      return {
        ...prev,
        sheet: { ...prev.sheet, cm: { ...prev.sheet.cm, [key]: valueCm } },
        texts: { ...prev.texts, [key]: formatValue(valueCm, prev.sheet.unit) },
      };
    });
  }, []);

  const setUncertain = useCallback((key: string, on: boolean) => {
    setState((prev) => {
      const has = prev.sheet.uncertain.includes(key);
      if (has === on) return prev;
      const uncertain = on ? [...prev.sheet.uncertain, key] : prev.sheet.uncertain.filter((entry) => entry !== key);
      return { ...prev, sheet: { ...prev.sheet, uncertain } };
    });
  }, []);

  const patch = useCallback((changes: Partial<Omit<SheetValues, "cm" | "unit" | "uncertain">>) => {
    setState((prev) => ({ ...prev, sheet: { ...prev.sheet, ...changes } }));
  }, []);

  const toggleMovement = useCallback((movement: Movement, on: boolean) => {
    setState((prev) => {
      const has = prev.sheet.movement.includes(movement);
      if (has === on) return prev;
      const next = on ? [...prev.sheet.movement, movement] : prev.sheet.movement.filter((entry) => entry !== movement);
      return { ...prev, sheet: { ...prev.sheet, movement: next } };
    });
  }, []);

  const rawError = useCallback(
    (field: MeasurementField): string | null => {
      const text = texts[field.key] ?? "";
      const uncertain = sheet.uncertain.includes(field.key);
      if (text.trim()) {
        const parsed = parseEntry(text);
        if (parsed === null || parsed <= 0) return "Enter a number greater than zero.";
        return null;
      }
      if (field.required && !uncertain) return "Needed. Enter it, or tick “I'm not sure” so a fitter can help.";
      return null;
    },
    [texts, sheet.uncertain],
  );

  const fieldState = useCallback(
    (field: MeasurementField): MeasurementFieldState => {
      const text = texts[field.key] ?? "";
      const valueCm = sheet.cm[field.key] ?? null;
      const uncertain = sheet.uncertain.includes(field.key);
      const implausible = valueCm !== null && (valueCm < field.minCm || valueCm > field.maxCm);
      const hints: string[] = [];
      if (implausible) {
        hints.push(
          `Please check this one: most fall between ${formatValue(field.minCm, unit)} and ${formatValue(field.maxCm, unit)} ${unit}.`,
        );
      }
      if (uncertain) hints.push("A fitter will help with this one.");
      const error = rawError(field);
      return {
        text,
        valueCm,
        uncertain,
        error: error && (attempted || touched.has(field.key)) ? error : null,
        hint: hints.length ? hints.join(" ") : null,
        implausible,
      };
    },
    [texts, sheet.cm, sheet.uncertain, unit, rawError, attempted, touched],
  );

  const fieldProblems = useMemo(() => MEASUREMENT_FIELDS.filter((field) => rawError(field) !== null), [rawError]);
  const comfortMissing = sheet.jacket === null || sheet.trousers === null;
  const requiredTotal = useMemo(() => MEASUREMENT_FIELDS.filter((field) => field.required).length, []);
  const requiredEntered = useMemo(
    () =>
      MEASUREMENT_FIELDS.filter(
        (field) => field.required && (sheet.cm[field.key] !== undefined || sheet.uncertain.includes(field.key)),
      ).length,
    [sheet.cm, sheet.uncertain],
  );
  const canSubmit = fieldProblems.length === 0 && !comfortMissing;

  const submission = useCallback((): FitSubmission | null => {
    if (!canSubmit || sheet.jacket === null || sheet.trousers === null) return null;
    const measurements: Record<string, number> = {};
    for (const field of MEASUREMENT_FIELDS) {
      const value = sheet.cm[field.key];
      if (value !== undefined && Number.isFinite(value) && value > 0) measurements[field.key] = value;
    }
    const notes = sheet.notes.trim();
    return {
      units: unit,
      measurements,
      comfort: { jacket: sheet.jacket, trousers: sheet.trousers, movement: [...sheet.movement] },
      ...(sheet.posture ? { posture: sheet.posture } : {}),
      ...(notes ? { notes } : {}),
      uncertainFields: [...sheet.uncertain],
    };
  }, [canSubmit, sheet, unit]);

  const markAttempted = useCallback(() => setAttempted(true), []);

  const reset = useCallback(() => {
    setState(startState(initialSheet, false));
    setTouched(new Set());
    setAttempted(false);
    if (persistKey) clearPersistedKey(persistKey);
  }, [persistKey, initialSheet]);

  const clearPersisted = useCallback(() => {
    if (persistKey) clearPersistedKey(persistKey);
  }, [persistKey]);

  const dirty = useMemo(() => JSON.stringify(sheet) !== JSON.stringify(initialSheet), [sheet, initialSheet]);

  return {
    sheet,
    unit,
    setUnit,
    text: (key: string) => texts[key] ?? "",
    setText,
    commit,
    setUncertain,
    setJacket: (jacket: JacketComfort) => patch({ jacket }),
    setTrousers: (trousers: TrouserComfort) => patch({ trousers }),
    setPosture: (posture: Posture | null) => patch({ posture }),
    setNotes: (notes: string) => patch({ notes }),
    toggleMovement,
    fieldState,
    /** Fields with a blocking problem, whether or not it is shown yet. */
    fieldProblems,
    comfortMissing,
    comfortError: attempted && comfortMissing ? "Choose how you like the jacket and the trousers to sit." : null,
    requiredEntered,
    requiredTotal,
    canSubmit,
    attempted,
    markAttempted,
    submission,
    reset,
    clearPersisted,
    dirty,
    /** True when a sheet left in this browser was brought back after mount. */
    restored,
  };
}

export type MeasurementForm = ReturnType<typeof useMeasurementForm>;
