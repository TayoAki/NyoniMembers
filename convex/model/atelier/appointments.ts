import type { Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  audit,
  clientDisplayName,
  isOwner,
  ownerFieldsFor,
  requireOwned,
  staffDisplayName,
  type Actor,
} from "../../atelier/access";
import type { AppointmentView, PreferredWindowView, StaffAppointmentRow } from "../../atelier/appointments";
import { appError } from "../../lib/errors";
import {
  APPOINTMENT_PERIOD_LABELS,
  APPOINTMENT_SERVICE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  ATELIER_LIMITS,
  CASE_KIND_LABELS,
  VIRTUAL_SERVICES,
  type AppointmentService,
  type AppointmentStatus,
} from "../../shared/atelier/enums";
import { APPOINTMENT_TRANSITIONS } from "../../shared/atelier/transitions";
import type { vContact, vPreferredWindow } from "../../shared/atelier/validators";
import { SHOWROOMS, type ShowroomId } from "../../shared/house";
import {
  assertDailyCaseBudget,
  caseOwner,
  firstNameOf,
  isOpen,
  normalizeContact,
  notificationTarget,
  startOfUtcDay,
} from "./cases";
import { appendMessage, createCase, touchCase } from "./case_core";
import { queueNotification } from "./notifications";

type Ctx = QueryCtx | MutationCtx;
type Appointment = Doc<"atelierAppointments">;
type Case = Doc<"atelierCases">;
type User = Doc<"users">;
type PreferredWindow = Infer<typeof vPreferredWindow>;
type ContactInput = Infer<typeof vContact>;
export type AppointmentLocation = Appointment["showroomId"];

/**
 * Fittings are request-first (contract §0, journey C18): a client names a service, a showroom and up to
 * three preferred windows; the house confirms a real time and records the calendar booking. "Confirmed"
 * exists only with a `calendarRef` and a start time. A preferred date is never a reserved slot.
 */

export const WINDOWS_MIN = 1;
export const WINDOWS_MAX: number = ATELIER_LIMITS.preferredWindowsMax;
export const APPOINTMENT_TEXT_MAX = 1000;
export const APPOINTMENT_LIST_MAX = 50;
export const PENDING_MAX = 100;
const DAY_MS = 86_400_000;

export const TERMINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["cancelled", "completed"];
export const PENDING_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "requested",
  "awaiting_confirmation",
  "rescheduled",
];

/** Booking state machine: requested → awaiting confirmation → confirmed → rescheduled / cancelled / completed. */
export { APPOINTMENT_TRANSITIONS };

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

export function isTerminal(appointment: Pick<Appointment, "status">): boolean {
  return TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status);
}

/** Services that can happen over a call; a fitting or measurements need the client in a showroom. */
export { VIRTUAL_SERVICES };

export function showroomLabel(location: AppointmentLocation): string {
  if (location === "virtual") return "Virtual";
  return SHOWROOMS.find((showroom) => showroom.id === location)?.city ?? location;
}

function showroomOf(location: AppointmentLocation): AppointmentView["showroom"] {
  if (location === "virtual") return null;
  const showroom = SHOWROOMS.find((entry) => entry.id === location);
  return showroom
    ? { id: showroom.id as ShowroomId, city: showroom.city, address: showroom.address, phone: showroom.phone }
    : null;
}

function cleanText(
  value: string | null | undefined,
  what: string,
  max: number = APPOINTMENT_TEXT_MAX,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw appError("INVALID_INPUT", `Keep ${what} under ${max} characters.`, { max });
  return trimmed;
}

function assertTransition(appointment: Appointment, to: AppointmentStatus): void {
  if (!canTransition(appointment.status, to)) {
    throw appError(
      "INVALID_STATE",
      `An appointment that is ${APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()} cannot become ${APPOINTMENT_STATUS_LABELS[to].toLowerCase()}.`,
      { from: appointment.status, to },
    );
  }
}

/** Named in a window error's `details.field` so the request form can attach it to that field: the argument's own name. */
export const WINDOWS_FIELD = "preferredWindows" satisfies keyof RequestInput;

function windowError(message: string, details: Record<string, string | number> = {}): ReturnType<typeof appError> {
  return appError("INVALID_INPUT", message, { field: WINDOWS_FIELD, ...details });
}

/**
 * The calendar day it is in `timeZone` at `at`, encoded the way a preferred window is stored: UTC midnight of
 * that day. UTC when the zone cannot be read, so a window can never be judged against the server's clock.
 */
export function localDayAsUtc(at: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(at));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const [year, month, day] = [read("year"), read("month"), read("day")];
    if ([year, month, day].every(Number.isFinite)) return Date.UTC(year, month - 1, day);
  } catch {
    // Fall through to UTC.
  }
  return startOfUtcDay(at);
}

/**
 * One to three distinct windows, each on a day after today where the client is: a window names a calendar
 * day (stored at UTC midnight), so "today" is read in the request's own time zone, not the server's. A window
 * is a preference, not a slot.
 */
export function normalizeWindows(
  windows: readonly PreferredWindow[],
  now: number,
  timeZone: string = "UTC",
): PreferredWindow[] {
  if (windows.length < WINDOWS_MIN) throw windowError("Give the house at least one preferred window.");
  if (windows.length > WINDOWS_MAX)
    throw windowError(`Choose up to ${WINDOWS_MAX} preferred windows.`, { max: WINDOWS_MAX });
  const today = localDayAsUtc(now, timeZone);
  const seen = new Set<string>();
  const cleaned: PreferredWindow[] = [];
  for (const window of windows) {
    if (!Number.isFinite(window.date)) throw windowError("A preferred window needs a date.");
    const day = startOfUtcDay(window.date);
    if (day <= today)
      throw windowError("Preferred windows need to be from tomorrow onward so the house can confirm a time.");
    const key = `${day}:${window.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ date: day, period: window.period });
  }
  cleaned.sort((a, b) => a.date - b.date || a.period.localeCompare(b.period));
  return cleaned;
}

export function normalizeTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!trimmed) throw appError("INVALID_INPUT", "Tell us your time zone so times are shown correctly.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
  } catch {
    throw appError("INVALID_INPUT", `"${trimmed}" is not a time zone we recognise.`);
  }
  return trimmed;
}

export function assertLocationFits(service: AppointmentService, location: AppointmentLocation): void {
  if (location === "virtual" && !VIRTUAL_SERVICES.includes(service)) {
    throw appError(
      "INVALID_INPUT",
      `${APPOINTMENT_SERVICE_LABELS[service]} happens at a showroom; choose Charlotte, Atlanta or Houston.`,
      {
        service,
      },
    );
  }
}

/** "Saturday, November 14, 2026 at 11:00 AM" in the client's zone; UTC when the zone cannot be formatted. */
export function formatWhen(at: number, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(at));
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(at));
  }
}

function formatWindow(window: PreferredWindow): string {
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(window.date));
  return `${day}, ${APPOINTMENT_PERIOD_LABELS[window.period].toLowerCase()}`;
}

function windowFingerprint(windows: readonly PreferredWindow[]): string {
  return windows.map((window) => `${window.date}:${window.period}`).join("|");
}

// ------------------------------------------------------------------------------------------------
// Request (C18, S22)
// ------------------------------------------------------------------------------------------------

export type RequestInput = {
  draftId?: Id<"atelierDrafts">;
  caseId?: Id<"atelierCases">;
  service: AppointmentService;
  showroomId: AppointmentLocation;
  preferredWindows: PreferredWindow[];
  notes?: string;
  accessibility?: string;
  timeZone: string;
  eventDate?: number;
  contact: ContactInput;
  submissionKey: string;
};

export type RequestResult = {
  appointmentId: Id<"atelierAppointments">;
  caseId: Id<"atelierCases">;
  duplicate: boolean;
};

async function appointmentsForCase(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Appointment[]> {
  return ctx.db
    .query("atelierAppointments")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .order("desc")
    .take(APPOINTMENT_LIST_MAX);
}

/**
 * A durable, pending request. Without a `caseId` a "fitting" case is created through the case core, so a
 * retry with the same `submissionKey` returns the first request (scenario 8); with one, the appointment
 * joins that case and an identical open request on it is the duplicate.
 */
export async function requestAppointment(
  ctx: MutationCtx,
  actor: Actor,
  input: RequestInput,
  now: number = Date.now(),
): Promise<RequestResult> {
  const owner = ownerFieldsFor(actor);
  const submissionKey = cleanText(input.submissionKey, "a submission key", 128);
  if (!submissionKey) throw appError("INVALID_INPUT", "Add a submission key.");
  assertLocationFits(input.service, input.showroomId);
  const timeZone = normalizeTimeZone(input.timeZone);
  const preferredWindows = normalizeWindows(input.preferredWindows, now, timeZone);
  const notes = cleanText(input.notes, "your notes");
  const accessibility = cleanText(input.accessibility, "your access needs");
  const contact = normalizeContact(input.contact);
  const draft = input.draftId !== undefined ? requireOwned(await ctx.db.get(input.draftId), actor, "design") : null;
  const eventDate = input.eventDate ?? draft?.eventDate;
  const serviceLabel = APPOINTMENT_SERVICE_LABELS[input.service];
  const where = input.showroomId === "virtual" ? "by video" : `at the ${showroomLabel(input.showroomId)} showroom`;
  const summary = `${serviceLabel} ${where}. Preferred: ${preferredWindows.map(formatWindow).join("; ")} (${timeZone}).`;

  let linked: Case | null = null;
  if (input.caseId !== undefined) {
    linked = requireOwned(await ctx.db.get(input.caseId), actor, "request");
    if (!isOpen(linked))
      throw appError("INVALID_STATE", "That request is closed. Ask for the fitting as a new request.", {
        status: linked.status,
      });
    const fingerprint = windowFingerprint(preferredWindows);
    const same = (await appointmentsForCase(ctx, linked._id)).find(
      (existing) =>
        !isTerminal(existing) &&
        existing.service === input.service &&
        existing.showroomId === input.showroomId &&
        windowFingerprint(existing.preferredWindows) === fingerprint,
    );
    if (same) return { appointmentId: same._id, caseId: linked._id, duplicate: true };
  }

  let caseId: Id<"atelierCases">;
  if (linked) {
    caseId = linked._id;
  } else {
    await assertDailyCaseBudget(ctx, owner, now);
    const created = await createCase(
      ctx,
      {
        kind: "fitting",
        owner,
        actor,
        contact,
        submissionKey,
        message: notes,
        draftId: draft?._id,
        receipt: `${CASE_KIND_LABELS.fitting} request received: ${summary} Requested · awaiting confirmation. A concierge will confirm a time with you; a preferred date is not a reserved slot.`,
      },
      now,
    );
    caseId = created.caseId;
    if (created.duplicate) {
      const existing =
        (await appointmentsForCase(ctx, caseId)).find((appointment) => !isTerminal(appointment)) ??
        (await appointmentsForCase(ctx, caseId))[0];
      if (existing) return { appointmentId: existing._id, caseId, duplicate: true };
    }
  }

  const appointmentId = await ctx.db.insert("atelierAppointments", {
    ...owner,
    caseId,
    draftId: draft?._id,
    service: input.service,
    showroomId: input.showroomId,
    preferredWindows,
    notes,
    accessibility,
    timeZone,
    status: "requested",
    history: [{ at: now, from: "requested", to: "requested", by: "client" }],
    eventDate,
    createdAt: now,
    updatedAt: now,
  });
  const theCase = linked ?? (await ctx.db.get(caseId));
  if (theCase && theCase.appointmentId === undefined) await ctx.db.patch(caseId, { appointmentId });
  if (linked) {
    await appendMessage(
      ctx,
      caseId,
      {
        author: "system",
        body: `${summary} Requested · awaiting confirmation; a preferred date is not a reserved slot.`,
      },
      now,
    );
    if (linked.status === "assigned" || linked.status === "awaiting_client")
      await touchCase(ctx, caseId, { status: "awaiting_staff" }, now);
    await queueNotification(
      ctx,
      {
        owner,
        caseId,
        ...notificationTarget(contact),
        subject: `Nyoni Couture · ${serviceLabel} requested`,
        body: `We have your request for a ${serviceLabel.toLowerCase()} ${where}. A concierge will confirm a time with you.`,
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "appointment.request",
      targetTable: "atelierAppointments",
      targetId: appointmentId,
      meta: { caseId, service: input.service, showroomId: input.showroomId, windows: preferredWindows.length },
    },
    now,
  );
  return { appointmentId, caseId, duplicate: false };
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function findOwnedAppointment(
  ctx: Ctx,
  appointmentId: Id<"atelierAppointments">,
  actor: Actor,
): Promise<Appointment | null> {
  const appointment = await ctx.db.get(appointmentId);
  return appointment && isOwner(appointment, actor) ? appointment : null;
}

export function requireOwnedAppointment(appointment: Appointment | null, actor: Actor): Appointment {
  return requireOwned(appointment, actor, "appointment");
}

async function staffAppointment(ctx: Ctx, appointmentId: Id<"atelierAppointments">): Promise<Appointment> {
  const appointment = await ctx.db.get(appointmentId);
  if (!appointment) throw appError("NOT_FOUND", "That appointment doesn't exist.");
  return appointment;
}

function toWindowView(window: PreferredWindow): PreferredWindowView {
  return { date: window.date, period: window.period, periodLabel: APPOINTMENT_PERIOD_LABELS[window.period] };
}

/** "Confirmed" is shown only with a calendar booking and a start time; anything else is a request. */
export function isConfirmed(appointment: Appointment): boolean {
  return (
    appointment.status === "confirmed" &&
    appointment.calendarRef !== undefined &&
    appointment.confirmedStart !== undefined
  );
}

export function toAppointmentView(appointment: Appointment): AppointmentView {
  const confirmed = isConfirmed(appointment);
  return {
    _id: appointment._id,
    status: appointment.status,
    statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status],
    confirmed,
    service: appointment.service,
    serviceLabel: APPOINTMENT_SERVICE_LABELS[appointment.service],
    showroomId: appointment.showroomId,
    showroomLabel: showroomLabel(appointment.showroomId),
    showroom: showroomOf(appointment.showroomId),
    preferredWindows: appointment.preferredWindows.map(toWindowView),
    notes: appointment.notes ?? null,
    accessibility: appointment.accessibility ?? null,
    timeZone: appointment.timeZone,
    confirmedStart: confirmed ? (appointment.confirmedStart ?? null) : null,
    confirmedEnd: confirmed ? (appointment.confirmedEnd ?? null) : null,
    calendarRef: confirmed ? (appointment.calendarRef ?? null) : null,
    history: appointment.history,
    caseId: appointment.caseId ?? null,
    draftId: appointment.draftId ?? null,
    eventDate: appointment.eventDate ?? null,
    canReschedule: !isTerminal(appointment),
    canCancel: !isTerminal(appointment),
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

export async function listMine(ctx: Ctx, actor: Actor): Promise<AppointmentView[]> {
  const rows: Appointment[] = [];
  if (actor.user) {
    const userId = actor.user._id;
    rows.push(
      ...(await ctx.db
        .query("atelierAppointments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(APPOINTMENT_LIST_MAX)),
    );
  }
  if (actor.guestKey) {
    const guestKey = actor.guestKey;
    rows.push(
      ...(await ctx.db
        .query("atelierAppointments")
        .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
        .order("desc")
        .take(APPOINTMENT_LIST_MAX)),
    );
  }
  const seen = new Set<string>();
  const unique = rows.filter((row) => (seen.has(row._id) ? false : (seen.add(row._id), true)));
  unique.sort((a, b) => b.updatedAt - a.updatedAt);
  return unique.slice(0, APPOINTMENT_LIST_MAX).map(toAppointmentView);
}

export async function toStaffRow(ctx: Ctx, appointment: Appointment): Promise<StaffAppointmentRow> {
  const [theCase, user] = await Promise.all([
    appointment.caseId !== undefined ? ctx.db.get(appointment.caseId) : null,
    appointment.userId !== undefined ? ctx.db.get(appointment.userId) : null,
  ]);
  return {
    ...toAppointmentView(appointment),
    clientFirstName: firstNameOf(theCase?.contact.name) ?? clientDisplayName(user),
    clientName: theCase?.contact.name ?? user?.name ?? null,
    contact: theCase?.contact ?? null,
    caseStatus: theCase?.status ?? null,
    ownerStaffId: theCase?.ownerStaffId ?? null,
    /** Staff see the booking reference whatever the status, so a cancelled booking can be cleared in the calendar. */
    recordedCalendarRef: appointment.calendarRef ?? null,
  };
}

/** Every request the house has yet to confirm, longest waiting first. */
export async function listPending(ctx: Ctx): Promise<StaffAppointmentRow[]> {
  const pages = await Promise.all(
    PENDING_APPOINTMENT_STATUSES.map((status) =>
      ctx.db
        .query("atelierAppointments")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("asc")
        .take(PENDING_MAX),
    ),
  );
  const rows = pages
    .flat()
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, PENDING_MAX);
  return Promise.all(rows.map((appointment) => toStaffRow(ctx, appointment)));
}

export async function staffGet(ctx: Ctx, appointmentId: Id<"atelierAppointments">): Promise<StaffAppointmentRow> {
  return toStaffRow(ctx, await staffAppointment(ctx, appointmentId));
}

// ------------------------------------------------------------------------------------------------
// Client changes (C18 step 3)
// ------------------------------------------------------------------------------------------------

async function noteOnCase(
  ctx: MutationCtx,
  appointment: Appointment,
  body: string,
  now: number,
  wakeStaff: boolean,
): Promise<void> {
  if (appointment.caseId === undefined) return;
  const theCase = await ctx.db.get(appointment.caseId);
  if (!theCase) return;
  await appendMessage(ctx, theCase._id, { author: "system", body }, now);
  if (wakeStaff && isOpen(theCase) && theCase.status !== "received" && theCase.status !== "awaiting_staff") {
    await touchCase(ctx, theCase._id, { status: "awaiting_staff" }, now);
  }
}

/**
 * New preferred windows. Any confirmation is withdrawn: the house must confirm again, and says so. The
 * booking reference stays on the row (the client's view hides it once the status is no longer confirmed) so
 * the house can clear the old booking, as it does after a cancellation.
 */
export async function reschedule(
  ctx: MutationCtx,
  actor: Actor,
  appointment: Appointment,
  windows: readonly PreferredWindow[],
  note: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  requireOwnedAppointment(appointment, actor);
  if (isTerminal(appointment)) {
    throw appError(
      "INVALID_STATE",
      `This appointment is ${APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()}; request a new one instead.`,
      {
        status: appointment.status,
      },
    );
  }
  assertTransition(appointment, "rescheduled");
  const preferredWindows = normalizeWindows(windows, now, appointment.timeZone);
  const cleanNote = cleanText(note, "your note", 500);
  const wasConfirmed = isConfirmed(appointment);
  await ctx.db.patch(appointment._id, {
    preferredWindows,
    status: "rescheduled",
    confirmedStart: undefined,
    confirmedEnd: undefined,
    history: [
      ...appointment.history,
      { at: now, from: appointment.status, to: "rescheduled", by: "client", note: cleanNote },
    ],
    updatedAt: now,
  });
  const previously =
    wasConfirmed && appointment.confirmedStart !== undefined
      ? ` confirmed for ${formatWhen(appointment.confirmedStart, appointment.timeZone)}`
      : "";
  const clearing =
    wasConfirmed && appointment.calendarRef !== undefined
      ? ` The house will clear booking reference ${appointment.calendarRef} and confirm a new time with you.`
      : "";
  await noteOnCase(
    ctx,
    appointment,
    `You asked to reschedule your ${APPOINTMENT_SERVICE_LABELS[appointment.service].toLowerCase()}${previously}. New preferred windows: ${preferredWindows.map(formatWindow).join("; ")}.${cleanNote ? ` ${cleanNote}` : ""}${clearing} Rescheduled · awaiting confirmation.`,
    now,
    true,
  );
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "appointment.reschedule",
      targetTable: "atelierAppointments",
      targetId: appointment._id,
      meta: { from: appointment.status, hadCalendarRef: appointment.calendarRef !== undefined },
    },
    now,
  );
}

/** Cancelling is final for this request; a cancelled one is left alone, a completed one cannot be undone. */
export async function cancel(
  ctx: MutationCtx,
  actor: Actor,
  appointment: Appointment,
  note: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  requireOwnedAppointment(appointment, actor);
  if (appointment.status === "cancelled") return;
  assertTransition(appointment, "cancelled");
  const cleanNote = cleanText(note, "your note", 500);
  await ctx.db.patch(appointment._id, {
    status: "cancelled",
    history: [
      ...appointment.history,
      { at: now, from: appointment.status, to: "cancelled", by: "client", note: cleanNote },
    ],
    updatedAt: now,
  });
  const wasConfirmed = isConfirmed(appointment);
  await noteOnCase(
    ctx,
    appointment,
    `You cancelled your ${APPOINTMENT_SERVICE_LABELS[appointment.service].toLowerCase()}${
      wasConfirmed && appointment.confirmedStart !== undefined
        ? ` confirmed for ${formatWhen(appointment.confirmedStart, appointment.timeZone)}`
        : ""
    }.${cleanNote ? ` ${cleanNote}` : ""}${wasConfirmed ? " The house will clear the booking." : ""}`,
    now,
    true,
  );
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "appointment.cancel",
      targetTable: "atelierAppointments",
      targetId: appointment._id,
      meta: { from: appointment.status, hadCalendarRef: appointment.calendarRef !== undefined },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Staff (C18 acceptance: a real calendar receipt is required for Confirmed)
// ------------------------------------------------------------------------------------------------

export type ConfirmInput = { confirmedStart: number; confirmedEnd: number; calendarRef: string; note?: string };

/** A booking made a few minutes after it began is still a real one; anything older is a time that has passed. */
export const CONFIRM_GRACE_MS = 15 * 60_000;

/** All three facts or nothing: the start, the end and the Square booking reference, for a time still to come. */
export async function confirm(
  ctx: MutationCtx,
  staff: User,
  appointmentId: Id<"atelierAppointments">,
  input: ConfirmInput,
  now: number = Date.now(),
): Promise<void> {
  const appointment = await staffAppointment(ctx, appointmentId);
  assertTransition(appointment, "confirmed");
  const calendarRef = cleanText(input.calendarRef, "the booking reference", 120);
  if (!calendarRef) throw appError("INVALID_INPUT", "A confirmation needs the calendar booking reference.");
  if (!Number.isFinite(input.confirmedStart) || !Number.isFinite(input.confirmedEnd)) {
    throw appError("INVALID_INPUT", "A confirmation needs a start and an end time.");
  }
  if (input.confirmedEnd <= input.confirmedStart)
    throw appError("INVALID_INPUT", "The appointment must end after it starts.");
  if (input.confirmedEnd - input.confirmedStart > DAY_MS)
    throw appError("INVALID_INPUT", "An appointment is shorter than a day.");
  if (input.confirmedStart < now - CONFIRM_GRACE_MS)
    throw appError("INVALID_INPUT", "That start time has already passed; confirm a time still to come.", {
      confirmedStart: input.confirmedStart,
    });
  const note = cleanText(input.note, "the note", 500);
  await ctx.db.patch(appointment._id, {
    status: "confirmed",
    confirmedStart: input.confirmedStart,
    confirmedEnd: input.confirmedEnd,
    calendarRef,
    history: [...appointment.history, { at: now, from: appointment.status, to: "confirmed", by: "staff", note }],
    updatedAt: now,
  });
  const when = formatWhen(input.confirmedStart, appointment.timeZone);
  const where =
    appointment.showroomId === "virtual" ? "by video" : `at the ${showroomLabel(appointment.showroomId)} showroom`;
  const serviceLabel = APPOINTMENT_SERVICE_LABELS[appointment.service];
  await noteOnCase(
    ctx,
    appointment,
    `Confirmed for ${when} (${appointment.timeZone}): ${serviceLabel.toLowerCase()} ${where}. Booking reference ${calendarRef}.${note ? ` ${note}` : ""}`,
    now,
    false,
  );
  const theCase = appointment.caseId !== undefined ? await ctx.db.get(appointment.caseId) : null;
  if (theCase) {
    await queueNotification(
      ctx,
      {
        owner: caseOwner(theCase),
        caseId: theCase._id,
        ...notificationTarget(theCase.contact),
        subject: `Nyoni Couture · Your ${serviceLabel.toLowerCase()} is confirmed`,
        body: `Confirmed for ${when} (${appointment.timeZone}), ${where}. Booking reference ${calendarRef}.`,
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "appointment.confirm",
      targetTable: "atelierAppointments",
      targetId: appointment._id,
      meta: {
        from: appointment.status,
        confirmedStart: input.confirmedStart,
        confirmedEnd: input.confirmedEnd,
        calendarRef,
      },
    },
    now,
  );
}

/** Only a confirmed appointment can have taken place. */
export async function complete(
  ctx: MutationCtx,
  staff: User,
  appointmentId: Id<"atelierAppointments">,
  note: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  const appointment = await staffAppointment(ctx, appointmentId);
  if (appointment.status !== "confirmed") {
    throw appError("INVALID_STATE", "Only a confirmed appointment can be marked as completed.", {
      status: appointment.status,
    });
  }
  const cleanNote = cleanText(note, "the note", 500);
  await ctx.db.patch(appointment._id, {
    status: "completed",
    history: [
      ...appointment.history,
      { at: now, from: appointment.status, to: "completed", by: "staff", note: cleanNote },
    ],
    updatedAt: now,
  });
  await noteOnCase(
    ctx,
    appointment,
    `Your ${APPOINTMENT_SERVICE_LABELS[appointment.service].toLowerCase()} with ${staffDisplayName(staff) ?? "the house"} is complete.${cleanNote ? ` ${cleanNote}` : ""}`,
    now,
    false,
  );
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "appointment.complete",
      targetTable: "atelierAppointments",
      targetId: appointment._id,
    },
    now,
  );
}
