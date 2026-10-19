import assert from "node:assert/strict";
import test from "node:test";
import {
  accountActor,
  fakeCtx,
  GUEST_KEY,
  guestActor,
  isAppError,
  otherGuestActor,
  strangerActor,
} from "./atelier-fake-ctx.mjs";

const appointments = await import("../convex/model/atelier/appointments.ts");
const cases = await import("../convex/model/atelier/cases.ts");
const drafts = await import("../convex/model/atelier/drafts.ts");
const { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES, APPOINTMENT_PERIOD_LABELS } =
  await import("../convex/shared/atelier/enums.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const HOUR = 3_600_000;
const DAY = 86_400_000;
const TODAY = NOW - (NOW % DAY);

const CONTACT = { name: "Nia Okafor", email: "nia@example.com", channel: "email" };
const WINDOWS = [
  { date: TODAY + 3 * DAY + 5 * HOUR, period: "afternoon" },
  { date: TODAY + 2 * DAY, period: "morning" },
];

function request(overrides = {}) {
  return {
    service: "first_fitting",
    showroomId: "charlotte",
    preferredWindows: WINDOWS,
    timeZone: "America/New_York",
    contact: CONTACT,
    submissionKey: "fit-1",
    ...overrides,
  };
}

/** The shared fake knows `eq` only; the daily request budget reads a range on the owner index and filters by `createdAt`. */
function withRanges(db) {
  const original = db.query.bind(db);
  db.query = (table) => {
    const builder = original(table);
    const plainWithIndex = builder.withIndex.bind(builder);
    const plainFilter = builder.filter.bind(builder);
    builder.withIndex = (name, build) => {
      if (!build) return plainWithIndex(name);
      const predicates = [];
      const compare = (op) => (field, value) => {
        predicates.push((row) => op(row[field], value));
        return q;
      };
      const q = {
        eq: compare((a, b) => a === b),
        lt: compare((a, b) => a < b),
        lte: compare((a, b) => a <= b),
        gt: compare((a, b) => a > b),
        gte: compare((a, b) => a >= b),
      };
      build(q);
      for (const predicate of predicates) plainFilter(() => predicate);
      return builder;
    };
    builder.filter = (build) => {
      const resolve = (operand, row) =>
        operand && typeof operand === "object" && "__field" in operand ? row[operand.__field] : operand;
      const cmp = (op) => (a, b) => (row) => op(resolve(a, row), resolve(b, row));
      const q = {
        field: (name) => ({ __field: name }),
        eq: cmp((a, b) => a === b),
        neq: cmp((a, b) => a !== b),
        lt: cmp((a, b) => a < b),
        lte: cmp((a, b) => a <= b),
        gt: cmp((a, b) => a > b),
        gte: cmp((a, b) => a >= b),
      };
      const predicate = build(q);
      return plainFilter(() => predicate);
    };
    return builder;
  };
}

async function setup() {
  const f = fakeCtx();
  withRanges(f.ctx.db);
  const insertUser = async (doc) =>
    f.ctx.db.get(await f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc }));
  const concierge = await insertUser({ name: "Adaeze Nwosu", staffRoles: ["concierge"] });
  return { f, concierge };
}

const messagesOf = (f, caseId) => f.rowsOf("atelierCaseMessages").filter((m) => m.caseId === caseId);
const auditsOf = (f, action) => f.rowsOf("atelierAuditLog").filter((a) => a.action === action);

test("a request creates a fitting case through the case core, is 'requested', and repeats on the same key return it", async () => {
  const { f } = await setup();
  const result = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  assert.equal(result.duplicate, false);
  const appointment = await f.ctx.db.get(result.appointmentId);
  assert.equal(appointment.status, "requested");
  assert.equal(appointment.guestKey, GUEST_KEY);
  assert.equal(appointment.caseId, result.caseId);
  assert.equal(appointment.calendarRef, undefined);
  assert.equal(appointment.confirmedStart, undefined);
  assert.deepEqual(appointment.history, [{ at: NOW, from: "requested", to: "requested", by: "client" }]);
  assert.deepEqual(
    appointment.preferredWindows,
    [
      { date: TODAY + 2 * DAY, period: "morning" },
      { date: TODAY + 3 * DAY, period: "afternoon" },
    ],
    "windows are whole days, sorted",
  );

  const theCase = await f.ctx.db.get(result.caseId);
  assert.equal(theCase.kind, "fitting");
  assert.equal(theCase.status, "received");
  assert.equal(theCase.appointmentId, result.appointmentId);
  assert.equal(theCase.submissionKey, "fit-1");
  const receipt = messagesOf(f, result.caseId)[0].body;
  assert.match(receipt, /Fitting request received/);
  assert.match(receipt, /Requested · awaiting confirmation/);
  assert.match(receipt, /not a reserved slot/);
  assert.equal(f.rowsOf("atelierNotifications").filter((n) => n.caseId === result.caseId).length, 1);
  assert.equal(auditsOf(f, "appointment.request").length, 1);

  const inserts = f.log.inserts.length;
  const again = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ preferredWindows: [WINDOWS[0]] }),
    NOW + HOUR,
  );
  assert.deepEqual(again, { appointmentId: result.appointmentId, caseId: result.caseId, duplicate: true });
  assert.equal(f.log.inserts.length, inserts, "a retry writes nothing");
  assert.equal(f.rowsOf("atelierAppointments").length, 1);

  const foreign = await appointments.requestAppointment(f.ctx, otherGuestActor, request(), NOW);
  assert.equal(foreign.duplicate, false);
  assert.notEqual(foreign.caseId, result.caseId);
});

test("the request is validated: windows, zone, location, contact, ownership and an actor", async () => {
  const { f } = await setup();
  const reject = (overrides, code = "INVALID_INPUT", actor = guestActor) =>
    assert.rejects(appointments.requestAppointment(f.ctx, actor, request(overrides), NOW), isAppError(code));
  await reject({ preferredWindows: [] });
  await reject({
    preferredWindows: [
      ...WINDOWS,
      { date: TODAY + 5 * DAY, period: "evening" },
      { date: TODAY + 6 * DAY, period: "evening" },
    ],
  });
  await reject({ preferredWindows: [{ date: TODAY, period: "evening" }] }, "INVALID_INPUT");
  await reject({ preferredWindows: [{ date: NOW - DAY, period: "morning" }] });
  await reject({ timeZone: "Mars/Olympus" });
  await reject({ timeZone: " " });
  await reject({ showroomId: "virtual", service: "first_fitting" });
  await reject({ showroomId: "virtual", service: "measurement" });
  await reject({ contact: { ...CONTACT, email: "nope" } });
  await reject({ submissionKey: "  " });
  const other = await drafts.createDraft(f.ctx, otherGuestActor, {}, NOW);
  await reject({ draftId: other }, "NOT_FOUND");
  await reject({}, "UNAUTHENTICATED", { user: null, guestKey: null });
  assert.equal(f.rowsOf("atelierAppointments").length, 0);
  assert.equal(f.rowsOf("atelierCases").length, 0);

  const virtual = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ showroomId: "virtual", service: "consultation", submissionKey: "v" }),
    NOW,
  );
  assert.equal((await f.ctx.db.get(virtual.appointmentId)).showroomId, "virtual");
  const call = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ showroomId: "virtual", service: "virtual", submissionKey: "c" }),
    NOW,
  );
  assert.ok(call.appointmentId);
  const dup = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ preferredWindows: [WINDOWS[0], WINDOWS[0]], submissionKey: "d" }),
    NOW,
  );
  assert.equal((await f.ctx.db.get(dup.appointmentId)).preferredWindows.length, 1, "a repeated window counts once");
});

test("a request can join an open case the client already has; the same open request on it is the duplicate", async () => {
  const { f } = await setup();
  const draftId = await drafts.createDraft(f.ctx, guestActor, { lookKey: "armada" }, NOW);
  const quote = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "quote", draftId, contact: CONTACT, submissionKey: "q" },
    NOW,
  );
  const linked = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ caseId: quote.caseId, draftId, submissionKey: "f" }),
    NOW + 1,
  );
  assert.equal(linked.caseId, quote.caseId);
  assert.equal(f.rowsOf("atelierCases").length, 1, "no second case");
  const appointment = await f.ctx.db.get(linked.appointmentId);
  assert.equal(appointment.caseId, quote.caseId);
  assert.equal(appointment.draftId, draftId);
  assert.equal((await f.ctx.db.get(quote.caseId)).appointmentId, linked.appointmentId);
  assert.match(messagesOf(f, quote.caseId).at(-1).body, /First fitting at the Charlotte showroom/);
  assert.equal(f.rowsOf("atelierNotifications").filter((n) => n.caseId === quote.caseId).length, 2);

  const again = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ caseId: quote.caseId, submissionKey: "f-retry" }),
    NOW + 2,
  );
  assert.deepEqual(again, { appointmentId: linked.appointmentId, caseId: quote.caseId, duplicate: true });
  const different = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ caseId: quote.caseId, service: "consultation", submissionKey: "f-2" }),
    NOW + 3,
  );
  assert.equal(different.duplicate, false);
  assert.notEqual(different.appointmentId, linked.appointmentId);

  await assert.rejects(
    appointments.requestAppointment(f.ctx, otherGuestActor, request({ caseId: quote.caseId, submissionKey: "x" }), NOW),
    isAppError("NOT_FOUND"),
  );
  await f.ctx.db.patch(quote.caseId, { status: "completed" });
  await assert.rejects(
    appointments.requestAppointment(
      f.ctx,
      guestActor,
      request({ caseId: quote.caseId, service: "final_fitting", submissionKey: "y" }),
      NOW,
    ),
    isAppError("INVALID_STATE"),
  );
});

test("the client's view says what is true: requested until the house confirms, then confirmed with the booking", async () => {
  const { f, concierge } = await setup();
  const { appointmentId, caseId } = await appointments.requestAppointment(f.ctx, accountActor, request(), NOW);
  let view = appointments.toAppointmentView(await f.ctx.db.get(appointmentId));
  assert.equal(view.statusLabel, APPOINTMENT_STATUS_LABELS.requested);
  assert.equal(view.confirmed, false);
  assert.equal(view.confirmedStart, null);
  assert.equal(view.calendarRef, null);
  assert.equal(view.showroom.city, "Charlotte");
  assert.equal(view.showroomLabel, "Charlotte");
  assert.equal(view.serviceLabel, "First fitting");
  assert.equal(view.preferredWindows[0].periodLabel, APPOINTMENT_PERIOD_LABELS.morning);
  assert.equal(view.canReschedule, true);
  assert.equal(view.caseId, caseId);
  assert.ok(!JSON.stringify(view).includes("users|"));

  f.row(appointmentId).status = "confirmed";
  view = appointments.toAppointmentView(await f.ctx.db.get(appointmentId));
  assert.equal(view.confirmed, false, "a status alone never reads as confirmed without the booking");
  f.row(appointmentId).status = "requested";

  const start = TODAY + 2 * DAY + 16 * HOUR;
  await appointments.confirm(
    f.ctx,
    concierge,
    appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: " SQ-APT-1 " },
    NOW + HOUR,
  );
  view = appointments.toAppointmentView(await f.ctx.db.get(appointmentId));
  assert.equal(view.confirmed, true);
  assert.equal(view.confirmedStart, start);
  assert.equal(view.confirmedEnd, start + HOUR);
  assert.equal(view.calendarRef, "SQ-APT-1");
  assert.equal(view.history.at(-1).to, "confirmed");
  assert.equal(view.history.at(-1).by, "staff");

  assert.equal(await appointments.findOwnedAppointment(f.ctx, appointmentId, strangerActor), null);
  assert.equal(await appointments.findOwnedAppointment(f.ctx, appointmentId, guestActor), null);
  assert.throws(
    () => appointments.requireOwnedAppointment(f.row(appointmentId), strangerActor),
    isAppError("NOT_FOUND"),
  );
  assert.equal((await appointments.listMine(f.ctx, accountActor)).length, 1);
  assert.deepEqual(await appointments.listMine(f.ctx, strangerActor), []);
  const virtual = await appointments.requestAppointment(
    f.ctx,
    accountActor,
    request({ showroomId: "virtual", service: "virtual", submissionKey: "v" }),
    NOW,
  );
  const virtualView = appointments.toAppointmentView(await f.ctx.db.get(virtual.appointmentId));
  assert.equal(virtualView.showroom, null);
  assert.equal(virtualView.showroomLabel, "Virtual");
});

test("confirm needs the start, the end and the calendar reference, queues a notification and writes the case", async () => {
  const { f, concierge } = await setup();
  const { appointmentId, caseId } = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  const start = TODAY + 2 * DAY + 16 * HOUR;
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "  " },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart: start, confirmedEnd: start, calendarRef: "SQ-1" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart: start, confirmedEnd: start - HOUR, calendarRef: "SQ-1" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart: Number.NaN, confirmedEnd: start, calendarRef: "SQ-1" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  assert.equal((await f.ctx.db.get(appointmentId)).status, "requested", "a refused confirmation changes nothing");

  await appointments.confirm(
    f.ctx,
    concierge,
    appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1", note: "With Adaeze." },
    NOW + 1,
  );
  const row = await f.ctx.db.get(appointmentId);
  assert.equal(row.status, "confirmed");
  assert.equal(row.calendarRef, "SQ-1");
  assert.equal(row.confirmedStart, start);
  assert.equal(row.updatedAt, NOW + 1);
  assert.deepEqual(row.history.at(-1), {
    at: NOW + 1,
    from: "requested",
    to: "confirmed",
    by: "staff",
    note: "With Adaeze.",
  });
  const note = messagesOf(f, caseId).at(-1).body;
  assert.match(note, /^Confirmed for /);
  assert.match(note, /Booking reference SQ-1/);
  assert.match(note, /Charlotte showroom/);
  const notification = f
    .rowsOf("atelierNotifications")
    .filter((n) => n.caseId === caseId)
    .at(-1);
  assert.match(notification.subject, /confirmed/);
  assert.equal(notification.status, "queued");
  assert.equal(notification.guestKey, GUEST_KEY);
  const entry = auditsOf(f, "appointment.confirm")[0];
  assert.equal(entry.actorKind, "staff");
  assert.equal(entry.meta.calendarRef, "SQ-1");

  await appointments.confirm(
    f.ctx,
    concierge,
    appointmentId,
    { confirmedStart: start + DAY, confirmedEnd: start + DAY + HOUR, calendarRef: "SQ-2" },
    NOW + 2,
  );
  assert.equal((await f.ctx.db.get(appointmentId)).calendarRef, "SQ-2", "a confirmed time can be moved by the house");
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      "atelierAppointments|404",
      { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1" },
      NOW,
    ),
    isAppError("NOT_FOUND"),
  );
});

test("reschedule withdraws any confirmation and asks the house again; cancel is final and told to the case", async () => {
  const { f, concierge } = await setup();
  const { appointmentId, caseId } = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW);
  const start = TODAY + 2 * DAY + 16 * HOUR;
  await appointments.confirm(
    f.ctx,
    concierge,
    appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1" },
    NOW + 1,
  );

  const newWindows = [{ date: TODAY + 9 * DAY, period: "evening" }];
  await assert.rejects(
    appointments.reschedule(f.ctx, guestActor, await f.ctx.db.get(appointmentId), [], undefined, NOW + 2),
    isAppError("INVALID_INPUT"),
  );
  await appointments.reschedule(
    f.ctx,
    guestActor,
    await f.ctx.db.get(appointmentId),
    newWindows,
    " Travelling that week. ",
    NOW + 2,
  );
  let row = await f.ctx.db.get(appointmentId);
  assert.equal(row.status, "rescheduled");
  assert.equal(row.confirmedStart, undefined);
  assert.equal(row.confirmedEnd, undefined);
  assert.equal(row.calendarRef, "SQ-1", "the reference stays for the house to clear the old booking");
  assert.deepEqual(row.preferredWindows, newWindows);
  assert.deepEqual(row.history.at(-1), {
    at: NOW + 2,
    from: "confirmed",
    to: "rescheduled",
    by: "client",
    note: "Travelling that week.",
  });
  assert.equal(appointments.toAppointmentView(row).statusLabel, APPOINTMENT_STATUS_LABELS.rescheduled);
  assert.equal(appointments.toAppointmentView(row).confirmed, false);
  assert.equal(appointments.toAppointmentView(row).calendarRef, null, "the client no longer reads it as a booking");
  assert.equal((await appointments.toStaffRow(f.ctx, row)).recordedCalendarRef, "SQ-1", "the house still does");
  const rescheduleNote = messagesOf(f, caseId).at(-1).body;
  assert.match(rescheduleNote, /Rescheduled · awaiting confirmation/);
  assert.match(rescheduleNote, /reschedule your first fitting confirmed for /);
  assert.match(rescheduleNote, /The house will clear booking reference SQ-1 and confirm a new time with you\./);
  assert.equal((await f.ctx.db.get(caseId)).status, "awaiting_staff", "the house has something to do again");
  assert.equal(auditsOf(f, "appointment.reschedule").length, 1);
  assert.equal(auditsOf(f, "appointment.reschedule")[0].meta.hadCalendarRef, true);

  await assert.rejects(appointments.cancel(f.ctx, otherGuestActor, row, undefined, NOW + 3), isAppError("NOT_FOUND"));
  await assert.rejects(
    appointments.reschedule(f.ctx, strangerActor, row, newWindows, undefined, NOW + 3),
    isAppError("NOT_FOUND"),
  );
  await appointments.cancel(f.ctx, guestActor, row, "No longer needed.", NOW + 3);
  row = await f.ctx.db.get(appointmentId);
  assert.equal(row.status, "cancelled");
  assert.equal(row.history.at(-1).to, "cancelled");
  assert.equal(row.history.at(-1).by, "client");
  assert.match(messagesOf(f, caseId).at(-1).body, /You cancelled your first fitting/);
  assert.match(messagesOf(f, caseId).at(-1).body, /No longer needed/);
  const writes = f.log.patches.length;
  await appointments.cancel(f.ctx, guestActor, row, undefined, NOW + 4);
  assert.equal(f.log.patches.length, writes, "cancelling twice changes nothing");
  await assert.rejects(
    appointments.reschedule(f.ctx, guestActor, row, newWindows, undefined, NOW + 4),
    isAppError("INVALID_STATE"),
  );
  const view = appointments.toAppointmentView(row);
  assert.equal(view.canReschedule, false);
  assert.equal(view.canCancel, false);
  assert.equal(auditsOf(f, "appointment.cancel").length, 1);
});

test("cancelling a confirmed booking tells the house to clear it, and a completed one cannot change", async () => {
  const { f, concierge } = await setup();
  const { appointmentId, caseId } = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  const start = TODAY + 2 * DAY + 16 * HOUR;
  await assert.rejects(
    appointments.complete(f.ctx, concierge, appointmentId, undefined, NOW),
    isAppError("INVALID_STATE"),
    "only a confirmed appointment can have happened",
  );
  await appointments.confirm(
    f.ctx,
    concierge,
    appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1" },
    NOW + 1,
  );
  const confirmed = await f.ctx.db.get(appointmentId);
  await appointments.cancel(f.ctx, guestActor, confirmed, undefined, NOW + 2);
  assert.match(messagesOf(f, caseId).at(-1).body, /confirmed for .* The house will clear the booking\./);
  assert.equal((await f.ctx.db.get(appointmentId)).calendarRef, "SQ-1", "the reference stays for the house to clear");
  assert.equal(
    appointments.toAppointmentView(await f.ctx.db.get(appointmentId)).calendarRef,
    null,
    "the client no longer reads it as a booking",
  );
  await assert.rejects(
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1" },
      NOW + 3,
    ),
    isAppError("INVALID_STATE"),
  );

  const second = await appointments.requestAppointment(f.ctx, guestActor, request({ submissionKey: "fit-2" }), NOW);
  await appointments.confirm(
    f.ctx,
    concierge,
    second.appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-9" },
    NOW + 1,
  );
  await appointments.complete(f.ctx, concierge, second.appointmentId, "Measurements taken.", NOW + 3 * DAY);
  const done = await f.ctx.db.get(second.appointmentId);
  assert.equal(done.status, "completed");
  assert.equal(done.history.at(-1).to, "completed");
  assert.match(messagesOf(f, second.caseId).at(-1).body, /first fitting with Adaeze is complete/);
  await assert.rejects(
    appointments.cancel(f.ctx, guestActor, done, undefined, NOW + 4 * DAY),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    appointments.reschedule(f.ctx, guestActor, done, WINDOWS, undefined, NOW + 4 * DAY),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    appointments.complete(f.ctx, concierge, second.appointmentId, undefined, NOW + 4 * DAY),
    isAppError("INVALID_STATE"),
  );
  assert.equal(auditsOf(f, "appointment.complete").length, 1);
});

test("rescheduling a request that was never confirmed names no booking to clear", async () => {
  const { f } = await setup();
  const { appointmentId, caseId } = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  await appointments.reschedule(
    f.ctx,
    guestActor,
    await f.ctx.db.get(appointmentId),
    [{ date: TODAY + 9 * DAY, period: "evening" }],
    undefined,
    NOW + 1,
  );
  const note = messagesOf(f, caseId).at(-1).body;
  assert.match(note, /^You asked to reschedule your first fitting\. New preferred windows: /);
  assert.doesNotMatch(note, /clear booking reference|confirmed for/);
  assert.equal(auditsOf(f, "appointment.reschedule")[0].meta.hadCalendarRef, false);
});

test("a fitting cannot be confirmed for a time that has passed; a few minutes' grace covers a booking made as it begins", async () => {
  const { f, concierge } = await setup();
  const { appointmentId } = await appointments.requestAppointment(f.ctx, guestActor, request(), NOW);
  const confirmAt = (confirmedStart, now) =>
    appointments.confirm(
      f.ctx,
      concierge,
      appointmentId,
      { confirmedStart, confirmedEnd: confirmedStart + HOUR, calendarRef: "SQ-1" },
      now,
    );
  await assert.rejects(confirmAt(NOW - 365 * DAY, NOW), isAppError("INVALID_INPUT"));
  await assert.rejects(confirmAt(NOW - HOUR, NOW), isAppError("INVALID_INPUT"));
  await assert.rejects(confirmAt(NOW - appointments.CONFIRM_GRACE_MS - 1, NOW), isAppError("INVALID_INPUT"));
  assert.equal((await f.ctx.db.get(appointmentId)).status, "requested", "a refused confirmation changes nothing");
  assert.equal(f.rowsOf("atelierNotifications").filter((n) => /confirmed/.test(n.subject)).length, 0);
  assert.equal(auditsOf(f, "appointment.confirm").length, 0);

  await confirmAt(NOW - appointments.CONFIRM_GRACE_MS + 60_000, NOW);
  const row = await f.ctx.db.get(appointmentId);
  assert.equal(row.status, "confirmed");
  assert.equal(row.calendarRef, "SQ-1");
});

test("'tomorrow' is read in the request's own time zone, never the server's clock, and a window error names its field", async () => {
  const { f } = await setup();
  // 21:00 in Charlotte on October 19 is already 01:00 UTC on October 20: a window for the 20th is tomorrow there.
  const lateEvening = Date.UTC(2026, 9, 20, 1);
  const twentieth = Date.UTC(2026, 9, 20);
  assert.equal(appointments.localDayAsUtc(lateEvening, "America/New_York"), Date.UTC(2026, 9, 19));
  assert.equal(appointments.localDayAsUtc(lateEvening, "UTC"), twentieth);
  assert.equal(appointments.localDayAsUtc(lateEvening, "Not/AZone"), twentieth, "an unreadable zone falls back to UTC");
  const windows = [{ date: twentieth, period: "evening" }];
  assert.deepEqual(appointments.normalizeWindows(windows, lateEvening, "America/New_York"), windows);
  assert.throws(() => appointments.normalizeWindows(windows, lateEvening, "UTC"), isAppError("INVALID_INPUT"));
  assert.throws(
    () => appointments.normalizeWindows(windows, lateEvening),
    (error) => error.data.code === "INVALID_INPUT" && error.data.details.field === appointments.WINDOWS_FIELD,
  );
  assert.equal(appointments.WINDOWS_FIELD, "preferredWindows", "the request mutation's argument name");
  // Noon UTC on the 18th is 01:00 on the 19th in Auckland: a window for the 19th is today there, not tomorrow.
  const aucklandSmallHours = Date.UTC(2026, 9, 18, 12);
  assert.equal(appointments.localDayAsUtc(aucklandSmallHours, "Pacific/Auckland"), Date.UTC(2026, 9, 19));
  assert.throws(
    () =>
      appointments.normalizeWindows(
        [{ date: Date.UTC(2026, 9, 19), period: "morning" }],
        aucklandSmallHours,
        "Pacific/Auckland",
      ),
    isAppError("INVALID_INPUT"),
  );
  assert.deepEqual(
    appointments.normalizeWindows([{ date: Date.UTC(2026, 9, 19), period: "morning" }], aucklandSmallHours, "UTC"),
    [{ date: Date.UTC(2026, 9, 19), period: "morning" }],
  );

  const ok = await appointments.requestAppointment(
    f.ctx,
    guestActor,
    request({ preferredWindows: windows, submissionKey: "tz" }),
    lateEvening,
  );
  assert.deepEqual((await f.ctx.db.get(ok.appointmentId)).preferredWindows, windows);
  await assert.rejects(
    appointments.requestAppointment(
      f.ctx,
      guestActor,
      request({ preferredWindows: windows, timeZone: "UTC", submissionKey: "tz-utc" }),
      lateEvening,
    ),
    (error) => error.data.code === "INVALID_INPUT" && error.data.details.field === "preferredWindows",
  );
  // A reschedule reads the appointment's own zone.
  await appointments.reschedule(
    f.ctx,
    guestActor,
    await f.ctx.db.get(ok.appointmentId),
    [{ date: twentieth, period: "morning" }],
    undefined,
    lateEvening + 1,
  );
  assert.deepEqual((await f.ctx.db.get(ok.appointmentId)).preferredWindows, [{ date: twentieth, period: "morning" }]);
});

test("listPending holds what the house has yet to confirm, longest waiting first, with the client's name", async () => {
  const { f, concierge } = await setup();
  const late = await appointments.requestAppointment(f.ctx, guestActor, request({ submissionKey: "late" }), NOW + HOUR);
  const early = await appointments.requestAppointment(
    f.ctx,
    otherGuestActor,
    request({ submissionKey: "early", contact: { ...CONTACT, name: "Kwame Mensah" } }),
    NOW,
  );
  const confirmed = await appointments.requestAppointment(f.ctx, accountActor, request({ submissionKey: "done" }), NOW);
  const start = TODAY + 2 * DAY + 16 * HOUR;
  await appointments.confirm(
    f.ctx,
    concierge,
    confirmed.appointmentId,
    { confirmedStart: start, confirmedEnd: start + HOUR, calendarRef: "SQ-1" },
    NOW + 2,
  );
  const cancelled = await appointments.requestAppointment(f.ctx, accountActor, request({ submissionKey: "gone" }), NOW);
  await appointments.cancel(f.ctx, accountActor, await f.ctx.db.get(cancelled.appointmentId), undefined, NOW + 2);
  await appointments.reschedule(
    f.ctx,
    guestActor,
    await f.ctx.db.get(late.appointmentId),
    [{ date: TODAY + 8 * DAY, period: "morning" }],
    undefined,
    NOW + 3,
  );

  const pending = await appointments.listPending(f.ctx);
  assert.deepEqual(
    pending.map((row) => row._id),
    [early.appointmentId, late.appointmentId],
  );
  assert.equal(pending[0].clientFirstName, "Kwame");
  assert.equal(pending[0].clientName, "Kwame Mensah");
  assert.equal(pending[0].contact.email, CONTACT.email);
  assert.equal(pending[0].caseStatus, "received");
  assert.equal(pending[1].status, "rescheduled");
  const row = await appointments.staffGet(f.ctx, confirmed.appointmentId);
  assert.equal(row.recordedCalendarRef, "SQ-1");
  assert.equal(row.clientFirstName, "Nia");
  await assert.rejects(appointments.staffGet(f.ctx, "atelierAppointments|404"), isAppError("NOT_FOUND"));
});

test("the booking state machine: nothing leaves cancelled or completed, and confirmed is reachable only from a request", () => {
  for (const from of APPOINTMENT_STATUSES) {
    assert.ok(Array.isArray(appointments.APPOINTMENT_TRANSITIONS[from]), `${from} is covered`);
    for (const to of APPOINTMENT_STATUSES) {
      const legal = appointments.canTransition(from, to);
      if (from === "cancelled" || from === "completed") assert.equal(legal, false, `${from} is terminal`);
      if (to === "requested") assert.equal(legal, false, "a request is made once; afterwards it is rescheduled");
      if (to === "completed")
        assert.equal(legal, from === "confirmed", "only a confirmed appointment can have taken place");
    }
  }
  assert.equal(appointments.isTerminal({ status: "cancelled" }), true);
  assert.equal(appointments.isTerminal({ status: "rescheduled" }), false);
  assert.equal(appointments.showroomLabel("atlanta"), "Atlanta");
  assert.equal(appointments.showroomLabel("virtual"), "Virtual");
  assert.throws(() => appointments.assertLocationFits("final_fitting", "virtual"), isAppError("INVALID_INPUT"));
  assert.doesNotThrow(() => appointments.assertLocationFits("consultation", "virtual"));
  assert.match(
    appointments.formatWhen(Date.UTC(2026, 10, 14, 16), "America/New_York"),
    /November 14, 2026 at 11:00 AM/,
  );
  assert.match(appointments.formatWhen(Date.UTC(2026, 10, 14, 16), "Nowhere/Nowhere"), /November 14, 2026 at 4:00 PM/);
});
