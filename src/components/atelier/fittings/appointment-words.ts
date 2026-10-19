import type { StatusTone } from "@/components/atelier/common/status-line";
import type { AppointmentView } from "@convex/atelier/appointments";
import {
  ATELIER_LIMITS,
  VIRTUAL_SERVICES,
  type AppointmentActor,
  type AppointmentService,
  type AppointmentStatus,
} from "@convex/shared/atelier/enums";

/** Colour never carries the meaning alone: "Confirmed" is gold only because the words say so. */
export const APPOINTMENT_TONES: Record<AppointmentStatus, StatusTone> = {
  requested: "neutral",
  awaiting_confirmation: "neutral",
  confirmed: "gold",
  rescheduled: "neutral",
  cancelled: "neutral",
  completed: "success",
};

export const ACTOR_WORDS: Record<AppointmentActor, string> = {
  client: "You",
  staff: "The house",
  system: "Automatically",
};

/** What each service is, in plain words; the house's own process copy is in `HOUSE_POLICY.verified.fittings`. */
export const SERVICE_NOTES: Record<AppointmentService, string> = {
  consultation: "A private consultation with full measurements, where the process begins.",
  first_fitting: "Try the suit while it is being made, so the cut is adjusted before it is finished.",
  final_fitting: "The finished suit, checked and refined before it is yours.",
  measurement: "Full measurements taken by a fitter at a showroom.",
  virtual: "A video call with a clothier for questions and guidance. Measurements are not taken over video.",
};

export { VIRTUAL_SERVICES };

/** The client may name one to three preferred windows (contract §5.7). */
export const PREFERRED_WINDOWS_MAX: number = ATELIER_LIMITS.preferredWindowsMax;

export const PENDING_SENTENCE = "A concierge will confirm a time with you. A preferred date is not a reserved slot.";

const UTC_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** A preferred window's day. Windows are stored as UTC midnight, so they are read in UTC and never shift a day. */
export function formatWindowDay(date: number): string {
  return UTC_DAY.format(new Date(date));
}

export function formatWindow(window: { date: number; periodLabel: string }): string {
  return `${formatWindowDay(window.date)}, ${window.periodLabel.toLowerCase()}`;
}

function zoned(options: Intl.DateTimeFormatOptions, timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
}

/** "Tuesday, October 27, 2026" · "2:00 PM – 3:00 PM" · "EDT", all in the appointment's own zone. */
export function formatConfirmed(
  start: number,
  end: number | null,
  timeZone: string,
): { day: string; time: string; zone: string } {
  const day = zoned({ weekday: "long", month: "long", day: "numeric", year: "numeric" }, timeZone).format(
    new Date(start),
  );
  const clock = zoned({ hour: "numeric", minute: "2-digit" }, timeZone);
  const time = end
    ? `${clock.format(new Date(start))} – ${clock.format(new Date(end))}`
    : clock.format(new Date(start));
  const zone =
    zoned({ timeZoneName: "short" }, timeZone)
      .formatToParts(new Date(start))
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return { day, time, zone };
}

/** The one status sentence for an appointment: "Confirmed for …" only with a recorded booking, else the label. */
export function statusWords(
  appointment: Pick<AppointmentView, "confirmed" | "confirmedStart" | "confirmedEnd" | "timeZone" | "statusLabel">,
): string {
  if (appointment.confirmed && appointment.confirmedStart !== null) {
    const { day, time } = formatConfirmed(appointment.confirmedStart, appointment.confirmedEnd, appointment.timeZone);
    return `Confirmed for ${day}, ${time}`;
  }
  return appointment.statusLabel;
}

export function whereWords(appointment: Pick<AppointmentView, "showroomId" | "showroomLabel">): string {
  return appointment.showroomId === "virtual" ? "By video" : `${appointment.showroomLabel} showroom`;
}
