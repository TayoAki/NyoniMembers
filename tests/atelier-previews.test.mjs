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

const photos = await import("../convex/model/atelier/photos.ts");
const previews = await import("../convex/model/atelier/previews.ts");
const drafts = await import("../convex/model/atelier/drafts.ts");
const { ATELIER_LIMITS, PREVIEW_STATUS_LABELS } = await import("../convex/shared/atelier/enums.ts");
const { CONSENT_VERSION, PROVIDER_DISCLOSURE_VERSION } = await import("../convex/shared/atelier/policy.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { DEFAULT_SPEC, describeSpec, specHash } = await import("../convex/shared/atelier/spec.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;
const MINUTE = 60_000;
const CLOTH = CLOTH_SEED[0];
const STAFF = { _id: "users|9", role: "admin", name: "Preview Ops", createdAt: 1 };

const savedEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY };
process.env.OPENAI_API_KEY = "test-key";
delete process.env.AI_GATEWAY_API_KEY;
test.after(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** The shared fake only knows `eq`; the photo and job indexes are read with ranges too. */
function withRangeIndexes(db) {
  const original = db.query.bind(db);
  db.query = (table) => {
    const builder = original(table);
    const plainWithIndex = builder.withIndex.bind(builder);
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
      for (const predicate of predicates) builder.filter(() => predicate);
      return builder;
    };
    return builder;
  };
}

function setup() {
  const f = fakeCtx();
  const files = new Map();
  const scheduled = [];
  let fileSeq = 0;
  withRangeIndexes(f.ctx.db);
  f.ctx.db.system = { get: async (_table, id) => files.get(id) ?? null };
  f.ctx.storage = {
    getUrl: async (id) => (files.has(id) ? `https://files.example/${id}` : null),
    delete: async (id) => {
      if (!files.has(id)) throw new Error(`delete of unknown file ${id}`);
      files.delete(id);
    },
    generateUploadUrl: async () => "https://upload.example",
  };
  f.ctx.scheduler = {
    runAfter: async (delay, fn, args) => {
      scheduled.push({ delay, fn, args });
    },
  };
  const addFile = (overrides = {}) => {
    fileSeq += 1;
    const id = `_storage|${fileSeq}`;
    files.set(id, { _id: id, size: 2_000_000, contentType: "image/jpeg", ...overrides });
    return id;
  };
  return { ...f, files, scheduled, addFile };
}

const PHOTO_INPUT = { mimeType: "image/jpeg", width: 1200, height: 1800, consentVersion: CONSENT_VERSION };

async function addPhoto(f, actor = guestActor, { file, input } = {}, now = NOW) {
  const storageId = f.addFile(file);
  return photos.registerPhoto(f.ctx, actor, { storageId, ...PHOTO_INPUT, ...input }, now);
}

async function makeDraft(f, actor = guestActor, spec = { ...DEFAULT_SPEC, clothCode: CLOTH.code }, now = NOW) {
  const id = await drafts.createDraft(f.ctx, actor, {}, now);
  await f.ctx.db.patch(id, { spec });
  return f.ctx.db.get(id);
}

async function start(f, draftId, actor = guestActor, now = NOW) {
  const draft = await f.ctx.db.get(draftId);
  const photo = await photos.findActivePhoto(f.ctx, actor);
  return previews.startPreview(f.ctx, { draft, actor, photo }, now);
}

function withLapel(spec, lapel) {
  return { ...spec, jacket: { ...spec.jacket, lapel } };
}

/* ---------------------------------------------------------------------------------------- photos */

test("validatePhoto names a specific retake reason for each thing the house can check", () => {
  const good = { mimeType: "image/jpeg", sizeBytes: 2_000_000, width: 1200, height: 1800 };
  assert.deepEqual(photos.validatePhoto(good), { ok: true, reasons: [] });
  assert.match(photos.validatePhoto({ ...good, mimeType: "image/gif" }).reasons[0], /not a JPEG, PNG or WebP/);
  assert.match(
    photos.validatePhoto({ ...good, sizeBytes: ATELIER_LIMITS.maxPhotoBytes + 1 }).reasons[0],
    /larger than 12 MB/,
  );
  assert.match(photos.validatePhoto({ ...good, sizeBytes: null }).reasons[0], /did not finish arriving/);
  assert.match(photos.validatePhoto({ ...good, width: 500, height: 900 }).reasons[0], /too small/);
  assert.match(photos.validatePhoto({ ...good, width: 4000, height: 7000 }).reasons[0], /too large on one side/);
  assert.match(photos.validatePhoto({ ...good, width: 1800, height: 1200 }).reasons[0], /wider than it is tall/);
  const soft = photos.validatePhoto({ ...good, width: 700, height: 1100 });
  assert.equal(soft.ok, true, "a small but usable photo is accepted");
  assert.match(soft.reasons[0], /higher-resolution/);
  const several = photos.validatePhoto({ mimeType: "text/plain", sizeBytes: 0, width: 100, height: 50 });
  assert.equal(several.ok, false);
  assert.equal(several.reasons.length, 4, "every failing check is named, not just the first");
});

test("register stores one consented photo per owner with the current consent and disclosure versions", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  assert.equal(photo.guestKey, GUEST_KEY);
  assert.equal(photo.status, "active");
  assert.equal(photo.consentVersion, CONSENT_VERSION);
  assert.equal(photo.consentAt, NOW);
  assert.equal(photo.providerDisclosureVersion, PROVIDER_DISCLOSURE_VERSION);
  assert.equal(photo.expiresAt, NOW + ATELIER_LIMITS.previewResultDays * DAY);
  assert.deepEqual(photo.validation, { ok: true, reasons: [] });
  assert.equal((await f.ctx.db.get(draft._id)).personPhotoId, photo._id, "the owner's drafts now have a photo");

  const view = await photos.toPhotoView(f.ctx, photo);
  assert.equal(view.url, `https://files.example/${photo.storageId}`);
  assert.equal(view.consentCurrent, true);
  assert.equal("storageId" in view, false, "storage ids never leave the server");
  assert.equal("guestKey" in view, false, "guest keys never leave the server");
  assert.equal(f.rowsOf("atelierAuditLog").at(-1).action, "photo.register");
});

test("register refuses an outdated consent version and a file that is not a photograph, deleting the blob", async () => {
  const f = setup();
  await assert.rejects(
    addPhoto(f, guestActor, { input: { consentVersion: "2020-01-01.0" } }),
    isAppError("INVALID_INPUT"),
  );
  assert.equal(f.rowsOf("atelierPersonPhotos").length, 0);

  const before = f.files.size;
  await assert.rejects(addPhoto(f, guestActor, { file: { contentType: "application/pdf" } }), (error) => {
    assert.equal(error.data.code, "INVALID_INPUT");
    assert.match(error.data.details.reasons[0], /not a JPEG, PNG or WebP/);
    return true;
  });
  assert.equal(f.files.size, before, "the rejected file does not linger in storage");
  assert.equal(f.rowsOf("atelierPersonPhotos").length, 0);

  await assert.rejects(
    addPhoto(f, guestActor, { file: { size: ATELIER_LIMITS.maxPhotoBytes + 1 } }),
    isAppError("INVALID_INPUT"),
  );
  const missing = photos.registerPhoto(f.ctx, guestActor, { storageId: "_storage|missing", ...PHOTO_INPUT }, NOW);
  await assert.rejects(missing, isAppError("INVALID_INPUT"));
});

test("the stored content type wins over the client's claim", async () => {
  const f = setup();
  await assert.rejects(
    addPhoto(f, guestActor, { file: { contentType: "image/gif" }, input: { mimeType: "image/jpeg" } }),
    isAppError("INVALID_INPUT"),
  );
  const photo = await addPhoto(f, guestActor, {
    file: { contentType: "image/webp" },
    input: { mimeType: "image/jpeg" },
  });
  assert.equal(photo.mimeType, "image/webp");
});

test("get returns the owner's active photo and nothing to anyone else", async () => {
  const f = setup();
  const photo = await addPhoto(f);
  const mine = await photos.getPhotoView(f.ctx, guestActor);
  assert.equal(mine.photoId, photo._id);
  assert.equal(await photos.getPhotoView(f.ctx, otherGuestActor), null);
  assert.equal(await photos.getPhotoView(f.ctx, accountActor), null);
  assert.equal(await photos.findActivePhoto(f.ctx, { user: null, guestKey: null }), null);
});

test("registering again replaces the previous photo: it is marked pending deletion, its jobs are cancelled and deletion is scheduled", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const first = await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  f.scheduled.length = 0;

  const second = await addPhoto(f, guestActor, {}, NOW + MINUTE);
  const retired = await f.ctx.db.get(first._id);
  assert.equal(retired.status, "pending_deletion");
  assert.equal(retired.deletedAt, undefined, "not yet a deletion receipt");
  assert.ok(f.files.has(first.storageId), "the file is still there until the scheduled deletion runs");
  assert.equal((await f.ctx.db.get(jobId)).status, "cancelled", "work on the old photo is cancelled");
  assert.equal((await f.ctx.db.get(draft._id)).personPhotoId, second._id);
  assert.equal(await photos.findActivePhoto(f.ctx, guestActor).then((p) => p._id), second._id);

  const deletion = f.scheduled.find((entry) => entry.args?.photoId === first._id);
  assert.ok(deletion, "finishDeletion is scheduled for the old photo");
  assert.equal(deletion.delay, 0);
  assert.equal(await photos.finishDeletion(f.ctx, first._id, NOW + 2 * MINUTE), true);
  const deleted = await f.ctx.db.get(first._id);
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.deletedAt, NOW + 2 * MINUTE);
  assert.equal(f.files.has(first.storageId), false);
  assert.ok(f.files.has(second.storageId), "the new photo is untouched");
  assert.equal(await photos.finishDeletion(f.ctx, first._id, NOW + 3 * MINUTE), false, "finishing twice is a no-op");
  assert.ok(f.rowsOf("atelierAuditLog").some((row) => row.action === "photo.replace"));
});

test("remove deletes the photo now, cancels its jobs, expires its results and clears the draft's pointer", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const done = await start(f, draft._id);
  assert.equal(await previews.beginJob(f.ctx, done.jobId, NOW), true);
  const resultId = f.addFile({ contentType: "image/png" });
  assert.deepEqual(await previews.completeJob(f.ctx, { jobId: done.jobId, resultStorageId: resultId }, NOW + MINUTE), {
    stored: true,
  });

  const other = await makeDraft(f, guestActor, withLapel({ ...DEFAULT_SPEC, clothCode: CLOTH.code }, "peak"));
  const running = await start(f, other._id);
  assert.equal(await previews.beginJob(f.ctx, running.jobId, NOW), true);

  await photos.removePhoto(f.ctx, guestActor, photo._id, NOW + 2 * MINUTE);
  const gone = await f.ctx.db.get(photo._id);
  assert.equal(gone.status, "deleted");
  assert.equal(gone.deletedAt, NOW + 2 * MINUTE);
  assert.equal(f.files.has(photo.storageId), false, "the photo file is deleted");
  assert.equal(f.files.has(resultId), false, "finished results made from it are deleted too");
  const expired = await f.ctx.db.get(done.jobId);
  assert.equal(expired.status, "expired");
  assert.equal(expired.resultStorageId, undefined);
  assert.equal((await f.ctx.db.get(running.jobId)).status, "cancelled");
  assert.equal((await f.ctx.db.get(draft._id)).personPhotoId, undefined);
  assert.equal(await photos.getPhotoView(f.ctx, guestActor), null);
  assert.equal(f.rowsOf("atelierAuditLog").at(-1).action, "photo.remove");

  await photos.removePhoto(f.ctx, guestActor, photo._id, NOW + 3 * MINUTE);
  assert.equal((await f.ctx.db.get(photo._id)).deletedAt, NOW + 2 * MINUTE, "removing twice changes nothing");
});

test("a stranger cannot read or remove someone else's photo", async () => {
  const f = setup();
  const photo = await addPhoto(f);
  await assert.rejects(photos.removePhoto(f.ctx, otherGuestActor, photo._id, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(photos.removePhoto(f.ctx, strangerActor, photo._id, NOW), isAppError("NOT_FOUND"));
  assert.equal((await f.ctx.db.get(photo._id)).status, "active");
});

test("scenario 4: a result that arrives after the photo was removed is deleted unseen", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  assert.equal(await previews.beginJob(f.ctx, jobId, NOW), true);

  await photos.removePhoto(f.ctx, guestActor, photo._id, NOW + MINUTE);
  const late = f.addFile({ contentType: "image/png" });
  assert.deepEqual(await previews.completeJob(f.ctx, { jobId, resultStorageId: late }, NOW + 2 * MINUTE), {
    stored: false,
  });
  assert.equal(f.files.has(late), false, "the late result is deleted");
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.status, "cancelled");
  assert.equal(job.resultStorageId, undefined);
  const [view] = await previews.listForDraft(f.ctx, await f.ctx.db.get(draft._id));
  assert.equal(view.resultUrl, null);
  assert.equal(view.statusLabel, PREVIEW_STATUS_LABELS.cancelled);
});

test("expirePhotos deletes photos past retention with their results and finishes stuck deletions", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  const resultId = f.addFile({ contentType: "image/png" });
  await previews.completeJob(f.ctx, { jobId, resultStorageId: resultId }, NOW + MINUTE);

  const stuck = await addPhoto(f, otherGuestActor);
  await f.ctx.db.patch(stuck._id, { status: "pending_deletion" });

  const early = await photos.expirePhotos(f.ctx, photo.expiresAt - 1);
  assert.deepEqual(early, { expired: 0, finished: 1 });
  assert.equal((await f.ctx.db.get(stuck._id)).status, "deleted");
  assert.equal((await f.ctx.db.get(photo._id)).status, "active");

  const due = await photos.expirePhotos(f.ctx, photo.expiresAt);
  assert.deepEqual(due, { expired: 1, finished: 0 });
  assert.equal((await f.ctx.db.get(photo._id)).status, "deleted");
  assert.equal(f.files.has(photo.storageId), false);
  assert.equal(f.files.has(resultId), false);
  assert.equal((await f.ctx.db.get(jobId)).status, "expired");
  const audit = f.rowsOf("atelierAuditLog").find((row) => row.action === "photo.expire");
  assert.equal(audit.actorKind, "system");
});

/* -------------------------------------------------------------------------------------- previews */

test("previewsAvailable needs one of the two provider keys, and start reports it truthfully when neither is set", async () => {
  assert.equal(previews.previewsAvailable({}), false);
  assert.equal(previews.previewsAvailable({ OPENAI_API_KEY: "  " }), false);
  assert.equal(previews.previewsAvailable({ OPENAI_API_KEY: "sk" }), true);
  assert.equal(previews.previewsAvailable({ AI_GATEWAY_API_KEY: "gw" }), true);

  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(start(f, draft._id), (error) => {
      assert.equal(error.data.code, "PREVIEWS_UNAVAILABLE");
      assert.doesNotMatch(error.data.message, /AI|generate|upload|credit/i);
      return true;
    });
    assert.equal(f.rowsOf("atelierPreviewJobs").length, 0);
    assert.equal(f.rowsOf("atelierRevisions").length, 0, "nothing is frozen when the feature is off");
  } finally {
    process.env.OPENAI_API_KEY = saved;
  }
});

test("start needs a cloth and an active photo before it freezes anything", async () => {
  const f = setup();
  const bare = await makeDraft(f, guestActor, DEFAULT_SPEC);
  await addPhoto(f);
  await assert.rejects(start(f, bare._id), isAppError("INVALID_INPUT"));

  const g = setup();
  const draft = await makeDraft(g);
  await assert.rejects(start(g, draft._id), (error) => {
    assert.equal(error.data.code, "INVALID_STATE");
    assert.equal(error.data.message, "Add a photo first.");
    return true;
  });
  assert.equal(g.rowsOf("atelierRevisions").length, 0);
  assert.equal(g.rowsOf("atelierPreviewJobs").length, 0);

  const unknownCloth = await makeDraft(g, guestActor, { ...DEFAULT_SPEC, clothCode: "NOT-A-CLOTH" });
  await addPhoto(g);
  await assert.rejects(start(g, unknownCloth._id), isAppError("INVALID_INPUT"));
});

test("start freezes a preview revision, queues one job, points the draft at it and schedules generation", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const result = await start(f, draft._id);
  assert.equal(result.reused, false);

  const job = await f.ctx.db.get(result.jobId);
  assert.equal(job.status, "queued");
  assert.equal(job.quality, "pending");
  assert.equal(job.attempt, 1);
  assert.equal(job.guestKey, GUEST_KEY);
  assert.equal(job.userId, undefined);
  assert.equal(job.personPhotoId, photo._id);
  assert.equal(job.specHash, specHash(draft.spec));
  assert.match(job.specLabel, new RegExp(CLOTH.name));
  assert.equal(job.idempotencyKey, `${draft._id}:${job.specHash}:${photo._id}`);
  assert.equal(job.createdAt, NOW);

  const revision = await f.ctx.db.get(job.revisionId);
  assert.equal(revision.reason, "preview");
  assert.equal(revision.specHash, job.specHash);
  assert.deepEqual(revision.spec, draft.spec);

  const updated = await f.ctx.db.get(draft._id);
  assert.equal(updated.currentPreviewJobId, job._id);
  assert.equal(updated.personPhotoId, photo._id);
  assert.deepEqual(updated.spec, draft.spec, "starting a preview never edits the design");

  const run = f.scheduled.find((entry) => entry.args?.jobId === job._id);
  assert.ok(run, "generation is scheduled");
  assert.equal(run.delay, 0);
  assert.equal(f.rowsOf("atelierAuditLog").at(-1).action, "preview.start");
});

test("start is idempotent on design hash + photo: a live or finished job is returned, not duplicated", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const first = await start(f, draft._id);
  const again = await start(f, draft._id, guestActor, NOW + MINUTE);
  assert.deepEqual(again, { jobId: first.jobId, reused: true });
  assert.equal(f.rowsOf("atelierPreviewJobs").length, 1);
  assert.equal(f.rowsOf("atelierRevisions").length, 1, "the same design is frozen once");

  await previews.beginJob(f.ctx, first.jobId, NOW);
  await previews.completeJob(
    f.ctx,
    { jobId: first.jobId, resultStorageId: f.addFile({ contentType: "image/png" }) },
    NOW + MINUTE,
  );
  assert.deepEqual(await start(f, draft._id, guestActor, NOW + 2 * MINUTE), { jobId: first.jobId, reused: true });

  await f.ctx.db.patch(first.jobId, { status: "failed", error: "Could not finish in time." });
  const afterFailure = await start(f, draft._id, guestActor, NOW + 3 * MINUTE);
  assert.equal(afterFailure.reused, false, "a failed job is not reused");
  assert.equal(
    (await f.ctx.db.get(afterFailure.jobId)).idempotencyKey,
    (await f.ctx.db.get(first.jobId)).idempotencyKey,
  );
});

test("a rejected or expired result is not reused", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  await previews.completeJob(f.ctx, { jobId, resultStorageId: f.addFile({ contentType: "image/png" }) }, NOW);
  await previews.flagQuality(f.ctx, STAFF, jobId, "rejected", "Likeness lost", NOW);
  const fresh = await start(f, draft._id, guestActor, NOW + MINUTE);
  assert.equal(fresh.reused, false);
  assert.notEqual(fresh.jobId, jobId);
});

test("scenario 3: preview B, edit to C, B arrives — B never claims to be C", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const b = await start(f, draft._id);
  await previews.beginJob(f.ctx, b.jobId, NOW);

  const specC = withLapel(draft.spec, "peak");
  await f.ctx.db.patch(draft._id, { spec: specC });
  const c = await start(f, draft._id, guestActor, NOW + MINUTE);
  assert.equal(c.reused, false);
  assert.notEqual(c.jobId, b.jobId);
  assert.equal((await f.ctx.db.get(draft._id)).currentPreviewJobId, c.jobId);

  const resultB = f.addFile({ contentType: "image/png" });
  assert.deepEqual(await previews.completeJob(f.ctx, { jobId: b.jobId, resultStorageId: resultB }, NOW + 2 * MINUTE), {
    stored: true,
  });

  const list = await previews.listForDraft(f.ctx, await f.ctx.db.get(draft._id));
  assert.deepEqual(
    list.map((view) => view.jobId),
    [c.jobId, b.jobId],
    "newest first",
  );
  const viewB = list.find((view) => view.jobId === b.jobId);
  const viewC = list.find((view) => view.jobId === c.jobId);
  assert.equal(viewB.isCurrent, false, "B shows a previous design");
  assert.equal(viewB.status, "done");
  assert.equal(viewB.resultUrl, `https://files.example/${resultB}`);
  assert.equal(viewB.specHash, specHash(draft.spec));
  assert.equal(viewC.isCurrent, true);
  assert.equal(viewC.resultUrl, null);
  assert.equal(viewC.statusLabel, PREVIEW_STATUS_LABELS.queued);
  assert.equal(viewB.revision + 1, viewC.revision, "each preview names the revision it was made from");
});

test("the daily budget counts the owner's starts today, not reused jobs or yesterday's", async () => {
  const f = setup();
  await addPhoto(f);
  const limit = ATELIER_LIMITS.previewsPerDay;
  const yesterday = await makeDraft(f);
  await start(f, yesterday._id, guestActor, NOW - 13 * 60 * MINUTE);

  const ids = [];
  for (let i = 0; i < limit; i += 1) {
    const draft = await makeDraft(f);
    ids.push(draft._id);
    const result = await start(f, draft._id, guestActor, NOW + i);
    assert.equal(result.reused, false);
  }
  assert.deepEqual(
    await start(f, ids[0], guestActor, NOW + limit),
    { jobId: (await f.ctx.db.get(ids[0])).currentPreviewJobId, reused: true },
    "a reused job costs nothing",
  );

  const oneMore = await makeDraft(f);
  await assert.rejects(start(f, oneMore._id, guestActor, NOW + limit + 1), (error) => {
    assert.equal(error.data.code, "DAILY_CAP_REACHED");
    assert.equal(error.data.details.limit, limit);
    assert.doesNotMatch(error.data.message, /credit/i);
    return true;
  });
  assert.equal(f.rowsOf("atelierPreviewJobs").length, limit + 1);

  const tomorrow = await start(f, oneMore._id, guestActor, previews.startOfUtcDay(NOW) + DAY);
  assert.equal(tomorrow.reused, false, "the budget resets with the day");

  const other = await makeDraft(f, otherGuestActor);
  await addPhoto(f, otherGuestActor);
  assert.equal((await start(f, other._id, otherGuestActor, NOW + limit + 2)).reused, false, "budgets are per owner");
});

test("cancel before completion: the late result is discarded and the job stays cancelled", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  assert.equal(await previews.beginJob(f.ctx, jobId, NOW), true);
  assert.equal((await f.ctx.db.get(jobId)).status, "processing");

  await previews.cancelPreview(f.ctx, guestActor, jobId, NOW + MINUTE);
  const cancelled = await f.ctx.db.get(jobId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledAt, NOW + MINUTE);

  const late = f.addFile({ contentType: "image/png" });
  assert.deepEqual(await previews.completeJob(f.ctx, { jobId, resultStorageId: late }, NOW + 2 * MINUTE), {
    stored: false,
  });
  assert.equal(f.files.has(late), false);
  const after = await f.ctx.db.get(jobId);
  assert.equal(after.status, "cancelled");
  assert.equal(after.resultStorageId, undefined);
  assert.equal(
    await previews.failJob(f.ctx, jobId, "provider said no", NOW + 3 * MINUTE),
    false,
    "a cancelled job does not become failed",
  );
  assert.equal((await f.ctx.db.get(jobId)).status, "cancelled");

  await previews.cancelPreview(f.ctx, guestActor, jobId, NOW + 4 * MINUTE);
  assert.equal((await f.ctx.db.get(jobId)).cancelledAt, NOW + MINUTE, "cancelling twice is harmless");
  assert.equal(f.rowsOf("atelierAuditLog").filter((row) => row.action === "preview.cancel").length, 1);
});

test("a finished job cannot be cancelled, and a cancelled job is never begun", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  await previews.completeJob(f.ctx, { jobId, resultStorageId: f.addFile({ contentType: "image/png" }) }, NOW);
  await assert.rejects(previews.cancelPreview(f.ctx, guestActor, jobId, NOW), isAppError("INVALID_STATE"));

  const other = await makeDraft(f, guestActor, withLapel({ ...DEFAULT_SPEC, clothCode: CLOTH.code }, "peak"));
  const second = await start(f, other._id);
  await previews.cancelPreview(f.ctx, guestActor, second.jobId, NOW);
  assert.equal(await previews.beginJob(f.ctx, second.jobId, NOW + MINUTE), false);
  assert.equal((await f.ctx.db.get(second.jobId)).status, "cancelled");
  assert.equal(await previews.beginJob(f.ctx, jobId, NOW + MINUTE), false, "a finished job is not begun again");
});

test("completion stores the result, accepts it, dates its expiry and records usage", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  const resultId = f.addFile({ contentType: "image/png" });
  const usage = { inputTextTokens: 300, inputImageTokens: 1000, outputTokens: 4000 };
  await previews.completeJob(f.ctx, { jobId, resultStorageId: resultId, usage }, NOW + MINUTE);
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.status, "done");
  assert.equal(job.quality, "accepted");
  assert.equal(job.resultStorageId, resultId);
  assert.equal(job.completedAt, NOW + MINUTE);
  assert.equal(job.expiresAt, NOW + MINUTE + ATELIER_LIMITS.previewResultDays * DAY);
  assert.deepEqual(job.usage, usage);
  assert.ok(job.costUsd > 0);

  const view = await previews.getJobView(f.ctx, guestActor, jobId);
  assert.equal(view.resultUrl, `https://files.example/${resultId}`);
  assert.equal(view.isCurrent, true);
  assert.equal(view.statusLabel, PREVIEW_STATUS_LABELS.done);
  assert.equal("resultStorageId" in view, false);
  await assert.rejects(previews.getJobView(f.ctx, otherGuestActor, jobId), isAppError("NOT_FOUND"));
  await assert.rejects(previews.cancelPreview(f.ctx, strangerActor, jobId, NOW), isAppError("NOT_FOUND"));
});

test("failure keeps a short human reason and is retried as a new attempt on the same revision", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  assert.equal(await previews.failJob(f.ctx, jobId, "x".repeat(400), NOW + MINUTE), true);
  const failed = await f.ctx.db.get(jobId);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error.length, 240);
  assert.equal(failed.completedAt, NOW + MINUTE);

  f.scheduled.length = 0;
  const retried = await previews.retryPreview(f.ctx, guestActor, jobId, NOW + 2 * MINUTE);
  assert.equal(retried.reused, false);
  const next = await f.ctx.db.get(retried.jobId);
  assert.equal(next.attempt, 2);
  assert.equal(next.status, "queued");
  assert.equal(next.revisionId, failed.revisionId);
  assert.equal(next.idempotencyKey, failed.idempotencyKey);
  assert.equal((await f.ctx.db.get(draft._id)).currentPreviewJobId, next._id);
  assert.ok(f.scheduled.some((entry) => entry.args?.jobId === next._id));

  assert.deepEqual(
    await previews.retryPreview(f.ctx, guestActor, jobId, NOW + 3 * MINUTE),
    { jobId: next._id, reused: true },
    "a live attempt is returned instead of a third",
  );
  await assert.rejects(previews.retryPreview(f.ctx, guestActor, next._id, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(previews.retryPreview(f.ctx, otherGuestActor, jobId, NOW), isAppError("NOT_FOUND"));
});

test("retry refuses a finished job and a job whose photo is gone", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await previews.beginJob(f.ctx, jobId, NOW);
  await previews.completeJob(f.ctx, { jobId, resultStorageId: f.addFile({ contentType: "image/png" }) }, NOW);
  await assert.rejects(previews.retryPreview(f.ctx, guestActor, jobId, NOW), isAppError("INVALID_STATE"));

  await photos.removePhoto(f.ctx, guestActor, photo._id, NOW + MINUTE);
  await assert.rejects(previews.retryPreview(f.ctx, guestActor, jobId, NOW + 2 * MINUTE), (error) => {
    assert.equal(error.data.code, "INVALID_STATE");
    assert.equal(error.data.message, "Add a photo first.");
    return true;
  });
});

test("expireJobs fails jobs stuck past the timeout and expires results past their date", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const stuck = await start(f, draft._id);
  await previews.beginJob(f.ctx, stuck.jobId, NOW);
  const neverStarted = await start(
    f,
    (await makeDraft(f, guestActor, withLapel({ ...DEFAULT_SPEC, clothCode: CLOTH.code }, "peak")))._id,
  );
  const fresh = await start(
    f,
    (
      await makeDraft(f, guestActor, {
        ...DEFAULT_SPEC,
        clothCode: CLOTH.code,
        jacket: { ...DEFAULT_SPEC.jacket, vents: "none" },
      })
    )._id,
    guestActor,
    NOW + 9 * MINUTE,
  );

  const timeout = ATELIER_LIMITS.previewTimeoutMinutes * MINUTE;
  const first = await previews.expireJobs(f.ctx, NOW + timeout + MINUTE);
  assert.deepEqual(first, { timedOut: 2, expired: 0 });
  assert.equal((await f.ctx.db.get(stuck.jobId)).error, previews.TIMED_OUT_MESSAGE);
  assert.equal((await f.ctx.db.get(neverStarted.jobId)).error, previews.NEVER_STARTED_MESSAGE);
  assert.equal((await f.ctx.db.get(fresh.jobId)).status, "queued", "a job inside the timeout is left alone");

  await previews.beginJob(f.ctx, fresh.jobId, NOW + 10 * MINUTE);
  const resultId = f.addFile({ contentType: "image/png" });
  await previews.completeJob(f.ctx, { jobId: fresh.jobId, resultStorageId: resultId }, NOW + 11 * MINUTE);
  const job = await f.ctx.db.get(fresh.jobId);
  assert.deepEqual(await previews.expireJobs(f.ctx, job.expiresAt - 1), { timedOut: 0, expired: 0 });
  assert.deepEqual(await previews.expireJobs(f.ctx, job.expiresAt), { timedOut: 0, expired: 1 });
  const expired = await f.ctx.db.get(fresh.jobId);
  assert.equal(expired.status, "expired");
  assert.equal(expired.resultStorageId, undefined);
  assert.equal(f.files.has(resultId), false);
  const view = await previews.getJobView(f.ctx, guestActor, fresh.jobId);
  assert.equal(view.resultUrl, null);
  assert.equal(view.specLabel, job.specLabel, "the design outlives the image");
});

test("generationContext serves the action the frozen spec, the cloth's shade and the photo file; the prompt names them", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  const photo = await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await assert.rejects(
    previews.generationContext(f.ctx, jobId),
    isAppError("INVALID_STATE"),
    "only a processing job is served",
  );
  await previews.beginJob(f.ctx, jobId, NOW);
  const context = await previews.generationContext(f.ctx, jobId);
  assert.equal(context.photoStorageId, photo.storageId);
  assert.deepEqual(context.spec, draft.spec);
  assert.equal(context.cloth.hex, CLOTH.hex);
  assert.equal(context.cloth.pattern, CLOTH.pattern);
  assert.deepEqual(
    context.lines.map((line) => line.label),
    describeSpec(draft.spec).map((line) => line.label),
  );

  const prompt = previews.previewPrompt(context);
  assert.match(prompt, new RegExp(CLOTH.hex.toUpperCase()));
  assert.match(prompt, new RegExp(CLOTH.name));
  assert.match(prompt, /Change only the clothing/);
  assert.doesNotMatch(prompt, /Lining|Monogram|Working cuffs/);
  assert.doesNotMatch(prompt, /input_fidelity/);
  const lapel = context.lines.find((line) => line.label === "Lapel");
  assert.match(prompt, new RegExp(`Jacket lapel: ${lapel.value}`));

  const tuxedo = previews.previewPrompt({ ...context, spec: { ...context.spec, garment: "tuxedo" } });
  assert.match(tuxedo, /bow tie/);
  const noCloth = previews.previewPrompt({ ...context, cloth: null });
  assert.match(noCloth, /mid-grey/);
});

/* ------------------------------------------------------------------------------------------- staff */

test("staff flag quality on a finished job and every look at a result is audited as photo.view", async () => {
  const f = setup();
  const draft = await makeDraft(f);
  await addPhoto(f);
  const { jobId } = await start(f, draft._id);
  await assert.rejects(previews.flagQuality(f.ctx, STAFF, jobId, "rejected", "", NOW), isAppError("INVALID_STATE"));
  await assert.rejects(previews.viewResult(f.ctx, STAFF, jobId, NOW), isAppError("INVALID_STATE"));
  await previews.beginJob(f.ctx, jobId, NOW);
  const resultId = f.addFile({ contentType: "image/png" });
  await previews.completeJob(f.ctx, { jobId, resultStorageId: resultId }, NOW);

  const seen = await previews.viewResult(f.ctx, STAFF, jobId, NOW + MINUTE);
  assert.equal(seen.url, `https://files.example/${resultId}`);
  const view = f.rowsOf("atelierAuditLog").at(-1);
  assert.equal(view.action, "photo.view");
  assert.equal(view.actorUserId, STAFF._id);
  assert.equal(view.actorKind, "staff");
  assert.equal(view.targetId, jobId);

  await previews.flagQuality(f.ctx, STAFF, jobId, "rejected", "Hands redrawn", NOW + 2 * MINUTE);
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.quality, "rejected");
  assert.equal(job.qualityNote, "Hands redrawn");
  assert.equal(job.resultStorageId, resultId, "the file is kept for the record");
  const client = await previews.getJobView(f.ctx, guestActor, jobId);
  assert.equal(client.resultUrl, null, "a rejected result is not shown as a preview");
  assert.equal(client.quality, "rejected");
  assert.equal(f.rowsOf("atelierAuditLog").at(-1).action, "preview.quality");

  const [staffView] = await previews.listStaffJobs(f.ctx, "done");
  assert.equal(staffView.jobId, jobId);
  assert.equal(staffView.ownerKind, "guest");
  assert.equal(staffView.hasResult, true);
  assert.equal(staffView.photoStatus, "active");
  assert.equal("guestKey" in staffView, false);
  assert.equal("resultUrl" in staffView, false, "staff see results only through the audited viewResult");
  assert.equal((await previews.listStaffJobs(f.ctx, "failed")).length, 0);
  assert.equal((await previews.listStaffJobs(f.ctx, undefined, 10)).length, 1);
});

test("an account's photo and jobs are stamped with the user, never a guest key", async () => {
  const f = setup();
  const draft = await makeDraft(f, accountActor);
  const photo = await addPhoto(f, accountActor);
  assert.equal(photo.userId, accountActor.user._id);
  assert.equal(photo.guestKey, undefined);
  const { jobId } = await start(f, draft._id, accountActor);
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.userId, accountActor.user._id);
  assert.equal(job.guestKey, undefined);
  assert.equal(await photos.getPhotoView(f.ctx, guestActor), null);
  assert.equal((await previews.listStaffJobs(f.ctx, undefined))[0].ownerKind, "account");
});

/* ------------------------------------------------------------------ one owner per photograph and job */

/** A signed-in client whose browser still holds the guest key it designed with before signing in. */
const signedInOnThisBrowser = { user: accountActor.user, guestKey: GUEST_KEY };

test("a signed-in client on a design this browser still holds is asked to save it first; nothing is frozen or queued", async () => {
  const f = setup();
  const draft = await makeDraft(f, guestActor);
  const photo = await addPhoto(f, signedInOnThisBrowser);
  assert.equal(photo.userId, accountActor.user._id, "the photograph belongs to the account");
  const revisionsBefore = f.rowsOf("atelierRevisions").length;

  await assert.rejects(start(f, draft._id, signedInOnThisBrowser), (error) => {
    assert.equal(error.data.code, "INVALID_STATE");
    assert.equal(error.data.message, previews.LINK_BEFORE_PREVIEW_MESSAGE);
    assert.deepEqual(error.data.details, { linkRequired: true });
    return true;
  });
  assert.equal(f.rowsOf("atelierPreviewJobs").length, 0, "no job stamped with the browser's key");
  assert.equal(f.rowsOf("atelierRevisions").length, revisionsBefore, "nothing is frozen");
  assert.equal(f.scheduled.length, 0);
  assert.equal((await f.ctx.db.get(draft._id)).personPhotoId, undefined, "the design is not pointed at the photograph");

  // Saved to the account, the same design and photograph make a job the account owns, which removal retires.
  await drafts.linkDraft(f.ctx, accountActor.user, draft._id, GUEST_KEY, NOW);
  const { jobId } = await start(f, draft._id, signedInOnThisBrowser);
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.userId, accountActor.user._id);
  assert.equal(job.guestKey, undefined);
  await photos.removePhoto(f.ctx, accountActor, photo._id, NOW + MINUTE);
  assert.equal((await f.ctx.db.get(jobId)).status, "cancelled");
});

test("assertSameOwner: a job and its photograph must have one owner, account or browser", () => {
  const accountPhoto = { userId: accountActor.user._id };
  const guestPhoto = { guestKey: GUEST_KEY };
  assert.doesNotThrow(() => previews.assertSameOwner({ userId: accountActor.user._id }, accountPhoto));
  assert.doesNotThrow(() => previews.assertSameOwner({ guestKey: GUEST_KEY }, guestPhoto));
  assert.throws(() => previews.assertSameOwner({ guestKey: GUEST_KEY }, accountPhoto), isAppError("INVALID_STATE"));
  assert.throws(
    () => previews.assertSameOwner({ userId: accountActor.user._id }, guestPhoto),
    isAppError("INVALID_STATE"),
  );
  assert.throws(
    () => previews.assertSameOwner({ guestKey: GUEST_KEY }, { userId: accountActor.user._id, guestKey: GUEST_KEY }),
    isAppError("INVALID_STATE"),
    "a photograph the account holds is the account's, whatever key it once carried",
  );
  assert.throws(() => previews.assertSameOwner({}, guestPhoto), isAppError("INVALID_STATE"));
});

/** A job written before the guard: stamped with the browser's key, made from the account's photograph. */
async function legacyMismatchedJob(f) {
  const draft = await makeDraft(f, guestActor);
  const photo = await addPhoto(f, signedInOnThisBrowser);
  const revisionId = await f.ctx.db.insert("atelierRevisions", {
    draftId: draft._id,
    revision: 1,
    spec: draft.spec,
    specHash: specHash(draft.spec),
    catalogueVersion: 1,
    reason: "preview",
    createdAt: NOW,
  });
  const resultStorageId = f.addFile({ contentType: "image/png" });
  const jobId = await f.ctx.db.insert("atelierPreviewJobs", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    personPhotoId: photo._id,
    revisionId,
    specHash: specHash(draft.spec),
    specLabel: "Legacy",
    idempotencyKey: previews.idempotencyKey(draft._id, specHash(draft.spec), photo._id),
    status: "done",
    quality: "accepted",
    resultStorageId,
    attempt: 1,
    completedAt: NOW,
    expiresAt: NOW + 30 * DAY,
    createdAt: NOW,
  });
  return { draft, photo, jobId, resultStorageId };
}

test("retry refuses a job stamped with a different owner from its photograph", async () => {
  const f = setup();
  const { jobId } = await legacyMismatchedJob(f);
  await f.ctx.db.patch(jobId, { status: "failed", resultStorageId: undefined });
  await assert.rejects(previews.retryPreview(f.ctx, signedInOnThisBrowser, jobId, NOW + MINUTE), (error) => {
    assert.equal(error.data.code, "INVALID_STATE");
    assert.equal(error.data.details.linkRequired, true);
    return true;
  });
  assert.equal(f.rowsOf("atelierPreviewJobs").length, 1);
});

test("the by_photo index lists every job made from a photograph, whoever it is stamped with", async () => {
  const f = setup();
  const { photo, jobId } = await legacyMismatchedJob(f);
  const viaPhoto = await f.ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_photo", (q) => q.eq("personPhotoId", photo._id))
    .take(10);
  assert.deepEqual(
    viaPhoto.map((job) => job._id),
    [jobId],
  );
});

test("removing a photograph retires every job made from it, including one stamped with another owner", async () => {
  const f = setup();
  const { photo, jobId, resultStorageId } = await legacyMismatchedJob(f);
  await photos.removePhoto(f.ctx, accountActor, photo._id, NOW + MINUTE);
  const job = await f.ctx.db.get(jobId);
  assert.equal(job.status, "expired");
  assert.equal(job.resultStorageId, undefined);
  assert.equal(f.files.has(resultStorageId), false, "the result made from the photograph is deleted with it");
});
