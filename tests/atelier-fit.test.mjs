import assert from "node:assert/strict";
import test from "node:test";
import { fakeCtx, isAppError } from "./atelier-fake-ctx.mjs";

const fit = await import("../convex/model/atelier/fit.ts");
const { FIT_PROFILE_STATUS_LABELS } = await import("../convex/shared/atelier/enums.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const MINUTE = 60_000;

/** Every required field, every value inside its plausible range, in centimetres. */
const SHEET = {
  height: 180,
  chest: 100,
  waist: 86,
  seat: 100,
  shoulder: 46,
  sleeve: 64,
  jacketLength: 74,
  trouserWaist: 88,
  inseam: 82,
  thigh: 60,
};
const COMFORT = { jacket: "easy", trousers: "easy", movement: ["seated_long"] };

function submission(overrides = {}) {
  return { units: "cm", measurements: { ...SHEET }, comfort: COMFORT, uncertainFields: [], ...overrides };
}

function without(sheet, key) {
  return Object.fromEntries(Object.entries(sheet).filter(([field]) => field !== key));
}

async function setup() {
  const f = fakeCtx();
  const blobs = new Map();
  const deletedBlobs = [];
  f.ctx.db.system = { get: async (id) => blobs.get(id) ?? null };
  f.ctx.storage.getUrl = async (id) => (blobs.has(id) ? `https://files.test/${id}` : null);
  f.ctx.storage.delete = async (id) => {
    deletedBlobs.push(id);
    blobs.delete(id);
  };
  const insertUser = async (doc) => {
    const id = await f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc });
    return f.ctx.db.get(id);
  };
  const client = await insertUser({ name: "Nia Okafor" });
  const stranger = await insertUser({ name: "Someone Else" });
  const fitter = await insertUser({ name: "Marcus Bell", staffRoles: ["fitter"] });
  const addBlob = (id, meta = {}) => {
    blobs.set(id, { _id: id, _creationTime: 1, sha256: "x", size: 500_000, contentType: "image/jpeg", ...meta });
    return id;
  };
  return { f, blobs, deletedBlobs, client, stranger, fitter, addBlob };
}

const auditActions = (f) => f.rowsOf("atelierAuditLog").map((row) => row.action);

test("a submission is a new provisional version in centimetres; the next one supersedes a pending one", async () => {
  const { f, client } = await setup();
  const first = await fit.submitRemote(f.ctx, client, submission(), NOW);
  const v1 = await f.ctx.db.get(first);
  assert.equal(v1.userId, client._id);
  assert.equal(v1.version, 1);
  assert.equal(v1.status, "provisional");
  assert.equal(v1.provenance, "remote_guided");
  assert.equal(v1.units, "cm");
  assert.deepEqual(v1.measurements, SHEET);
  assert.deepEqual(v1.uncertainFields, []);
  assert.equal(v1.approvedValues, undefined, "nothing is approved by submitting");
  assert.equal(v1.createdAt, NOW);
  assert.ok(auditActions(f).includes("fit.submit"));

  const second = await fit.submitRemote(
    f.ctx,
    client,
    submission({ measurements: { ...SHEET, chest: 102 } }),
    NOW + MINUTE,
  );
  assert.notEqual(second, first);
  assert.equal((await f.ctx.db.get(second)).version, 2, "versions count up");
  assert.equal((await f.ctx.db.get(first)).status, "superseded", "a client has one version awaiting review");
  const current = await fit.latestProfileForUser(f.ctx, client._id);
  assert.equal(current._id, second);
  assert.equal((await fit.listProfilesForUser(f.ctx, client._id)).length, 2, "history is kept");
});

test("sending the same sheet twice while it awaits review is one submission", async () => {
  const { f, client } = await setup();
  const first = await fit.submitRemote(f.ctx, client, submission({ notes: "  Left arm a little longer. " }), NOW);
  const again = await fit.submitRemote(
    f.ctx,
    client,
    submission({ notes: "Left arm a little longer.", comfort: { ...COMFORT, movement: [...COMFORT.movement] } }),
    NOW + MINUTE,
  );
  assert.equal(again, first);
  assert.equal(f.rowsOf("atelierFitProfiles").length, 1);
  assert.equal((await f.ctx.db.get(first)).notes, "Left arm a little longer.", "notes are trimmed");
});

test("unknown keys, unknown uncertain fields and non-lengths are refused", async () => {
  const { f, client } = await setup();
  await assert.rejects(
    fit.submitRemote(f.ctx, client, submission({ measurements: { ...SHEET, hatSize: 58 } }), NOW),
    (error) => isAppError("INVALID_INPUT")(error) && error.data.details.unknownKeys[0] === "hatSize",
  );
  await assert.rejects(
    fit.submitRemote(f.ctx, client, submission({ uncertainFields: ["wingspan"] }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    fit.submitRemote(f.ctx, client, submission({ measurements: { ...SHEET, chest: 0 } }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    fit.submitRemote(f.ctx, client, submission({ measurements: { ...SHEET, chest: Number.NaN } }), NOW),
    isAppError("INVALID_INPUT"),
  );
  assert.equal(f.rowsOf("atelierFitProfiles").length, 0, "nothing was written");
});

test("a missing required field is refused unless the client marks it uncertain; then it is flagged, not approved", async () => {
  const { f, client } = await setup();
  const withoutThigh = without(SHEET, "thigh");
  await assert.rejects(
    fit.submitRemote(f.ctx, client, submission({ measurements: withoutThigh }), NOW),
    (error) => isAppError("INVALID_INPUT")(error) && error.data.details.missing.includes("thigh"),
  );
  const id = await fit.submitRemote(
    f.ctx,
    client,
    submission({ measurements: withoutThigh, uncertainFields: ["thigh"] }),
    NOW,
  );
  const view = await fit.toProfileView(f.ctx, await f.ctx.db.get(id));
  assert.equal(view.status, "provisional");
  assert.equal(view.statusLabel, FIT_PROFILE_STATUS_LABELS.provisional);
  assert.deepEqual(view.uncertainFields, ["thigh"]);
  assert.deepEqual(view.missingRequired, ["thigh"]);
  assert.equal(view.approvedValues, null);
  assert.equal(view.reviewer, null);
  assert.deepEqual(view.photos, []);
});

test("implausible values are flagged for the fitter, never rejected", async () => {
  const { f, client } = await setup();
  const id = await fit.submitRemote(
    f.ctx,
    client,
    submission({ measurements: { ...SHEET, height: 300, wrist: 10 } }),
    NOW,
  );
  const view = await fit.toProfileView(f.ctx, await f.ctx.db.get(id));
  assert.deepEqual(view.implausible.sort(), ["height", "wrist"]);
  assert.deepEqual(view.missingRequired, []);
  const [item] = await fit.listQueue(f.ctx);
  assert.deepEqual(item.implausible.sort(), ["height", "wrist"]);
});

test("another client's version reads as not found", async () => {
  const { f, client, stranger } = await setup();
  const id = await fit.submitRemote(f.ctx, client, submission(), NOW);
  await assert.rejects(fit.requireOwnedProfile(f.ctx, stranger, id), isAppError("NOT_FOUND"));
  await assert.rejects(
    fit.startRevision(f.ctx, stranger, await f.ctx.db.get(id), undefined, NOW),
    isAppError("NOT_FOUND"),
  );
  assert.equal(await fit.latestProfileForUser(f.ctx, stranger._id), null);
  assert.deepEqual(await fit.listProfilesForUser(f.ctx, stranger._id), []);
  assert.equal(f.rowsOf("atelierFitProfiles").length, 1);
});

test("a fitter approves with corrected values and a note; the version records reviewer and time", async () => {
  const { f, client, fitter } = await setup();
  const id = await fit.submitRemote(f.ctx, client, submission(), NOW);
  const corrected = { ...SHEET, sleeve: 65 };
  await assert.rejects(
    fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(id), corrected, "   ", NOW + MINUTE),
    (error) => isAppError("INVALID_INPUT")(error) && error.data.details.changed[0] === "sleeve",
  );
  const incomplete = without(SHEET, "inseam");
  await assert.rejects(
    fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(id), incomplete, "Missing inseam", NOW + MINUTE),
    (error) => isAppError("INVALID_INPUT")(error) && error.data.details.missing.includes("inseam"),
  );
  await assert.rejects(
    fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(id), { ...SHEET, hatSize: 58 }, "note", NOW + MINUTE),
    isAppError("INVALID_INPUT"),
  );
  assert.equal((await f.ctx.db.get(id)).status, "provisional", "a refused approval changes nothing");

  await fit.approveProfile(
    f.ctx,
    fitter,
    await f.ctx.db.get(id),
    corrected,
    "Sleeve read a touch short on the photograph.",
    NOW + MINUTE,
  );
  const approved = await f.ctx.db.get(id);
  assert.equal(approved.status, "approved");
  assert.deepEqual(approved.approvedValues, corrected);
  assert.deepEqual(approved.measurements, SHEET, "the client's submitted values are kept as submitted");
  assert.equal(approved.reviewerId, fitter._id);
  assert.equal(approved.reviewedAt, NOW + MINUTE);
  assert.equal(approved.reviewNote, "Sleeve read a touch short on the photograph.");
  assert.equal(approved.supersedesId, undefined, "nothing to supersede the first time");
  const view = await fit.toProfileView(f.ctx, approved);
  assert.equal(view.reviewer, "Marcus", "first name only");
  assert.equal(view.statusLabel, FIT_PROFILE_STATUS_LABELS.approved);
  assert.ok(auditActions(f).includes("fit.approve"));

  await assert.rejects(
    fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(id), corrected, "again", NOW + 2 * MINUTE),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    fit.requestClarification(f.ctx, fitter, await f.ctx.db.get(id), "Which shoe?", NOW + 2 * MINUTE),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    fit.registerFitPhoto(f.ctx, client, await f.ctx.db.get(id), "_storage|1", "front", NOW),
    isAppError("INVALID_STATE"),
  );
});

test("approving a revision supersedes the previous approved version and points back at it", async () => {
  const { f, client, fitter } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission(), NOW);
  await fit.approveProfile(
    f.ctx,
    fitter,
    await f.ctx.db.get(v1),
    { ...SHEET, chest: 101 },
    "Chest eased.",
    NOW + MINUTE,
  );

  const v2 = await fit.startRevision(
    f.ctx,
    client,
    await f.ctx.db.get(v1),
    { measurements: { ...SHEET, chest: 104, waist: 90 } },
    NOW + 2 * MINUTE,
  );
  const revision = await f.ctx.db.get(v2);
  assert.equal(revision.version, 2);
  assert.equal(revision.status, "provisional");
  assert.equal(revision.provenance, "remote_guided", "a re-measured sheet is measured at home");
  assert.deepEqual(revision.measurements, { ...SHEET, chest: 104, waist: 90 });
  assert.equal(revision.supersedesId, undefined, "supersedes is set by approval, not by revising");
  assert.equal(
    (await f.ctx.db.get(v1)).status,
    "approved",
    "the approved source stays approved while the revision waits",
  );
  assert.equal((await fit.latestProfileForUser(f.ctx, client._id))._id, v2, "the client lives with the newest version");
  const auditRow = f.rowsOf("atelierAuditLog").find((row) => row.action === "fit.revise");
  assert.equal(auditRow.meta.fromProfileId, v1);
  assert.deepEqual(auditRow.meta.changedMeasurements, ["chest", "waist"], "measured against the approved values");

  const review = await fit.toReviewView(f.ctx, revision);
  assert.equal(review.clientName, "Nia");
  assert.equal(review.previousApproved.profileId, v1);
  assert.deepEqual(review.previousApproved.values, { ...SHEET, chest: 101 });
  assert.deepEqual(
    review.history.map((entry) => entry.version),
    [2, 1],
  );
  assert.deepEqual(review.releasedOrderIds, []);

  await fit.approveProfile(f.ctx, fitter, revision, revision.measurements, "", NOW + 3 * MINUTE);
  const approvedV2 = await f.ctx.db.get(v2);
  const supersededV1 = await f.ctx.db.get(v1);
  assert.equal(approvedV2.status, "approved");
  assert.equal(approvedV2.supersedesId, v1);
  assert.equal(approvedV2.reviewNote, undefined, "no note needed when nothing changed");
  assert.equal(supersededV1.status, "superseded");
  assert.deepEqual(supersededV1.approvedValues, { ...SHEET, chest: 101 }, "history is never edited in place");
  assert.equal(supersededV1.reviewerId, fitter._id);
  assert.deepEqual(
    fit.newestFirst(await fit.listProfilesForUser(f.ctx, client._id)).map((profile) => profile.status),
    ["approved", "superseded"],
  );
  assert.equal(auditActions(f).filter((action) => action === "fit.supersede").length, 1);
});

test("a revision without new measurements keeps the source's values and provenance; comfort-only changes do not re-measure", async () => {
  const { f, client, fitter } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission({ posture: "forward", notes: "First go." }), NOW);
  const row = f.row(v1);
  row.provenance = "atelier";
  row.status = "approved";
  row.approvedValues = { ...SHEET, shoulder: 47 };
  row.reviewerId = fitter._id;
  row.reviewedAt = NOW;
  const v2 = await fit.startRevision(
    f.ctx,
    client,
    await f.ctx.db.get(v1),
    { comfort: { ...COMFORT, jacket: "close" }, posture: null, notes: null },
    NOW + MINUTE,
  );
  const revision = await f.ctx.db.get(v2);
  assert.deepEqual(revision.measurements, { ...SHEET, shoulder: 47 }, "prefilled from the approved values");
  assert.equal(revision.provenance, "atelier");
  assert.equal(revision.comfort.jacket, "close");
  assert.equal(revision.posture, undefined, "null clears");
  assert.equal(revision.notes, undefined);
  assert.equal(revision.units, "cm");
});

test("a question from the fitter waits for the client; the client's answer is a new version that supersedes it", async () => {
  const { f, client, fitter } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission(), NOW);
  await assert.rejects(
    fit.requestClarification(f.ctx, fitter, await f.ctx.db.get(v1), "   ", NOW + MINUTE),
    isAppError("INVALID_INPUT"),
  );
  await fit.requestClarification(
    f.ctx,
    fitter,
    await f.ctx.db.get(v1),
    "Was the inseam taken to the top of the shoe?",
    NOW + MINUTE,
  );
  const asked = await f.ctx.db.get(v1);
  assert.equal(asked.status, "needs_clarification");
  assert.equal(asked.clarification, "Was the inseam taken to the top of the shoe?");
  assert.equal(asked.reviewerId, fitter._id);
  assert.equal(asked.reviewedAt, undefined, "a question is not a review outcome");
  const view = await fit.toProfileView(f.ctx, asked);
  assert.equal(view.statusLabel, FIT_PROFILE_STATUS_LABELS.needs_clarification);
  assert.equal(view.reviewer, "Marcus");
  assert.ok(auditActions(f).includes("fit.request_clarification"));

  const queue = await fit.listQueue(f.ctx);
  assert.deepEqual(
    queue.map((item) => item.status),
    ["needs_clarification"],
  );

  const v2 = await fit.startRevision(
    f.ctx,
    client,
    asked,
    { measurements: { ...SHEET, inseam: 84 } },
    NOW + 2 * MINUTE,
  );
  assert.equal((await f.ctx.db.get(v1)).status, "superseded", "the questioned version was never approved history");
  assert.equal((await f.ctx.db.get(v2)).status, "provisional");
  assert.deepEqual(
    (await fit.listQueue(f.ctx)).map((item) => item.profileId),
    [v2],
  );

  await fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(v2), { ...SHEET, inseam: 84 }, "", NOW + 3 * MINUTE);
  const approved = await f.ctx.db.get(v2);
  assert.equal(approved.status, "approved");
  assert.equal(approved.clarification, undefined, "an answered question is cleared");
  assert.equal(approved.supersedesId, undefined, "there was no approved version before");
});

test("a version on a released commission cannot be approved or questioned; one in preflight does not block", async () => {
  const { f, client, fitter } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission(), NOW);
  const order = (status, extra = {}) =>
    f.ctx.db.insert("atelierOrders", {
      userId: client._id,
      caseId: "atelierCases|1",
      quoteId: "atelierQuotes|1",
      revisionId: "atelierRevisions|1",
      draftId: "atelierDrafts|1",
      fitProfileId: v1,
      spec: {},
      specHash: "h",
      status,
      payment: { state: "none" },
      createdAt: NOW,
      updatedAt: NOW,
      ...extra,
    });
  await order("preflight");
  await fit.assertNotOnReleasedOrder(f.ctx, await f.ctx.db.get(v1));
  const releasedId = await order("making", { releasedAt: NOW });
  await assert.rejects(
    fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(v1), SHEET, "", NOW + MINUTE),
    (error) => isAppError("INVALID_STATE")(error) && error.data.details.orderIds[0] === releasedId,
  );
  await assert.rejects(
    fit.requestClarification(f.ctx, fitter, await f.ctx.db.get(v1), "Shoe?", NOW + MINUTE),
    isAppError("INVALID_STATE"),
  );
  assert.equal((await f.ctx.db.get(v1)).status, "provisional", "untouched");
  assert.deepEqual((await fit.toReviewView(f.ctx, await f.ctx.db.get(v1))).releasedOrderIds, [releasedId]);

  const v2 = await fit.startRevision(
    f.ctx,
    client,
    await f.ctx.db.get(v1),
    { measurements: { ...SHEET, chest: 103 } },
    NOW + 2 * MINUTE,
  );
  await fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(v2), { ...SHEET, chest: 103 }, "", NOW + 3 * MINUTE);
  assert.equal((await f.ctx.db.get(v2)).status, "approved", "the house approves a new version instead");
  const released = await f.ctx.db.get(releasedId);
  assert.equal(released.fitProfileId, v1, "the commission keeps the exact version it was released against");
  assert.deepEqual((await f.ctx.db.get(v1)).measurements, SHEET);
  assert.ok(fit.isReleasedOrder({ status: "shipped", releasedAt: undefined }));
  assert.ok(!fit.isReleasedOrder({ status: "cancelled", releasedAt: undefined }));
});

test("only an approved version can be attached to a design the client is still working on", async () => {
  const { f, client, stranger, fitter } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission(), NOW);
  const draftId = await f.ctx.db.insert("atelierDrafts", {
    userId: client._id,
    name: "Your suit",
    spec: {},
    shortlist: [],
    stage: "fit",
    completedSteps: [],
    catalogueVersion: 1,
    revision: 1,
    status: "draft",
    createdAt: NOW,
    updatedAt: NOW,
    lastSavedAt: NOW,
  });
  await assert.rejects(
    fit.confirmReuse(f.ctx, client, await f.ctx.db.get(v1), await f.ctx.db.get(draftId), NOW),
    isAppError("INVALID_STATE"),
  );
  await fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(v1), SHEET, "", NOW + MINUTE);
  await assert.rejects(
    fit.confirmReuse(f.ctx, stranger, await f.ctx.db.get(v1), await f.ctx.db.get(draftId), NOW),
    isAppError("NOT_FOUND"),
  );
  await fit.confirmReuse(f.ctx, client, await f.ctx.db.get(v1), await f.ctx.db.get(draftId), NOW + 2 * MINUTE);
  const draft = await f.ctx.db.get(draftId);
  assert.equal(draft.fitProfileId, v1);
  assert.equal(draft.lastSavedAt, NOW + 2 * MINUTE);
  const patches = f.log.patches.length;
  await fit.confirmReuse(f.ctx, client, await f.ctx.db.get(v1), draft, NOW + 3 * MINUTE);
  assert.equal(f.log.patches.length, patches, "attaching the same version again writes nothing");
  f.row(draftId).status = "submitted";
  await assert.rejects(
    fit.confirmReuse(f.ctx, client, await f.ctx.db.get(v1), await f.ctx.db.get(draftId), NOW),
    isAppError("INVALID_STATE"),
  );
});

test("posture photographs: one per pose, image only, within the limit, removable, and each staff look is recorded", async () => {
  const { f, client, stranger, fitter, deletedBlobs, addBlob } = await setup();
  const v1 = await fit.submitRemote(f.ctx, client, submission(), NOW);
  const profile = () => f.ctx.db.get(v1);
  await assert.rejects(
    fit.registerFitPhoto(f.ctx, client, await profile(), "_storage|missing", "front", NOW),
    isAppError("INVALID_INPUT"),
  );
  addBlob("_storage|pdf", { contentType: "application/pdf" });
  await assert.rejects(
    fit.registerFitPhoto(f.ctx, client, await profile(), "_storage|pdf", "front", NOW),
    isAppError("INVALID_INPUT"),
  );
  addBlob("_storage|huge", { size: 13 * 1024 * 1024 });
  await assert.rejects(
    fit.registerFitPhoto(f.ctx, client, await profile(), "_storage|huge", "front", NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    fit.registerFitPhoto(f.ctx, stranger, await profile(), addBlob("_storage|s"), "front", NOW),
    isAppError("NOT_FOUND"),
  );

  const front = await fit.registerFitPhoto(
    f.ctx,
    client,
    await profile(),
    addBlob("_storage|front1"),
    "front",
    NOW + MINUTE,
  );
  const side = await fit.registerFitPhoto(
    f.ctx,
    client,
    await profile(),
    addBlob("_storage|side1"),
    "side",
    NOW + MINUTE,
  );
  const photo = await f.ctx.db.get(front);
  assert.equal(photo.status, "active");
  assert.equal(photo.consentAt, NOW + MINUTE);
  assert.equal(photo.userId, client._id);
  assert.equal((await profile()).updatedAt, NOW + MINUTE);

  const front2 = await fit.registerFitPhoto(
    f.ctx,
    client,
    await profile(),
    addBlob("_storage|front2"),
    "front",
    NOW + 2 * MINUTE,
  );
  assert.equal((await f.ctx.db.get(front)).status, "deleted", "a second front replaces the first");
  assert.deepEqual(deletedBlobs, ["_storage|front1"], "and its file is gone");
  let view = await fit.toProfileView(f.ctx, await profile());
  assert.deepEqual(
    view.photos.map(({ photoId, pose, url }) => [photoId, pose, url]).sort(),
    [
      [front2, "front", "https://files.test/_storage|front2"],
      [side, "side", "https://files.test/_storage|side1"],
    ].sort(),
  );
  const [queued] = await fit.listQueue(f.ctx);
  assert.equal(queued.photoCount, 2);

  const review = await fit.toReviewView(f.ctx, await profile());
  assert.ok(
    review.profile.photos.every((entry) => !("url" in entry)),
    "a query hands out no photo URLs",
  );
  const urls = await fit.viewPhotosAsStaff(f.ctx, fitter, await profile(), NOW + 3 * MINUTE);
  assert.equal(urls.length, 2);
  const looks = f.rowsOf("atelierAuditLog").filter((row) => row.action === "photo.view");
  assert.equal(looks.length, 2);
  assert.ok(looks.every((row) => row.actorUserId === fitter._id && row.actorKind === "staff"));

  await assert.rejects(fit.removeFitPhoto(f.ctx, stranger, await f.ctx.db.get(side), NOW), isAppError("NOT_FOUND"));
  await fit.removeFitPhoto(f.ctx, client, await f.ctx.db.get(side), NOW + 4 * MINUTE);
  assert.equal((await f.ctx.db.get(side)).status, "deleted");
  assert.ok(deletedBlobs.includes("_storage|side1"));
  view = await fit.toProfileView(f.ctx, await profile());
  assert.deepEqual(
    view.photos.map((entry) => entry.pose),
    ["front"],
  );
  const patches = f.log.patches.length;
  await fit.removeFitPhoto(f.ctx, client, await f.ctx.db.get(side), NOW + 5 * MINUTE);
  assert.equal(f.log.patches.length, patches, "removing twice is a no-op");
});

test("the fitter's queue lists what awaits review, oldest first, by first name, and nothing settled", async () => {
  const { f, client, stranger, fitter } = await setup();
  const late = await fit.submitRemote(f.ctx, stranger, submission(), NOW + 2 * MINUTE);
  const early = await fit.submitRemote(f.ctx, client, submission({ uncertainFields: ["neck"] }), NOW);
  const queue = await fit.listQueue(f.ctx);
  assert.deepEqual(
    queue.map((item) => item.profileId),
    [early, late],
  );
  assert.deepEqual(
    queue.map((item) => item.clientName),
    ["Nia", "Someone"],
  );
  assert.deepEqual(queue[0].uncertainFields, ["neck"]);
  assert.equal(queue[0].requestedAt, NOW);
  assert.equal(queue[0].provenanceLabel, "Measured at home with the guide");

  await fit.approveProfile(f.ctx, fitter, await f.ctx.db.get(early), SHEET, "", NOW + 3 * MINUTE);
  assert.deepEqual(
    (await fit.listQueue(f.ctx)).map((item) => item.profileId),
    [late],
  );
  await fit.requestClarification(f.ctx, fitter, await f.ctx.db.get(late), "Which shoe did you wear?", NOW + 4 * MINUTE);
  assert.deepEqual(
    (await fit.listQueue(f.ctx)).map((item) => item.status),
    ["needs_clarification"],
  );
});
