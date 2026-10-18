import assert from "node:assert/strict";
import test from "node:test";
import { getFunctionName } from "convex/server";
import { fakeCtx, GUEST_KEY, guestActor, isAppError, OTHER_GUEST_KEY, otherGuestActor, strangerActor } from "./atelier-fake-ctx.mjs";

const privacy = await import("../convex/model/atelier/privacy.ts");
const { DEFAULT_SPEC, specHash } = await import("../convex/shared/atelier/spec.ts");
const { PRIVACY_KINDS, PRIVACY_STATUS_LABELS } = await import("../convex/shared/atelier/enums.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;

/** The shared fake plus a file store, a recording scheduler, `db.system` and Convex's one-argument `db.delete`. */
function harness() {
  const f = fakeCtx();
  const files = new Map();
  const deletedFiles = [];
  const deletedRows = [];
  const scheduled = [];
  f.ctx.db.system = { get: async (_table, id) => files.get(id) ?? null };
  f.ctx.db.delete = async (id) => {
    for (const list of f.tables.values()) {
      const index = list.findIndex((row) => row._id === id);
      if (index >= 0) {
        list.splice(index, 1);
        deletedRows.push(id);
        return;
      }
    }
    throw new Error(`delete of unknown row ${id}`);
  };
  f.ctx.storage = {
    getUrl: async (id) => (files.has(id) ? `https://files.test/signed/${files.get(id).token}` : null),
    delete: async (id) => {
      files.delete(id);
      deletedFiles.push(id);
    },
  };
  f.ctx.scheduler = { runAfter: async (delay, ref, args) => scheduled.push({ delay, name: getFunctionName(ref), args }) };
  let fileSeq = 0;
  const addFile = (id = `_storage|f${(fileSeq += 1)}`) => {
    files.set(id, { _id: id, _creationTime: 1, size: 1000, contentType: "image/jpeg", token: id.replace(/\W/g, "") });
    return id;
  };
  /** Tables written (inserted, patched or deleted) since `mark`. */
  const mark = () => ({ inserts: f.log.inserts.length, patches: f.log.patches.length, deletes: deletedRows.length });
  const touchedSince = (m) =>
    new Set([
      ...f.log.inserts.slice(m.inserts).map(([table]) => table),
      ...f.log.patches.slice(m.patches).map(([id]) => id.split("|")[0]),
      ...deletedRows.slice(m.deletes).map((id) => id.split("|")[0]),
    ]);
  return { f, files, deletedFiles, deletedRows, scheduled, addFile, mark, touchedSince };
}

/** A client with a design that nothing refers to, one behind a commission and one behind an open request; a photo, previews and a share. */
async function seedOwner(h, owner, actor, { label = "a" } = {}) {
  const { f } = h;
  const spec = { ...DEFAULT_SPEC, clothCode: `C-${label}` };
  const draftRow = (name, extra = {}) => ({
    ...owner,
    name,
    spec,
    shortlist: [],
    stage: "review",
    completedSteps: [],
    catalogueVersion: 1,
    revision: 1,
    status: "draft",
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 10 * DAY,
    lastSavedAt: NOW - 10 * DAY,
    ...extra,
  });
  const photoFile = h.addFile(`_storage|photo-${label}`);
  const photoId = await f.ctx.db.insert("atelierPersonPhotos", {
    ...owner,
    storageId: photoFile,
    mimeType: "image/jpeg",
    width: 1200,
    height: 2000,
    consentVersion: "2026-10-18.1",
    consentAt: NOW - 5 * DAY,
    providerDisclosureVersion: "openai-gpt-image-2.2026-10",
    status: "active",
    expiresAt: NOW + 25 * DAY,
    validation: { ok: true, reasons: [] },
    createdAt: NOW - 5 * DAY,
  });
  const freeDraft = await f.ctx.db.insert("atelierDrafts", draftRow(`Free design ${label}`, { personPhotoId: photoId }));
  const revisionId = await f.ctx.db.insert("atelierRevisions", { draftId: freeDraft, revision: 1, spec, specHash: specHash(spec), catalogueVersion: 1, reason: "preview", createdAt: NOW - 5 * DAY });
  const shareId = await f.ctx.db.insert("atelierShares", { draftId: freeDraft, token: `tok-${label}`, ...owner, audience: "Family", expiresAt: NOW + 7 * DAY, createdAt: NOW - 4 * DAY });
  const resultFile = h.addFile(`_storage|result-${label}`);
  const jobRow = (extra) => ({
    ...owner,
    draftId: freeDraft,
    personPhotoId: photoId,
    revisionId,
    specHash: specHash(spec),
    specLabel: "Two piece",
    attempt: 1,
    quality: "pending",
    createdAt: NOW - 4 * DAY,
    ...extra,
  });
  const doneJob = await f.ctx.db.insert("atelierPreviewJobs", jobRow({ idempotencyKey: `done-${label}`, status: "done", resultStorageId: resultFile, completedAt: NOW - 4 * DAY }));
  const queuedJob = await f.ctx.db.insert("atelierPreviewJobs", jobRow({ idempotencyKey: `queued-${label}`, status: "queued" }));

  const orderedDraft = await f.ctx.db.insert("atelierDrafts", draftRow(`Commissioned design ${label}`, { status: "submitted" }));
  const orderCase = await f.ctx.db.insert("atelierCases", {
    kind: "quote",
    ...owner,
    draftId: orderedDraft,
    contact: { name: "Client", email: `${label}@example.test`, channel: "email" },
    submissionKey: `quote-${label}`,
    status: "completed",
    priority: "normal",
    lastActivityAt: NOW - 20 * DAY,
    closedAt: NOW - 20 * DAY,
    createdAt: NOW - 30 * DAY,
  });
  const orderId = await f.ctx.db.insert("atelierOrders", {
    ...owner,
    caseId: orderCase,
    quoteId: "atelierQuotes|1",
    revisionId: "atelierRevisions|1",
    draftId: orderedDraft,
    spec,
    specHash: specHash(spec),
    status: "making",
    payment: { state: "confirmed", amountUsd: 2400, confirmedAt: NOW - 19 * DAY },
    releasedAt: NOW - 18 * DAY,
    createdAt: NOW - 20 * DAY,
    updatedAt: NOW - 18 * DAY,
  });
  await f.ctx.db.insert("atelierOrderMilestones", { orderId, kind: "released", label: "Released", at: NOW - 18 * DAY, source: "staff", estimated: false });

  const requestedDraft = await f.ctx.db.insert("atelierDrafts", draftRow(`Requested design ${label}`, { status: "submitted" }));
  const openCase = await f.ctx.db.insert("atelierCases", {
    kind: "design_review",
    ...owner,
    draftId: requestedDraft,
    contact: { name: "Client", email: `${label}@example.test`, channel: "email" },
    submissionKey: `review-${label}`,
    status: "assigned",
    priority: "normal",
    lastActivityAt: NOW - DAY,
    createdAt: NOW - 2 * DAY,
  });
  void actor;
  return { photoId, photoFile, freeDraft, revisionId, shareId, doneJob, queuedJob, resultFile, orderedDraft, orderCase, orderId, requestedDraft, openCase };
}

async function setup() {
  const h = harness();
  const insertUser = async (doc) => h.f.ctx.db.get(await h.f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc }));
  const client = await insertUser({ name: "Nia Okafor", email: "nia@example.test" });
  const privacyStaff = await insertUser({ name: "Zuri Adeyemi", staffRoles: ["privacy"] });
  const actor = { user: client, guestKey: null };
  const owner = { userId: client._id };
  const mine = await seedOwner(h, owner, actor, { label: "a" });
  const theirs = await seedOwner(h, { guestKey: OTHER_GUEST_KEY }, otherGuestActor, { label: "b" });
  const after = h.mark();
  return { h, client, privacyStaff, actor, owner, mine, theirs, after };
}

/** Plays the scheduler: runs each scheduled advance, and plays the export action by hand (query, store a file, record). */
async function drain(h, now = NOW) {
  const trail = [];
  let tick = 0;
  while (h.scheduled.length > 0) {
    const job = h.scheduled.shift();
    tick += 1;
    if (tick > 60) throw new Error("the step runner did not stop scheduling itself");
    if (job.name === "atelier/privacy:advance") {
      const result = await privacy.advance(h.f.ctx, job.args.requestId, {}, now + tick);
      trail.push([result.ran, result.status]);
    } else if (job.name === "atelier/privacy:writeExport") {
      const payload = await privacy.exportPayload(h.f.ctx, job.args.requestId, now + tick);
      assert.ok(payload, "the export payload exists while the request does");
      const file = h.addFile();
      await privacy.recordExport(h.f.ctx, job.args.requestId, file, now + tick);
      trail.push(["write_export", (await h.f.ctx.db.get(job.args.requestId)).status]);
    } else {
      throw new Error(`unexpected scheduled function ${job.name}`);
    }
  }
  return trail;
}

const request = (s, kind, actor = s.actor, at = NOW) => privacy.requestPrivacy(s.h.f.ctx, actor, kind, at);
const row = (s, id) => s.h.f.ctx.db.get(id);
const caseMessages = (s, caseDoc) => s.h.f.rowsOf("atelierCaseMessages").filter((m) => m.caseId === caseDoc._id).map((m) => m.body);

// ------------------------------------------------------------------------------------------------
// The plan
// ------------------------------------------------------------------------------------------------

test("each kind plans the contract's steps, pending, in order; closing an account plans all of them plus revoking access", () => {
  const keys = (kind) => privacy.planSteps(kind).map((step) => step.key);
  assert.deepEqual(keys("export"), ["collect_designs", "collect_cases_orders", "write_export"]);
  assert.deepEqual(keys("delete_photos"), ["revoke_preview_links", "cancel_preview_jobs", "delete_photos", "notify_provider"]);
  assert.deepEqual(keys("delete_designs"), ["revoke_shares", "archive_drafts", "delete_unreferenced_drafts"]);
  assert.deepEqual(keys("close_account"), [...keys("export"), ...keys("delete_photos"), ...keys("delete_designs"), "revoke_access"]);
  for (const kind of PRIVACY_KINDS) {
    for (const step of privacy.planSteps(kind)) {
      assert.equal(step.status, "pending");
      assert.ok(step.label.length > 3 && step.label === privacy.PRIVACY_STEP_LABELS[step.key]);
    }
  }
});

test("the status is read from the steps: nothing is called deleted, revoked or completed before its step is", () => {
  const steps = (states) => privacy.planSteps("close_account").map((step) => ({ ...step, status: states[step.key] ?? "pending" }));
  assert.equal(privacy.deriveStatus(steps({}), "requested"), "requested");
  assert.equal(privacy.deriveStatus(steps({ collect_designs: "done", write_export: "done" }), "requested"), "requested");
  assert.equal(privacy.deriveStatus(steps({ revoke_preview_links: "done" }), "requested"), "access_revoked");
  assert.equal(privacy.deriveStatus(steps({ revoke_preview_links: "done", delete_photos: "done" }), "access_revoked"), "primary_deleted");
  assert.equal(privacy.deriveStatus(steps({ revoke_preview_links: "done", delete_photos: "failed" }), "access_revoked"), "access_revoked", "a failed step holds the status");
  const allBut = Object.fromEntries(privacy.planSteps("close_account").map((step) => [step.key, "done"]));
  assert.equal(privacy.deriveStatus(steps({ ...allBut, notify_provider: "pending" }), "primary_deleted"), "downstream_pending");
  assert.equal(privacy.deriveStatus(steps({ ...allBut, notify_provider: "failed" }), "primary_deleted"), "downstream_pending", "still waiting on the provider");
  assert.equal(privacy.deriveStatus(steps({ ...allBut, notify_provider: "exception" }), "downstream_pending"), "completed");
  assert.equal(privacy.deriveStatus(steps(allBut), "rejected"), "rejected", "a rejection stands");
});

// ------------------------------------------------------------------------------------------------
// The request (C27)
// ------------------------------------------------------------------------------------------------

test("a request records its plan, discloses what the house keeps, opens a privacy case and schedules the first step", async () => {
  const s = await setup();
  const { requestId, duplicate } = await request(s, "delete_designs");
  assert.equal(duplicate, false);
  const r = await row(s, requestId);
  assert.equal(r.status, "requested");
  assert.equal(r.userId, s.client._id);
  assert.deepEqual(r.steps.map((step) => step.status), ["pending", "pending", "pending"]);
  assert.ok(r.exceptions.some((line) => /keeps its specification and fit profile/.test(line)), r.exceptions.join(" | "));
  assert.ok(r.exceptions.some((line) => /stay with that request's record/.test(line)), r.exceptions.join(" | "));
  assert.ok(!r.exceptions.includes(privacy.RECORDS_EXCEPTION), "the records line belongs to account closure");
  const caseDoc = await privacy.caseFor(s.h.f.ctx, r);
  assert.equal(caseDoc.kind, "privacy");
  assert.equal(caseDoc.contact.email, "nia@example.test");
  assert.equal(caseDoc.contact.name, "Nia");
  assert.ok(caseMessages(s, caseDoc)[0].includes("nothing is called deleted before it is"));
  assert.deepEqual(s.h.scheduled.map((job) => [job.name, job.args.requestId]), [["atelier/privacy:advance", requestId]]);
  assert.equal(s.h.f.rowsOf("atelierAuditLog").filter((a) => a.action === "privacy.request").length, 1);
  const view = await privacy.toRequestView(s.h.f.ctx, r);
  assert.equal(view.statusLabel, PRIVACY_STATUS_LABELS.requested);
  assert.equal(view.caseId, caseDoc._id);
  assert.equal(view.exportUrl, null);
});

test("an export discloses nothing to keep, a closure also keeps the records, and a guest's contact is simply 'guest'", async () => {
  const s = await setup();
  assert.deepEqual((await row(s, (await request(s, "export")).requestId)).exceptions, []);
  const closure = await row(s, (await request(s, "close_account")).requestId);
  assert.ok(closure.exceptions.includes(privacy.RECORDS_EXCEPTION));
  assert.equal(closure.steps.length, 11);
  const guest = await request(s, "delete_photos", guestActor);
  const guestRow = await row(s, guest.requestId);
  assert.equal(guestRow.guestKey, GUEST_KEY);
  assert.equal(guestRow.userId, undefined);
  const guestCase = await privacy.caseFor(s.h.f.ctx, guestRow);
  assert.equal(guestCase.contact.email, "guest");
  assert.equal(guestCase.contact.name, "Guest");
});

test("one open request per kind per owner; a guest has no account to close; a stranger never sees the request", async () => {
  const s = await setup();
  const first = await request(s, "export");
  const second = await request(s, "export", s.actor, NOW + 1);
  assert.deepEqual(second, { requestId: first.requestId, duplicate: true });
  const other = await request(s, "delete_photos");
  assert.notEqual(other.requestId, first.requestId, "a different kind is a different request");
  assert.equal(s.h.f.rowsOf("atelierPrivacyRequests").length, 2);
  await assert.rejects(request(s, "close_account", guestActor), isAppError("INVALID_INPUT"));
  await assert.rejects(privacy.requireOwnedRequest(s.h.f.ctx, first.requestId, strangerActor), isAppError("NOT_FOUND"));
  await assert.rejects(privacy.requireOwnedRequest(s.h.f.ctx, first.requestId, otherGuestActor), isAppError("NOT_FOUND"));
  assert.ok(await privacy.requireOwnedRequest(s.h.f.ctx, first.requestId, s.actor));
  assert.deepEqual((await privacy.listMine(s.h.f.ctx, s.actor)).map((r) => r._id).sort(), [first.requestId, other.requestId].sort());
  assert.deepEqual(await privacy.listMine(s.h.f.ctx, otherGuestActor), []);
});

// ------------------------------------------------------------------------------------------------
// Removing photographs (C11, scenario 4) never touches a commission (C27 acceptance)
// ------------------------------------------------------------------------------------------------

test("removing photographs revokes result links, cancels the queue, deletes the files, waits on the provider and completes with that exception; the order is untouched", async () => {
  const s = await setup();
  const { requestId } = await request(s, "delete_photos");
  const trail = await drain(s.h);
  assert.deepEqual(trail, [
    ["revoke_preview_links", "access_revoked"],
    ["cancel_preview_jobs", "access_revoked"],
    ["delete_photos", "downstream_pending"],
    ["notify_provider", "completed"],
  ]);
  const r = await row(s, requestId);
  assert.deepEqual(r.steps.map((step) => step.status), ["done", "done", "done", "exception"]);
  assert.ok(r.exceptions.includes(privacy.PROVIDER_RETENTION_EXCEPTION));
  assert.equal(r.completedAt, NOW + 4);
  assert.equal(privacy.statusLabelFor(r), "Completed with exceptions");

  const photo = await row(s, s.mine.photoId);
  assert.equal(photo.status, "deleted");
  assert.ok(s.h.deletedFiles.includes(s.mine.photoFile));
  assert.ok(s.h.deletedFiles.includes(s.mine.resultFile), "the done result's file is gone");
  assert.equal((await row(s, s.mine.doneJob)).status, "expired");
  assert.equal((await row(s, s.mine.doneJob)).resultStorageId, undefined);
  assert.equal((await row(s, s.mine.queuedJob)).status, "cancelled");
  assert.equal((await row(s, s.mine.freeDraft)).personPhotoId, undefined, "the draft no longer points at a deleted photograph");
  assert.equal((await row(s, s.mine.freeDraft)).status, "draft", "designs are not this request's business");

  assert.equal((await row(s, s.theirs.photoId)).status, "active", "another client's photograph is untouched");
  assert.equal((await row(s, s.theirs.doneJob)).status, "done");
  assert.ok(!s.h.deletedFiles.includes(s.theirs.photoFile));

  const touched = s.h.touchedSince(s.after);
  assert.ok(!touched.has("atelierOrders"), [...touched].join(","));
  assert.ok(!touched.has("atelierOrderMilestones"));
  assert.equal((await row(s, s.mine.orderId)).status, "making", "removing a photo does not cancel an order");
  const caseDoc = await privacy.caseFor(s.h.f.ctx, r);
  assert.equal(caseDoc.status, "completed");
  assert.ok(caseMessages(s, caseDoc).some((m) => /^Completed with exceptions\./.test(m)));
  const stepAudits = s.h.f.rowsOf("atelierAuditLog").filter((a) => a.action === "privacy.step" && a.targetId === requestId);
  assert.equal(stepAudits.length, 4);
  assert.ok(stepAudits.every((a) => a.actorKind === "system"));
});

test("a client who never added a photograph has nothing to notify the provider about and completes cleanly", async () => {
  const s = await setup();
  for (const photo of s.h.f.rowsOf("atelierPersonPhotos")) await s.h.f.ctx.db.delete(photo._id);
  const { requestId } = await request(s, "delete_photos");
  await drain(s.h);
  const r = await row(s, requestId);
  assert.equal(r.status, "completed");
  assert.deepEqual(r.exceptions, []);
  assert.equal(r.steps.at(-1).status, "done");
  assert.equal(privacy.statusLabelFor(r), PRIVACY_STATUS_LABELS.completed);
});

// ------------------------------------------------------------------------------------------------
// Deleting designs
// ------------------------------------------------------------------------------------------------

test("deleting designs revokes links, archives and deletes the free design with its snapshots and previews, keeps the ones a commission or a request refers to, and never touches an order", async () => {
  const s = await setup();
  const { requestId } = await request(s, "delete_designs");
  const trail = await drain(s.h);
  assert.deepEqual(trail, [
    ["revoke_shares", "access_revoked"],
    ["archive_drafts", "access_revoked"],
    ["delete_unreferenced_drafts", "completed"],
  ]);
  assert.equal(await row(s, s.mine.freeDraft), null, "the free design is gone");
  assert.equal(await row(s, s.mine.revisionId), null, "with its snapshots");
  assert.equal(await row(s, s.mine.shareId), null, "and its links");
  assert.equal(await row(s, s.mine.doneJob), null, "and its previews");
  assert.ok(s.h.deletedFiles.includes(s.mine.resultFile));
  assert.equal((await row(s, s.mine.orderedDraft)).status, "submitted", "the commissioned design stays as it is");
  assert.equal((await row(s, s.mine.requestedDraft)).status, "submitted", "the design under an open request stays as it is");
  assert.equal((await row(s, s.theirs.freeDraft)).name, "Free design b", "another client's design is untouched");
  assert.equal((await row(s, s.theirs.shareId)).revokedAt, undefined);
  const r = await row(s, requestId);
  assert.equal(privacy.statusLabelFor(r), "Completed with exceptions");
  assert.ok(r.exceptions.some((line) => /2 designs stay with a commission or a request/.test(line)), r.exceptions.join(" | "));
  const touched = s.h.touchedSince(s.after);
  assert.ok(!touched.has("atelierOrders") && !touched.has("atelierOrderMilestones") && !touched.has("atelierPersonPhotos"), [...touched].join(","));
  assert.equal((await row(s, s.mine.orderId)).status, "making");
});

test("the share-revocation step is idempotent and audited; a share already revoked keeps its time", async () => {
  const s = await setup();
  await s.h.f.ctx.db.patch(s.mine.shareId, { revokedAt: NOW - DAY });
  await s.h.f.ctx.db.insert("atelierShares", { draftId: s.mine.freeDraft, token: "tok-2", ...s.owner, audience: "Best man", expiresAt: NOW + DAY, createdAt: NOW - DAY });
  const { requestId } = await request(s, "delete_designs");
  const result = await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 1);
  assert.deepEqual(result, { ran: "revoke_shares", status: "access_revoked", scheduled: true });
  assert.equal((await row(s, s.mine.shareId)).revokedAt, NOW - DAY);
  assert.equal((await row(s, requestId)).steps[0].note, "1 shared link revoked");
});

// ------------------------------------------------------------------------------------------------
// Export
// ------------------------------------------------------------------------------------------------

test("an export counts the owner's records, hands the file to the action, and completes when the file is recorded; the payload holds nobody else's data", async () => {
  const s = await setup();
  const { requestId } = await request(s, "export");
  await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 1);
  await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 2);
  let r = await row(s, requestId);
  assert.deepEqual(r.steps.slice(0, 2).map((step) => [step.status, step.note]), [["done", "3 designs"], ["done", "3 requests · 1 commission"]], "the privacy request's own case counts");
  s.h.scheduled.length = 0;
  const handoff = await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 3);
  assert.deepEqual(handoff, { ran: "write_export", status: "requested", scheduled: true });
  assert.deepEqual(s.h.scheduled.map((job) => job.name), ["atelier/privacy:writeExport"]);
  r = await row(s, requestId);
  assert.equal(r.steps[2].status, "pending");
  assert.equal(r.steps[2].note, "Writing your export");
  assert.equal(r.status, "requested");
  const idle = await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 4);
  assert.deepEqual(idle, { ran: null, status: "requested", scheduled: false }, "an export in flight is not started twice");

  const payload = await privacy.exportPayload(s.h.f.ctx, requestId, NOW + 5);
  assert.equal(payload.format, "nyoni-atelier-export/1");
  assert.deepEqual(payload.account, { name: "Nia Okafor", email: "nia@example.test" });
  assert.deepEqual(payload.designs.map((d) => d.name).sort(), ["Commissioned design a", "Free design a", "Requested design a"]);
  assert.ok(payload.designs.every((d) => d.lines.length > 5 && d.spec.clothCode === "C-a"));
  assert.deepEqual(payload.commissions.map((o) => [o.status, o.milestones.length, o.payment.stateLabel]), [["making", 1, "Payment confirmed"]]);
  assert.equal(payload.requests.length, 3);
  assert.equal(JSON.stringify(payload).includes("design b"), false, "another client's design is not in the export");
  assert.equal(JSON.stringify(payload).includes(OTHER_GUEST_KEY), false);

  const file = s.h.addFile("_storage|export-1");
  assert.equal(await privacy.recordExport(s.h.f.ctx, requestId, file, NOW + 6), true);
  r = await row(s, requestId);
  assert.equal(r.status, "completed");
  assert.equal(r.exportStorageId, file);
  assert.equal(r.steps[2].status, "done");
  const view = await privacy.toRequestView(s.h.f.ctx, r);
  assert.match(view.exportUrl, /^https:\/\/files\.test\/signed\//);
  assert.equal(view.completedWithExceptions, false);

  const late = s.h.addFile("_storage|export-2");
  assert.equal(await privacy.recordExport(s.h.f.ctx, requestId, late, NOW + 7), false, "a late or repeated report is refused");
  assert.ok(s.h.deletedFiles.includes(late), "and its file is deleted rather than kept as an orphan");
  assert.equal((await row(s, requestId)).exportStorageId, file);
  const touched = s.h.touchedSince(s.after);
  assert.ok(!touched.has("atelierOrders") && !touched.has("atelierDrafts") && !touched.has("atelierPersonPhotos"), "an export changes nothing");
});

test("closing an account runs every step, ends completed with the disclosed exceptions and never touches a commission", async () => {
  const s = await setup();
  const { requestId } = await request(s, "close_account");
  const trail = await drain(s.h);
  assert.equal(trail.length, 12, "eleven steps, with the export handed off and then recorded");
  assert.equal(trail.at(-1)[1], "completed");
  const r = await row(s, requestId);
  assert.deepEqual(
    r.steps.filter((step) => step.status === "exception").map((step) => step.key),
    ["notify_provider", "delete_unreferenced_drafts", "revoke_access"],
  );
  assert.ok(r.exceptions.includes(privacy.ACCESS_REVOCATION_EXCEPTION));
  assert.ok(r.exceptions.includes(privacy.PROVIDER_RETENTION_EXCEPTION));
  assert.ok(r.exceptions.includes(privacy.RECORDS_EXCEPTION));
  assert.ok(r.exportStorageId, "the export was written first");
  assert.equal(await row(s, s.mine.freeDraft), null);
  assert.equal((await row(s, s.mine.photoId)).status, "deleted");
  const touched = s.h.touchedSince(s.after);
  assert.ok(!touched.has("atelierOrders") && !touched.has("atelierOrderMilestones"), [...touched].join(","));
  assert.equal((await row(s, s.mine.orderId)).status, "making");
  assert.ok((await row(s, s.mine.orderedDraft)) !== null, "the commissioned design stays for the commission");
});

// ------------------------------------------------------------------------------------------------
// Failure, staff re-run, completion, rejection and the audit log (O08)
// ------------------------------------------------------------------------------------------------

test("a step that fails is recorded as failed and holds the status; automatic runs stop, a staff re-run picks it up", async () => {
  const s = await setup();
  const { requestId } = await request(s, "delete_photos");
  const realDelete = s.h.f.ctx.storage.delete;
  s.h.f.ctx.storage.delete = async () => {
    throw new Error("storage unavailable");
  };
  const trail = await drain(s.h);
  assert.deepEqual(trail, [["revoke_preview_links", "requested"]], "the first file deletion fails and nothing after it runs");
  let r = await row(s, requestId);
  assert.equal(r.status, "requested", "nothing was revoked, so nothing is called revoked");
  assert.deepEqual(r.steps.map((step) => step.status), ["failed", "pending", "pending", "pending"]);
  assert.equal(r.steps[0].note, "storage unavailable");
  assert.equal((await row(s, s.mine.doneJob)).status, "done", "the job is not marked expired while its file is still there");
  assert.equal((await privacy.toRequestView(s.h.f.ctx, r)).hasFailedStep, true);
  assert.deepEqual(await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 10), { ran: null, status: "requested", scheduled: false }, "no automatic retry loop");
  await assert.rejects(privacy.complete(s.h.f.ctx, s.privacyStaff, r, "Done.", NOW + 11), isAppError("INVALID_STATE"), "not complete while a step failed");
  assert.deepEqual((await privacy.queue(s.h.f.ctx)).map((q) => q._id), [requestId], "it waits in the staff queue");

  s.h.f.ctx.storage.delete = realDelete;
  const rerun = await privacy.advance(s.h.f.ctx, requestId, { manual: true, actor: s.privacyStaff }, NOW + 12);
  assert.deepEqual(rerun, { ran: "revoke_preview_links", status: "access_revoked", scheduled: true });
  const staffAudit = s.h.f.rowsOf("atelierAuditLog").filter((a) => a.action === "privacy.step" && a.actorUserId === s.privacyStaff._id);
  assert.equal(staffAudit.length, 1);
  assert.equal(staffAudit[0].actorKind, "staff");
  await drain(s.h, NOW + 12);
  r = await row(s, requestId);
  assert.equal(r.status, "completed");
  assert.equal((await row(s, s.mine.doneJob)).status, "expired");
  assert.deepEqual(await privacy.queue(s.h.f.ctx), []);
});

test("the export action's failure lands on the step for staff, and a stray failure report after success changes nothing", async () => {
  const s = await setup();
  const { requestId } = await request(s, "export");
  await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 1);
  await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 2);
  await privacy.advance(s.h.f.ctx, requestId, {}, NOW + 3);
  await privacy.markStepFailed(s.h.f.ctx, requestId, "write_export", "The export could not be written.", NOW + 4);
  let r = await row(s, requestId);
  assert.equal(r.steps[2].status, "failed");
  assert.equal(r.status, "requested");
  const rerun = await privacy.advance(s.h.f.ctx, requestId, { manual: true, actor: s.privacyStaff }, NOW + 5);
  assert.equal(rerun.ran, "write_export");
  await privacy.recordExport(s.h.f.ctx, requestId, s.h.addFile(), NOW + 6);
  await privacy.markStepFailed(s.h.f.ctx, requestId, "write_export", "late", NOW + 7);
  r = await row(s, requestId);
  assert.equal(r.steps[2].status, "done");
  assert.equal(r.status, "completed");
});

test("staff complete only a request whose steps have all run, with a note on the case; a rejection is documented and final", async () => {
  const s = await setup();
  const { requestId } = await request(s, "delete_photos");
  let r = await row(s, requestId);
  await assert.rejects(privacy.complete(s.h.f.ctx, s.privacyStaff, r, "Done.", NOW + 1), isAppError("INVALID_STATE"));
  await drain(s.h);
  r = await row(s, requestId);
  await assert.rejects(privacy.complete(s.h.f.ctx, s.privacyStaff, r, "  ", NOW + 20), isAppError("INVALID_INPUT"));
  await privacy.complete(s.h.f.ctx, s.privacyStaff, r, "Provider notice filed under ticket OAI-4411.", NOW + 20);
  r = await row(s, requestId);
  assert.equal(r.handledByStaffId, s.privacyStaff._id);
  assert.equal(r.status, "completed");
  assert.equal(r.completedAt, NOW + 4, "the completion time is when the steps finished");
  const caseDoc = await privacy.caseFor(s.h.f.ctx, r);
  assert.ok(caseMessages(s, caseDoc).includes("Provider notice filed under ticket OAI-4411."));
  await assert.rejects(privacy.reject(s.h.f.ctx, s.privacyStaff, r, "No.", NOW + 21), isAppError("INVALID_STATE"), "completed is not rejected");

  const other = await request(s, "delete_designs", s.actor, NOW + 30);
  s.h.scheduled.length = 0;
  let o = await row(s, other.requestId);
  await assert.rejects(privacy.reject(s.h.f.ctx, s.privacyStaff, o, "", NOW + 31), isAppError("INVALID_INPUT"));
  await privacy.reject(s.h.f.ctx, s.privacyStaff, o, "Identity could not be verified for this request.", NOW + 31);
  o = await row(s, other.requestId);
  assert.equal(o.status, "rejected");
  assert.equal(o.completedAt, NOW + 31);
  assert.deepEqual(await privacy.advance(s.h.f.ctx, other.requestId, {}, NOW + 32), { ran: null, status: "rejected", scheduled: false }, "nothing runs after a rejection");
  assert.equal((await row(s, s.mine.freeDraft)).status, "draft");
  await assert.rejects(privacy.complete(s.h.f.ctx, s.privacyStaff, o, "x", NOW + 33), isAppError("INVALID_STATE"));
  const rejectedView = await privacy.toRequestView(s.h.f.ctx, o);
  assert.equal(rejectedView.statusLabel, PRIVACY_STATUS_LABELS.rejected);
});

test("the audit log reads by target or by time, newest first, bounded, with the actor named", async () => {
  const s = await setup();
  const { requestId } = await request(s, "delete_photos");
  await drain(s.h);
  const byTarget = await privacy.listAudit(s.h.f.ctx, { targetTable: "atelierPrivacyRequests", targetId: requestId });
  assert.ok(byTarget.length >= 5, String(byTarget.length));
  assert.ok(byTarget.every((rowView) => rowView.targetId === requestId));
  for (let i = 1; i < byTarget.length; i += 1) assert.ok(byTarget[i - 1].at >= byTarget[i].at, "newest first");
  const requestRow = byTarget.find((rowView) => rowView.action === "privacy.request");
  assert.equal(requestRow.actorName, "Nia Okafor");
  assert.equal(requestRow.actorKind, "client");
  const providerRow = byTarget.find((rowView) => rowView.action === "privacy.providerNotice");
  assert.equal(providerRow.meta.photos, 1);
  const byTable = await privacy.listAudit(s.h.f.ctx, { targetTable: "atelierCases", limit: 1 });
  assert.equal(byTable.length, 1);
  assert.equal(byTable[0].targetTable, "atelierCases");
  const recent = await privacy.listAudit(s.h.f.ctx, { limit: 1000 });
  assert.ok(recent.length <= privacy.AUDIT_LIMIT_MAX);
  assert.ok(recent.length >= byTarget.length);
  const staffRows = await Promise.all((await privacy.queue(s.h.f.ctx)).map((q) => privacy.toStaffRow(s.h.f.ctx, q)));
  assert.deepEqual(staffRows, [], "a completed request leaves the queue");
});
