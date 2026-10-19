import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  cancel as cancelAppointment,
  complete as completeAppointment,
  confirm as confirmAppointment,
  findOwnedAppointment,
  listMine as listMineAppointments,
  listPending as listPendingAppointments,
  requestAppointment,
  requireOwnedAppointment,
  reschedule as rescheduleAppointment,
  staffGet as staffGetAppointment,
  toAppointmentView,
} from "../model/atelier/appointments";
import {
  vAppointmentHistoryEntry,
  vAppointmentPeriod,
  vAppointmentService,
  vAppointmentStatus,
  vCaseStatus,
  vContact,
  vPreferredWindow,
} from "../shared/atelier/validators";
import { requireActor, requireStaff, resolveActor } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier appointments: request-first fittings (contract §5.7; journey C18; screens S22, S23). A client
 * asks for a service, a place and preferred windows; the house confirms a real time and records the
 * calendar booking. The words follow the state: "Requested · awaiting confirmation" until a concierge
 * confirms with a `calendarRef`, then "Confirmed for {date}". Thin wrappers over
 * `convex/model/atelier/appointments.ts`.
 */

export const vAppointmentLocation = v.union(
  v.literal("charlotte"),
  v.literal("atlanta"),
  v.literal("houston"),
  v.literal("virtual"),
);
export type AppointmentLocation = Infer<typeof vAppointmentLocation>;

export const vShowroomView = v.object({
  id: v.union(v.literal("charlotte"), v.literal("atlanta"), v.literal("houston")),
  city: v.string(),
  address: v.string(),
  phone: v.string(),
});

export const vPreferredWindowView = v.object({
  date: v.number(),
  period: vAppointmentPeriod,
  periodLabel: v.string(),
});
export type PreferredWindowView = Infer<typeof vPreferredWindowView>;

export const vAppointmentView = v.object({
  _id: v.id("atelierAppointments"),
  status: vAppointmentStatus,
  statusLabel: v.string(),
  /** True only with a recorded calendar booking and start time; the client reads "Confirmed for …" from this alone. */
  confirmed: v.boolean(),
  service: vAppointmentService,
  serviceLabel: v.string(),
  showroomId: vAppointmentLocation,
  showroomLabel: v.string(),
  /** Null for a virtual appointment. */
  showroom: v.union(vShowroomView, v.null()),
  preferredWindows: v.array(vPreferredWindowView),
  notes: v.union(v.string(), v.null()),
  accessibility: v.union(v.string(), v.null()),
  timeZone: v.string(),
  confirmedStart: v.union(v.number(), v.null()),
  confirmedEnd: v.union(v.number(), v.null()),
  calendarRef: v.union(v.string(), v.null()),
  history: v.array(vAppointmentHistoryEntry),
  caseId: v.union(v.id("atelierCases"), v.null()),
  draftId: v.union(v.id("atelierDrafts"), v.null()),
  eventDate: v.union(v.number(), v.null()),
  canReschedule: v.boolean(),
  canCancel: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type AppointmentView = Infer<typeof vAppointmentView>;

export const vStaffAppointmentRow = vAppointmentView.extend({
  clientFirstName: v.string(),
  clientName: v.union(v.string(), v.null()),
  contact: v.union(vContact, v.null()),
  caseStatus: v.union(vCaseStatus, v.null()),
  ownerStaffId: v.union(v.id("users"), v.null()),
  recordedCalendarRef: v.union(v.string(), v.null()),
});
export type StaffAppointmentRow = Infer<typeof vStaffAppointmentRow>;

export const vRequestResult = v.object({
  appointmentId: v.id("atelierAppointments"),
  caseId: v.id("atelierCases"),
  /** True when the same request had already been received; the first one is returned. */
  duplicate: v.boolean(),
});
export type RequestResult = Infer<typeof vRequestResult>;

const appointmentArgs = { ...ownerArgs, appointmentId: v.id("atelierAppointments") };

/**
 * C18 step 2, S22. A durable pending request: one to three preferred windows on future days, the
 * client's zone and contact. A "fitting" case is created (or, with `caseId`, the request joins an open
 * one). Nothing is reserved until a concierge confirms.
 */
export const request = mutation({
  args: {
    ...ownerArgs,
    draftId: v.optional(v.id("atelierDrafts")),
    caseId: v.optional(v.id("atelierCases")),
    service: vAppointmentService,
    showroomId: vAppointmentLocation,
    preferredWindows: v.array(vPreferredWindow),
    notes: v.optional(v.string()),
    accessibility: v.optional(v.string()),
    timeZone: v.string(),
    eventDate: v.optional(v.number()),
    contact: vContact,
    submissionKey: v.string(),
  },
  returns: vRequestResult,
  handler: async (ctx, { guestKey, ...input }) => {
    const actor = await requireActor(ctx, guestKey);
    return requestAppointment(ctx, actor, input);
  },
});

/** S22/S23. The client's own appointment, or null when the id is malformed, unknown or someone else's. */
export const get = query({
  args: { ...ownerArgs, appointmentId: v.string() },
  returns: v.union(vAppointmentView, v.null()),
  handler: async (ctx, { guestKey, appointmentId }) => {
    const id = ctx.db.normalizeId("atelierAppointments", appointmentId);
    if (!id) return null;
    const actor = await resolveActor(ctx, guestKey);
    const appointment = await findOwnedAppointment(ctx, id, actor);
    return appointment ? toAppointmentView(appointment) : null;
  },
});

export const listMine = query({
  args: ownerArgs,
  returns: v.array(vAppointmentView),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    if (!actor.user && !actor.guestKey) return [];
    return listMineAppointments(ctx, actor);
  },
});

/** C18 step 3. New preferred windows; any confirmation is withdrawn and the house confirms again. */
export const reschedule = mutation({
  args: { ...appointmentArgs, preferredWindows: v.array(vPreferredWindow), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { guestKey, appointmentId, preferredWindows, note }) => {
    const actor = await resolveActor(ctx, guestKey);
    const appointment = requireOwnedAppointment(await ctx.db.get(appointmentId), actor);
    await rescheduleAppointment(ctx, actor, appointment, preferredWindows, note);
    return null;
  },
});

export const cancel = mutation({
  args: { ...appointmentArgs, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { guestKey, appointmentId, note }) => {
    const actor = await resolveActor(ctx, guestKey);
    const appointment = requireOwnedAppointment(await ctx.db.get(appointmentId), actor);
    await cancelAppointment(ctx, actor, appointment, note);
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (A01 case detail; concierge)
// ------------------------------------------------------------------------------------------------

/** Confirmed means a real booking: start, end and the calendar reference are all required. */
export const confirm = mutation({
  args: {
    appointmentId: v.id("atelierAppointments"),
    confirmedStart: v.number(),
    confirmedEnd: v.number(),
    calendarRef: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { appointmentId, ...input }) => {
    const staff = await requireStaff(ctx, "concierge");
    await confirmAppointment(ctx, staff, appointmentId, input);
    return null;
  },
});

export const complete = mutation({
  args: { appointmentId: v.id("atelierAppointments"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { appointmentId, note }) => {
    const staff = await requireStaff(ctx, "concierge");
    await completeAppointment(ctx, staff, appointmentId, note);
    return null;
  },
});

/** Requests the house has yet to confirm, longest waiting first. */
export const listPending = query({
  args: {},
  returns: v.array(vStaffAppointmentRow),
  handler: async (ctx) => {
    await requireStaff(ctx, "concierge");
    return listPendingAppointments(ctx);
  },
});

export const staffGet = query({
  args: { appointmentId: v.id("atelierAppointments") },
  returns: vStaffAppointmentRow,
  handler: async (ctx, { appointmentId }) => {
    await requireStaff(ctx, "concierge");
    return staffGetAppointment(ctx, appointmentId);
  },
});
