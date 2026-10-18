import assert from "node:assert/strict";
import test from "node:test";
import { fakeCtx, GUEST_KEY, guestActor, isAppError, otherGuestActor, strangerActor } from "./atelier-fake-ctx.mjs";

const corrections = await import("../convex/model/atelier/corrections.ts");
const caseCore = await import("../convex/model/atelier/case_core.ts");
const { DEFAULT_SPEC, specHash } = await import("../convex/shared/atelier/spec.ts");
const { CORRECTION_STATUSES, CORRECTION_STATUS_LABELS, REFUND_STATE_LABELS } = await import("../convex/shared/atelier/enums.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;

/** The shared fake plus what aftercare needs: stored files, signed URLs and system reads of `_storage`. */
function withStorage(f) {
  const files = new Map();
  const deleted = [];
  f.ctx.db.system = { get: async (_table, id) => files.get(id) ?? null };
  f.ctx.storage = {
    getUrl: async (id) => (files.has(id) ? `https://files.test/${id}` : null),
    delete: async (id) => {
      files.delete(id);
      deleted.push(id);
    },
  };
  f.ctx.scheduler = { runAfter: async () => {} };
  const addFile = (id, overrides = {}) => {
    files.set(id, { _id: id, _creationTime: 1, size: 500_000, contentType: "image/jpeg", ...overrides });
    return id;
  };
  return { files, deleted, addFile };
}

async function setup({ status = "shipped", owner = "account", fitProfile = true, fitAcceptedAt } = {}) {
  const f = fakeCtx();
  const storage = withStorage(f);
  const insertUser = async (doc) => f.ctx.db.get(await f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc }));
  const client = await insertUser({ name: "Nia Okafor", email: "nia@example.test" });
  const operations = await insertUser({ name: "Kofi Boateng", staffRoles: ["operations"] });
  const finance = await insertUser({ name: "Ada Mensah", staffRoles: ["finance"] });
  const actor = owner === "account" ? { user: client, guestKey: null } : guestActor;
  const ownerFields = owner === "account" ? { userId: client._id } : { guestKey: GUEST_KEY };
  let fitProfileId;
  if (fitProfile && owner === "account") {
    fitProfileId = await f.ctx.db.insert("atelierFitProfiles", {
      userId: client._id,
      version: 2,
      units: "cm",
      measurements: { chest: 100 },
      comfort: { jacket: "easy", trousers: "easy", movement: [] },
      provenance: "atelier",
      uncertainFields: [],
      status: "approved",
      createdAt: NOW - 30 * DAY,
      updatedAt: NOW - 30 * DAY,
    });
  }
  const spec = { ...DEFAULT_SPEC, clothCode: "C-TEST" };
  const draftId = await f.ctx.db.insert("atelierDrafts", {
    ...ownerFields,
    name: "Wedding suit",
    spec,
    shortlist: [],
    stage: "review",
    completedSteps: [],
    catalogueVersion: 1,
    revision: 3,
    status: "submitted",
    createdAt: NOW - 60 * DAY,
    updatedAt: NOW - 60 * DAY,
    lastSavedAt: NOW - 60 * DAY,
  });
  const contact = { name: "Nia Okafor", email: "nia@example.test", channel: "email" };
  const { caseId } = await caseCore.createCase(f.ctx, { kind: "quote", owner: ownerFields, actor, contact, submissionKey: "quote-1", draftId }, NOW - 50 * DAY);
  const released = status !== "preflight";
  const inHand = ["shipped", "collected", "fit_review", "accepted", "correction_open"].includes(status);
  const orderId = await f.ctx.db.insert("atelierOrders", {
    ...ownerFields,
    caseId,
    quoteId: "atelierQuotes|999",
    revisionId: "atelierRevisions|999",
    draftId,
    fitProfileId,
    spec,
    specHash: specHash(spec),
    status,
    payment: { state: "confirmed", amountUsd: 2580, reference: "sq_1", confirmedAt: NOW - 45 * DAY },
    releasedAt: released ? NOW - 40 * DAY : undefined,
    shippedAt: inHand ? NOW - 3 * DAY : undefined,
    deliveredAt: inHand ? NOW - DAY : undefined,
    fitAcceptedAt,
    createdAt: NOW - 50 * DAY,
    updatedAt: NOW - DAY,
  });
  await f.ctx.db.insert("atelierOrderMilestones", { orderId, kind: "shipped", label: "Shipped", at: NOW - 3 * DAY, source: "carrier", estimated: false });
  const order = async () => f.ctx.db.get(orderId);
  const correction = async (id) => f.ctx.db.get(id);
  const messagesOf = (id) => f.rowsOf("atelierCaseMessages").filter((m) => m.caseId === id).map((m) => m.body);
  const audits = (action) => f.rowsOf("atelierAuditLog").filter((a) => a.action === action);
  const request = (input = {}, at = NOW) =>
    corrections.requestCorrection(
      f.ctx,
      actor,
      orderId,
      { kind: "alteration", region: "jacket_sleeves", description: "The left sleeve sits a little long.", submissionKey: "corr-1", ...input },
      at,
    );
  return { f, storage, client, operations, finance, actor, ownerFields, orderId, caseId, order, correction, messagesOf, audits, request };
}

/** Walks a correction to "completed" through the legal staff and client steps. */
async function completeCorrection(s, correctionId, { at = NOW } = {}) {
  const { f, operations, actor } = s;
  const c = () => f.ctx.db.get(correctionId);
  await corrections.triage(f.ctx, operations, await c(), "Thank you; could you send a photograph of the cuff?", at + 1);
  await corrections.proposeRemedy(f.ctx, operations, await c(), { kind: "alteration", coverage: "included", logistics: "We will collect the jacket by courier on a day you choose." }, at + 2);
  await corrections.acceptRemedy(f.ctx, actor, await c(), at + 3);
  await corrections.setStatus(f.ctx, operations, await c(), "in_progress", undefined, at + 4);
  await corrections.setStatus(f.ctx, operations, await c(), "received", undefined, at + 5);
  await corrections.setStatus(f.ctx, operations, await c(), "completed", undefined, at + 6);
  return c();
}

// ------------------------------------------------------------------------------------------------
// The request (C23, C24)
// ------------------------------------------------------------------------------------------------

test("a fit issue on a delivered suit opens an aftercare case, records the fit profile version and marks the order correction_open", async () => {
  const s = await setup();
  const photo = s.storage.addFile("_storage|photo1");
  const { correctionId, caseId, duplicate } = await s.request({ photoStorageIds: [photo] });
  assert.equal(duplicate, false);
  const c = await s.correction(correctionId);
  assert.equal(c.status, "requested");
  assert.equal(c.kind, "alteration");
  assert.equal(c.region, "jacket_sleeves");
  assert.equal(c.fitProfileVersionBefore, 2);
  assert.deepEqual(c.photoStorageIds, [photo]);
  assert.equal(c.userId, s.client._id);
  const caseDoc = await s.f.ctx.db.get(caseId);
  assert.equal(caseDoc.kind, "aftercare");
  assert.equal(caseDoc.correctionId, correctionId);
  assert.equal(caseDoc.orderId, s.orderId);
  assert.equal(caseDoc.contact.email, "nia@example.test", "the order's case contact is reused");
  assert.equal((await s.order()).status, "correction_open");
  assert.equal(s.f.rowsOf("atelierOrderMilestones").length, 1, "milestones belong to the orders domain and are not written here");
  const messages = s.messagesOf(caseId);
  assert.ok(messages.some((m) => /fit correction against fit profile v2/.test(m)), messages.join(" | "));
  assert.equal(s.audits("correction.request").length, 1);
  const view = await corrections.toCorrectionView(s.f.ctx, c);
  assert.equal(view.order.fitProfileVersion, 2, "scenario 11: the exact profile stays inspectable");
  assert.ok(view.order.lines.length > 5, "the original specification stays inspectable");
  assert.deepEqual(view.photoUrls, [`https://files.test/${photo}`], "signed URLs, not storage ids");
  assert.equal("photoStorageIds" in view, false, "no storage id reaches the client");
  assert.equal(view.statusLabel, CORRECTION_STATUS_LABELS.requested);
});

test("a detail mismatch is named as a manufacturing check, not a fit correction", async () => {
  const s = await setup();
  const { caseId } = await s.request({ region: "detail_mismatch", description: "The design has double vents; the jacket has one." });
  const messages = s.messagesOf(caseId);
  assert.ok(messages.some((m) => /manufacturing check, not a fit correction/.test(m)), messages.join(" | "));
  assert.ok(!messages.some((m) => /against fit profile/.test(m)));
});

test("submitting twice with the same key yields one correction and one case", async () => {
  const s = await setup();
  const first = await s.request();
  const second = await s.request({}, NOW + 1);
  assert.equal(second.duplicate, true);
  assert.equal(second.correctionId, first.correctionId);
  assert.equal(second.caseId, first.caseId);
  assert.equal(s.f.rowsOf("atelierCorrections").length, 1);
  assert.equal(s.f.rowsOf("atelierCases").filter((c) => c.kind === "aftercare").length, 1);
});

test("a fit issue cannot be raised before the suit is in hand; a cancellation can, and after release it needs the house's review", async () => {
  const making = await setup({ status: "making" });
  await assert.rejects(making.request(), isAppError("INVALID_STATE"));
  const cancelLater = await making.request({ kind: "cancellation", region: undefined, description: "Plans changed." });
  assert.equal((await making.order()).status, "making", "a cancellation during production does not pretend the suit is in hand");
  const view = await corrections.toCorrectionView(making.f.ctx, await making.correction(cancelLater.correctionId));
  assert.equal(view.requiresHouseReview, true);
  assert.ok(making.messagesOf(cancelLater.caseId).some((m) => /reviews every cancellation after release/.test(m)));

  const preflight = await setup({ status: "preflight" });
  const early = await preflight.request({ kind: "cancellation", region: undefined, description: "Plans changed." });
  assert.equal((await preflight.correction(early.correctionId)).status, "requested");
  assert.equal((await corrections.toCorrectionView(preflight.f.ctx, await preflight.correction(early.correctionId))).requiresHouseReview, false);
  assert.ok(preflight.messagesOf(early.caseId).some((m) => /has not been released yet/.test(m)));

  const cancelled = await setup({ status: "cancelled" });
  await assert.rejects(cancelled.request({ kind: "cancellation" }), isAppError("INVALID_STATE"));
});

test("input is checked: an empty description, too many photographs or a file that is not an image", async () => {
  const s = await setup();
  await assert.rejects(s.request({ description: "   " }), isAppError("INVALID_INPUT"));
  const many = Array.from({ length: 7 }, (_, i) => s.storage.addFile(`_storage|p${i}`));
  await assert.rejects(s.request({ photoStorageIds: many }), isAppError("INVALID_INPUT"));
  await assert.rejects(s.request({ photoStorageIds: ["_storage|missing"] }), isAppError("INVALID_INPUT"));
  const pdf = s.storage.addFile("_storage|pdf", { contentType: "application/pdf" });
  await assert.rejects(s.request({ photoStorageIds: [pdf] }), isAppError("INVALID_INPUT"));
});

test("another client's commission or correction is never acknowledged", async () => {
  const s = await setup({ owner: "guest" });
  await assert.rejects(
    corrections.requestCorrection(s.f.ctx, otherGuestActor, s.orderId, { kind: "alteration", description: "x", submissionKey: "k" }, NOW),
    isAppError("NOT_FOUND"),
  );
  const { correctionId } = await s.request();
  await assert.rejects(corrections.requireOwnedCorrection(s.f.ctx, correctionId, otherGuestActor), isAppError("NOT_FOUND"));
  await assert.rejects(corrections.requireOwnedCorrection(s.f.ctx, correctionId, strangerActor), isAppError("NOT_FOUND"));
  await assert.rejects(corrections.acceptRemedy(s.f.ctx, strangerActor, await s.correction(correctionId), NOW), isAppError("NOT_FOUND"));
  assert.ok(await corrections.requireOwnedCorrection(s.f.ctx, correctionId, guestActor));
});

// ------------------------------------------------------------------------------------------------
// The line: legal transitions (O07)
// ------------------------------------------------------------------------------------------------

test("the transition table names only real statuses and closed is final", () => {
  for (const from of CORRECTION_STATUSES) {
    for (const to of corrections.CORRECTION_TRANSITIONS[from]) assert.ok(CORRECTION_STATUSES.includes(to), `${from} → ${to}`);
  }
  assert.deepEqual(corrections.CORRECTION_TRANSITIONS.closed, []);
  assert.ok(corrections.canTransition("requested", "triaged"));
  assert.ok(!corrections.canTransition("requested", "in_progress"));
  assert.ok(!corrections.canTransition("completed", "in_progress"));
});

test("triage, remedy, acceptance, progress, completion and the client's resolved reassessment walk the line and settle the order", async () => {
  const s = await setup();
  const { correctionId, caseId } = await s.request();
  const c = () => s.correction(correctionId);

  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(corrections.proposeRemedy(s.f.ctx, s.operations, await c(), { kind: "alteration", coverage: "included", logistics: "x" }, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(corrections.acceptRemedy(s.f.ctx, s.actor, await c(), NOW), isAppError("INVALID_STATE"), "nothing to accept yet");

  await corrections.triage(s.f.ctx, s.operations, await c(), "Thank you. Could you send a photograph of the cuff?", NOW + 1);
  assert.equal((await c()).status, "triaged");
  let caseDoc = await s.f.ctx.db.get(caseId);
  assert.equal(caseDoc.status, "assigned");
  assert.equal(caseDoc.ownerStaffId, s.operations._id, "the triager owns the case");

  await assert.rejects(
    corrections.proposeRemedy(s.f.ctx, s.operations, await c(), { kind: "alteration", coverage: "quoted", logistics: "Courier." }, NOW + 2),
    isAppError("INVALID_INPUT"),
    "a quoted remedy needs its amount",
  );
  await corrections.proposeRemedy(
    s.f.ctx,
    s.operations,
    await c(),
    { kind: "alteration", coverage: "included", logistics: "We will collect the jacket by courier on a day you choose.", deadline: NOW + 14 * DAY },
    NOW + 2,
  );
  let current = await c();
  assert.equal(current.status, "remedy_proposed");
  assert.equal(current.remedy.approvedByStaffId, s.operations._id);
  assert.equal((await s.f.ctx.db.get(caseId)).status, "awaiting_client");
  assert.ok(s.messagesOf(caseId).some((m) => /Proposed remedy: alteration · Included in your commission/.test(m)));
  const proposedView = await corrections.toCorrectionView(s.f.ctx, current);
  assert.equal(proposedView.remedy.approvedBy, "Kofi", "first name only");

  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW + 3), isAppError("INVALID_STATE"), "not before the client accepts");
  await corrections.acceptRemedy(s.f.ctx, s.actor, await c(), NOW + 3);
  assert.equal((await c()).status, "accepted");
  await corrections.acceptRemedy(s.f.ctx, s.actor, await c(), NOW + 3);
  assert.equal((await c()).status, "accepted", "accepting twice is harmless");

  await assert.rejects(corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "resolved", note: "" }, NOW + 4), isAppError("INVALID_STATE"), "not finished yet");
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW + 4);
  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "accepted", undefined, NOW + 5), isAppError("INVALID_STATE"), "accepted is the client's word");
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "received", undefined, NOW + 5);
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "completed", undefined, NOW + 6);
  current = await c();
  assert.equal(current.status, "completed");
  assert.equal(current.fitProfileVersionAfter, 2, "the client's current approved profile is versioned onto the correction");
  assert.equal((await s.f.ctx.db.get(caseId)).status, "awaiting_client");
  assert.equal((await s.order()).status, "correction_open", "completed is not resolved");

  await corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "resolved", note: "Sits perfectly now." }, NOW + 7);
  current = await c();
  assert.equal(current.status, "closed");
  assert.deepEqual(current.reassessment, { at: NOW + 7, outcome: "resolved", note: "Sits perfectly now." });
  caseDoc = await s.f.ctx.db.get(caseId);
  assert.equal(caseDoc.status, "completed");
  assert.equal(caseDoc.closedAt, NOW + 7);
  assert.equal((await s.order()).status, "accepted", "a resolved reassessment settles the commission");
  await assert.rejects(corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "resolved", note: "" }, NOW + 8), isAppError("INVALID_STATE"));

  for (const action of ["correction.triage", "correction.proposeRemedy", "correction.setStatus"]) assert.ok(s.audits(action).length > 0, action);
  assert.equal(s.audits("correction.setStatus").length, 3);
});

test("declined only from a triaged request, and only with a note; the order then leaves correction_open", async () => {
  const s = await setup();
  const { correctionId, caseId } = await s.request();
  const c = () => s.correction(correctionId);
  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "declined", "Outside the policy.", NOW), isAppError("INVALID_STATE"), "not from requested");
  await corrections.triage(s.f.ctx, s.operations, await c(), "Looking into it.", NOW + 1);
  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "declined", undefined, NOW + 2), isAppError("INVALID_INPUT"), "a note is required");
  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "declined", "  ", NOW + 2), isAppError("INVALID_INPUT"));
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "declined", "The sleeve length matches the approved specification; a fitting is offered instead.", NOW + 2);
  assert.equal((await c()).status, "declined");
  assert.equal((await s.f.ctx.db.get(caseId)).status, "completed");
  assert.equal((await s.order()).status, "fit_review", "the client had not accepted the fit, so the review is open again");
  assert.ok(s.messagesOf(caseId).some((m) => /Declined\. The sleeve length matches/.test(m)));
  await assert.rejects(corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW + 3), isAppError("INVALID_STATE"), "declined is final but for closing");
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "declined", "again", NOW + 3);
  assert.equal(s.audits("correction.setStatus").length, 1, "setting the same word again changes nothing");
});

test("an order whose fit had been accepted returns to accepted when a correction is declined", async () => {
  const s = await setup({ status: "accepted", fitAcceptedAt: NOW - 12 * 3_600_000 });
  const { correctionId } = await s.request();
  assert.equal((await s.order()).status, "correction_open");
  await corrections.triage(s.f.ctx, s.operations, await s.correction(correctionId), "Looking.", NOW + 1);
  await corrections.setStatus(s.f.ctx, s.operations, await s.correction(correctionId), "declined", "Within the agreed tolerance.", NOW + 2);
  assert.equal((await s.order()).status, "accepted");
});

test("a completed cancellation cancels the commission; nothing else does", async () => {
  const s = await setup({ status: "released" });
  const { correctionId } = await s.request({ kind: "cancellation", region: undefined, description: "The wedding is off." });
  const c = () => s.correction(correctionId);
  await corrections.triage(s.f.ctx, s.operations, await c(), "We are sorry to hear it. Reviewing under the final-sale policy.", NOW + 1);
  await corrections.proposeRemedy(s.f.ctx, s.operations, await c(), { kind: "cancellation", coverage: "store_credit", logistics: "The cloth already cut is held for you as store credit." }, NOW + 2);
  await corrections.acceptRemedy(s.f.ctx, s.actor, await c(), NOW + 3);
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW + 4);
  assert.equal((await s.order()).status, "released", "in progress is not cancelled");
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "completed", undefined, NOW + 5);
  assert.equal((await s.order()).status, "cancelled");
  assert.equal(s.f.rowsOf("atelierOrderMilestones").length, 1, "no milestone written from here");
});

// ------------------------------------------------------------------------------------------------
// Refunds: approved is not refunded (C25, O07)
// ------------------------------------------------------------------------------------------------

test("confirmRefund is the only path to refunded, needs an approval first, and is idempotent on the reference", async () => {
  const s = await setup();
  const { correctionId, caseId } = await s.request({ kind: "refund", region: undefined, description: "The jacket arrived damaged." });
  const c = () => s.correction(correctionId);
  await assert.rejects(corrections.confirmRefund(s.f.ctx, s.finance, await c(), { amountUsd: 400, reference: "sq_r1" }, NOW), isAppError("INVALID_STATE"), "nothing approved yet");

  await assert.rejects(corrections.approveRefund(s.f.ctx, s.finance, await c(), 0, NOW), isAppError("INVALID_INPUT"));
  await corrections.approveRefund(s.f.ctx, s.finance, await c(), 400, NOW + 1);
  let current = await c();
  assert.equal(current.refund.state, "approved");
  assert.equal(current.refund.amountUsd, 400);
  assert.equal(current.refund.confirmedAt, undefined);
  assert.equal(corrections.toRefundView(current.refund).stateLabel, REFUND_STATE_LABELS.approved);
  assert.equal(REFUND_STATE_LABELS.approved, "Refund approved · not yet returned to you");
  await assert.rejects(corrections.approveRefund(s.f.ctx, s.finance, await c(), 400, NOW + 1), isAppError("INVALID_STATE"), "approved once");

  const completed = await completeCorrection(s, correctionId, { at: NOW + 2 });
  assert.equal(completed.refund.state, "approved", "walking the line never refunds");

  const first = await corrections.confirmRefund(s.f.ctx, s.finance, await c(), { amountUsd: 400, reference: "sq_r1" }, NOW + 10);
  assert.deepEqual(first, { duplicate: false });
  current = await c();
  assert.equal(current.refund.state, "refunded");
  assert.equal(current.refund.reference, "sq_r1");
  assert.equal(current.refund.confirmedAt, NOW + 10);
  assert.ok(s.messagesOf(caseId).some((m) => /^Refunded: \$400\.00 on .* reference sq_r1\./.test(m)));

  const again = await corrections.confirmRefund(s.f.ctx, s.finance, await c(), { amountUsd: 400, reference: "sq_r1" }, NOW + 11);
  assert.deepEqual(again, { duplicate: true });
  assert.equal((await c()).refund.confirmedAt, NOW + 10, "the duplicate callback changed nothing");
  await assert.rejects(corrections.confirmRefund(s.f.ctx, s.finance, await c(), { amountUsd: 400, reference: "sq_other" }, NOW + 12), isAppError("INVALID_STATE"));
  assert.equal(s.audits("correction.confirmRefund").length, 1);
  assert.equal(s.audits("correction.approveRefund").length, 1);
});

// ------------------------------------------------------------------------------------------------
// Escalation (C24, O07, scenario 12)
// ------------------------------------------------------------------------------------------------

test("a still-an-issue reassessment escalates with a high-priority case; a second one on the same suit is named as repeated and a new request starts escalated", async () => {
  const s = await setup();
  const { correctionId, caseId } = await s.request();
  const c = () => s.correction(correctionId);
  await completeCorrection(s, correctionId);
  await assert.rejects(corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "still_issue", note: " " }, NOW + 10), isAppError("INVALID_INPUT"), "say what is still wrong");
  await corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "still_issue", note: "The sleeve is now too short." }, NOW + 10);
  let current = await c();
  assert.equal(current.status, "escalated");
  assert.equal(current.escalatedAt, NOW + 10);
  let caseDoc = await s.f.ctx.db.get(caseId);
  assert.equal(caseDoc.priority, "high");
  assert.equal(caseDoc.escalatedAt, NOW + 10);
  assert.equal(caseDoc.status, "awaiting_staff");
  assert.equal((await s.order()).status, "correction_open");
  assert.deepEqual(s.audits("correction.autoEscalate").map((a) => a.meta.reason), ["still_issue"]);

  // The house decides again: a second remedy round from the escalated correction.
  await corrections.triage(s.f.ctx, s.operations, await c(), "A senior fitter will take this personally.", NOW + 11);
  await corrections.proposeRemedy(s.f.ctx, s.operations, await c(), { kind: "remake", coverage: "included", logistics: "A new jacket is cut from the same cloth." }, NOW + 12);
  await corrections.acceptRemedy(s.f.ctx, s.actor, await c(), NOW + 13);
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "in_progress", undefined, NOW + 14);
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "completed", undefined, NOW + 15);
  await corrections.reassess(s.f.ctx, s.actor, await c(), { outcome: "still_issue", note: "Still pulling at the shoulder." }, NOW + 16);
  assert.deepEqual(s.audits("correction.autoEscalate").map((a) => a.meta.reason), ["still_issue", "still_issue"], "the same correction counts once");
  assert.ok(s.messagesOf(caseId).some((m) => /escalated to a senior member of the house/.test(m)));

  // A new request on the same suit, after an unsuccessful correction, goes straight to a senior decision.
  const second = await s.request({ region: "jacket_shoulders", description: "Shoulders still pull.", submissionKey: "corr-2" }, NOW + 20);
  const repeated = await s.correction(second.correctionId);
  assert.equal(repeated.status, "escalated");
  assert.equal(repeated.escalatedAt, NOW + 20);
  assert.equal((await s.f.ctx.db.get(second.caseId)).priority, "high");
  assert.equal(s.audits("correction.autoEscalate").at(-1).meta.reason, "repeated_still_issue");
  assert.ok(s.messagesOf(second.caseId).some((m) => /You will not be asked to describe it again/.test(m)));
});

test("staff escalate any open correction once; a closed one cannot be escalated", async () => {
  const s = await setup();
  const { correctionId, caseId } = await s.request();
  const c = () => s.correction(correctionId);
  await assert.rejects(corrections.escalate(s.f.ctx, s.operations, await c(), "", NOW), isAppError("INVALID_INPUT"));
  await corrections.escalate(s.f.ctx, s.operations, await c(), "The courier lost the return label twice.", NOW + 1);
  let current = await c();
  assert.equal(current.status, "escalated");
  const caseDoc = await s.f.ctx.db.get(caseId);
  assert.equal(caseDoc.priority, "high");
  assert.equal(caseDoc.ownerStaffId, s.operations._id, "the case has an owner");
  await corrections.escalate(s.f.ctx, s.operations, await c(), "Still nothing from the carrier.", NOW + 2);
  assert.equal((await c()).escalatedAt, NOW + 1, "escalating twice only adds the note");
  await corrections.setStatus(s.f.ctx, s.operations, await c(), "closed", "Refunded the courier fee and closed with the client's agreement.", NOW + 3);
  assert.equal((await c()).status, "closed");
  await assert.rejects(corrections.escalate(s.f.ctx, s.operations, await c(), "x", NOW + 4), isAppError("INVALID_STATE"));
  assert.equal((await s.order()).status, "fit_review");
});

test("the order summary lists corrections newest first and the staff row names the client by first name", async () => {
  const s = await setup();
  const a = await s.request({}, NOW);
  await corrections.triage(s.f.ctx, s.operations, await s.correction(a.correctionId), "ok", NOW + 1);
  await corrections.setStatus(s.f.ctx, s.operations, await s.correction(a.correctionId), "declined", "Within tolerance.", NOW + 2);
  const b = await s.request({ submissionKey: "corr-2" }, NOW + 3);
  const list = await corrections.correctionsForOrder(s.f.ctx, s.orderId);
  assert.deepEqual(list.map((c) => c._id), [b.correctionId, a.correctionId]);
  const row = await corrections.toStaffRow(s.f.ctx, await s.correction(b.correctionId));
  assert.equal(row.clientName, "Nia");
  assert.equal(row.ownerKind, "account");
  const open = await corrections.listByStatus(s.f.ctx);
  assert.deepEqual(open.map((c) => c._id), [b.correctionId], "the queue shows open corrections only");
  assert.deepEqual((await corrections.listByStatus(s.f.ctx, "declined")).map((c) => c._id), [a.correctionId]);
});
