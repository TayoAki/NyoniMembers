"use client";

import { X } from "lucide-react";
import { useId } from "react";
import { PREFERRED_WINDOWS_MAX } from "@/components/atelier/fittings/appointment-words";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { APPOINTMENT_PERIOD_LABELS, APPOINTMENT_PERIODS, type AppointmentPeriod } from "@convex/shared/atelier/enums";

export type WindowDraft = { id: string; date: string; period: AppointmentPeriod | "" };

export function emptyWindow(): WindowDraft {
  return { id: crypto.randomUUID(), date: "", period: "" };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const DAY_MS = 86_400_000;

/**
 * Today's calendar day where the client is, as yyyy-mm-dd; a preferred day must come after it. Read in the
 * request's time zone when one is given (the house judges the windows in that zone), else the device's.
 */
export function localToday(now: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const read = (type: string) => parts.find((part) => part.type === type)?.value;
      const [year, month, day] = [read("year"), read("month"), read("day")];
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // An unrecognised zone: the device's day stands in until the server says otherwise.
    }
  }
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function localTomorrow(now: Date = new Date(), timeZone?: string): string {
  const today = dayToUtc(localToday(now, timeZone)) ?? now.getTime();
  return utcToDay(today + DAY_MS);
}

/** The chosen calendar day as UTC midnight, which is how the house stores and reads a preferred window. */
export function dayToUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** A stored window back into the input's yyyy-mm-dd, read in UTC so the day does not shift. */
export function utcToDay(date: number): string {
  const day = new Date(date);
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
}

export function windowProblem(entry: WindowDraft, today: string = localToday()): string | null {
  if (!entry.date) return "Choose a day.";
  if (dayToUtc(entry.date) === null) return "Choose a day.";
  if (entry.date <= today) return "Choose a day from tomorrow onward so the house can confirm a time.";
  if (!entry.period) return "Choose a time of day.";
  return null;
}

export function toPreferredWindows(windows: readonly WindowDraft[]): { date: number; period: AppointmentPeriod }[] {
  return windows.flatMap((entry) => {
    const date = dayToUtc(entry.date);
    return date === null || !entry.period ? [] : [{ date, period: entry.period }];
  });
}

/**
 * One to three preferred windows: a day and a time of day each. A window is a preference the house
 * confirms against its calendar; it is never shown or stored as a reserved slot.
 */
export function PreferredWindowsField({
  windows,
  onChange,
  disabled = false,
  showErrors = false,
  legend = "Preferred windows",
  timeZone,
  serverError = null,
}: {
  windows: WindowDraft[];
  onChange: (windows: WindowDraft[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
  legend?: string;
  /** The zone the request is made in; "tomorrow" is read in it, as the house reads it. */
  timeZone?: string;
  /** The house's own answer about the windows, shown on the field until they change. */
  serverError?: string | null;
}) {
  const ids = useId();
  const today = localToday(new Date(), timeZone);
  const tomorrow = localTomorrow(new Date(), timeZone);

  function update(id: string, changes: Partial<WindowDraft>) {
    onChange(windows.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">
        {legend}{" "}
        <span className="text-primary" aria-hidden>
          *
        </span>
      </FieldLegend>
      <FieldDescription>
        One to {PREFERRED_WINDOWS_MAX} days and times that suit you. The house confirms one real time against its
        calendar; a preferred day is not a reserved slot.
      </FieldDescription>
      <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
        {windows.map((entry, index) => {
          const problem = showErrors ? windowProblem(entry, today) : null;
          const dateId = `${ids}-${entry.id}-date`;
          return (
            <li
              key={entry.id}
              className="grid gap-3 py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-start"
            >
              <div className="space-y-1.5">
                <Label htmlFor={dateId} className="text-xs text-muted-foreground">
                  Window {index + 1}
                </Label>
                <Input
                  id={dateId}
                  type="date"
                  min={tomorrow}
                  value={entry.date}
                  onChange={(event) => update(entry.id, { date: event.target.value })}
                  aria-invalid={problem && !entry.date ? true : undefined}
                  disabled={disabled}
                  className="h-11 rounded-none"
                />
              </div>
              <RadioGroup
                value={entry.period}
                onValueChange={(value) => update(entry.id, { period: value as AppointmentPeriod })}
                aria-label={`Time of day for window ${index + 1}`}
                className="flex flex-wrap gap-x-5 gap-y-1 sm:pt-6"
                disabled={disabled}
              >
                {APPOINTMENT_PERIODS.map((period) => (
                  <Label key={period} className="min-h-11 items-center gap-2 text-sm font-normal">
                    <RadioGroupItem value={period} disabled={disabled} />
                    {APPOINTMENT_PERIOD_LABELS[period]}
                  </Label>
                ))}
              </RadioGroup>
              <div className="sm:pt-5">
                {windows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-none text-muted-foreground hover:text-foreground"
                    onClick={() => onChange(windows.filter((other) => other.id !== entry.id))}
                    disabled={disabled}
                    aria-label={`Remove window ${index + 1}`}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              {problem ? <FieldError className="sm:col-span-3">{problem}</FieldError> : null}
            </li>
          );
        })}
      </ol>
      {serverError ? <FieldError aria-live="polite">{serverError}</FieldError> : null}
      {windows.length < PREFERRED_WINDOWS_MAX ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none px-3"
            onClick={() => onChange([...windows, emptyWindow()])}
            disabled={disabled}
          >
            Add another window
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Up to {PREFERRED_WINDOWS_MAX} windows.</p>
      )}
    </FieldSet>
  );
}
