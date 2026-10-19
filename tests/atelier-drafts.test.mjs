import assert from "node:assert/strict";
import test from "node:test";
import {
  accountActor,
  accountUser,
  fakeCtx,
  GUEST_KEY,
  guestActor,
  isAppError,
  OTHER_GUEST_KEY,
  otherGuestActor,
  strangerActor,
} from "./atelier-fake-ctx.mjs";

const drafts = await import("../convex/model/atelier/drafts.ts");
const groups = await import("../convex/model/atelier/groups.ts");
const { ATELIER_LIMITS } = await import("../convex/shared/atelier/enums.ts");
const { DEFAULT_SPEC, specDifferences, specHash } = await import("../convex/shared/atelier/spec.ts");
const { LOOKS } = await import("../convex/shared/atelier/looks.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { LINING_SEED } = await import("../convex/shared/atelier/materials.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;
const CLOTHS = CLOTH_SEED.map((cloth) => cloth.code);

async function makeDraft(f, actor = guestActor, input = {}, now = NOW) {
  const id = await drafts.createDraft(f.ctx, actor, input, now);
  return f.ctx.db.get(id);
}

test("create seeds the catalogue once and starts a guest draft from the house's default spec", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  assert.equal(draft.guestKey, GUEST_KEY);
  assert.equal(draft.userId, undefined);
  assert.equal(draft.name, "Your suit");
  assert.equal(draft.status, "draft");
  assert.equal(draft.revision, 1);
  assert.equal(draft.stage, "occasion");
  assert.deepEqual(draft.spec, DEFAULT_SPEC);
  assert.deepEqual(draft.completedSteps, ["style"]);
  assert.equal(draft.catalogueVersion, 1);
  assert.equal(draft.lastSavedAt, NOW);
  assert.equal(f.rowsOf("atelierCatalogueVersions").length, 1);
  const entries = f.rowsOf("atelierCatalogueEntries").length;
  await makeDraft(f, accountActor);
  assert.equal(f.rowsOf("atelierCatalogueEntries").length, entries, "a second draft does not reseed");
});

test("a look fills the design, names the draft and moves the stage past the occasion", async () => {
  const f = fakeCtx();
  const look = LOOKS[0];
  const draft = await makeDraft(f, accountActor, { lookKey: look.key, occasion: "wedding" });
  assert.equal(draft.userId, accountUser._id);
  assert.equal(draft.guestKey, undefined);
  assert.equal(draft.name, look.name);
  assert.equal(draft.lookKey, look.key);
  assert.deepEqual(draft.spec, look.spec);
  assert.equal(draft.stage, "cloth");
  assert.deepEqual(draft.completedSteps, ["occasion", "cloth", "style", "details"]);
  await assert.rejects(
    drafts.createDraft(f.ctx, accountActor, { lookKey: "no-such-look" }, NOW),
    isAppError("INVALID_INPUT"),
  );
});

test("an actor with neither account nor guest key cannot create, and the cap is per owner", async () => {
  const f = fakeCtx();
  await assert.rejects(
    drafts.createDraft(f.ctx, { user: null, guestKey: null }, {}, NOW),
    isAppError("UNAUTHENTICATED"),
  );
  for (let i = 0; i < ATELIER_LIMITS.draftsPerOwner; i += 1) await makeDraft(f, guestActor, {}, NOW + i);
  await assert.rejects(drafts.createDraft(f.ctx, guestActor, {}, NOW), isAppError("INVALID_INPUT"));
  const other = await makeDraft(f, otherGuestActor);
  assert.ok(other, "another browser is not held back by this one's cap");
  const first = f.rowsOf("atelierDrafts")[0];
  await drafts.archiveDraft(f.ctx, first, guestActor, NOW);
  assert.ok(await makeDraft(f, guestActor), "archiving frees a place");
});

test("commit returns conflicts without writing, then writes the whole change once accepted (S08)", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const written = f.log.patches.length;
  const proposal = await drafts.commitChange(f.ctx, draft, { jacket: { breast: "double" } }, false, NOW + 1);
  assert.equal(proposal.applied, false);
  assert.equal(proposal.revision, 1);
  assert.deepEqual(proposal.conflicts.map((conflict) => conflict.field).sort(), ["jacket.buttons", "jacket.lapel"]);
  assert.equal(proposal.spec.jacket.breast, "double");
  assert.equal(proposal.spec.jacket.lapel, "peak");
  assert.equal(f.log.patches.length, written, "a proposal writes nothing");
  assert.deepEqual((await f.ctx.db.get(draft._id)).spec, DEFAULT_SPEC, "the original is unchanged");

  const accepted = await drafts.commitChange(f.ctx, draft, { jacket: { breast: "double" } }, true, NOW + 2);
  assert.equal(accepted.applied, true);
  assert.equal(accepted.revision, 2);
  assert.equal(accepted.conflicts.length, 2);
  const stored = await f.ctx.db.get(draft._id);
  assert.equal(stored.revision, 2);
  assert.equal(stored.spec.jacket.breast, "double");
  assert.equal(stored.spec.jacket.buttons, "six_by_two");
  assert.equal(stored.spec.jacket.lapel, "peak");
  assert.equal(stored.lastSavedAt, NOW + 2);
  assert.equal(specHash(stored.spec), specHash(accepted.spec));
});

test("conflicts are reported in the words the client reads, not engine codes (S08)", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const proposal = await drafts.commitChange(f.ctx, draft, { jacket: { breast: "double" } }, false, NOW + 1);
  assert.deepEqual(
    proposal.conflicts.map((conflict) => `${conflict.label}: ${conflict.from} → ${conflict.to}`),
    ["Button stance: Two buttons → Six buttons, two to close", "Lapel: Notch lapel → Peak lapel"],
  );
  const tuxedo = await drafts.commitChange(
    f.ctx,
    draft,
    { garment: "tuxedo", jacket: { ticketPocket: true, vents: "single" }, trousers: { hem: "cuffed" } },
    false,
    NOW + 2,
  );
  assert.deepEqual(
    tuxedo.conflicts.map((conflict) => `${conflict.label}: ${conflict.from} → ${conflict.to}`),
    [
      "Pockets: Flap pockets → Jetted pockets",
      "Ticket pocket: Yes → No",
      "Vents: Single vent → No vent",
      "Trouser hem: Cuffed hem → Plain hem",
    ],
  );
});

test("a change confirmed against an older revision is refused with the current design, and nothing is written", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  // Tab B writes first: the design becomes double-breasted (revision 2).
  const tabB = await drafts.commitChange(
    f.ctx,
    draft,
    { jacket: { breast: "double" } },
    { acceptedConflicts: true, baseRevision: 1 },
    NOW + 1,
  );
  assert.equal(tabB.applied, true);
  assert.equal(tabB.revision, 2);
  const current = await f.ctx.db.get(draft._id);

  // Tab A previewed "shawl lapel" on the single-breasted design and confirmed "Two buttons → One button".
  const written = f.log.patches.length;
  await assert.rejects(
    drafts.commitChange(
      f.ctx,
      current,
      { jacket: { lapel: "shawl" } },
      { acceptedConflicts: true, baseRevision: 1 },
      NOW + 2,
    ),
    (error) => {
      assert.ok(isAppError("STALE_REVISION")(error));
      assert.equal(error.data.details.baseRevision, 1);
      assert.equal(error.data.details.currentRevision, 2);
      assert.equal(specHash(error.data.details.spec), specHash(current.spec), "the answer carries the current design");
      return true;
    },
  );
  assert.equal(f.log.patches.length, written, "a stale write changes nothing");
  assert.equal((await f.ctx.db.get(draft._id)).revision, 2);

  // Previewed again on the current design, the same change is a different conflict: the shawl is
  // refused on a double-breasted two-piece, which the client now sees instead of a false "saved".
  const again = await drafts.commitChange(
    f.ctx,
    current,
    { jacket: { lapel: "shawl" } },
    { acceptedConflicts: true, baseRevision: 2 },
    NOW + 3,
  );
  assert.equal(again.applied, false);
  assert.equal(again.revision, 2);
  assert.deepEqual(
    again.conflicts.map((conflict) => `${conflict.label}: ${conflict.from} → ${conflict.to}`),
    ["Lapel: Shawl lapel → Peak lapel"],
  );

  // Without a base revision the guard is off (a bare boolean is `{ acceptedConflicts }`), as before.
  const stored = await f.ctx.db.get(draft._id);
  const unguarded = await drafts.commitChange(f.ctx, stored, { jacket: { vents: "none" } }, false, NOW + 4);
  assert.equal(unguarded.applied, true);
  assert.equal(unguarded.revision, 3);
  // An empty patch stays a no-op whatever revision it names.
  const empty = await drafts.commitChange(f.ctx, stored, {}, { acceptedConflicts: false, baseRevision: 1 }, NOW + 5);
  assert.equal(empty.applied, false);
});

test("a change with no conflicts is written as the next revision; a no-op change is not", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const result = await drafts.commitChange(
    f.ctx,
    draft,
    { clothCode: CLOTHS[0], jacket: { vents: "single" } },
    false,
    NOW + 1,
  );
  assert.equal(result.applied, true);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.revision, 2);
  const stored = await f.ctx.db.get(draft._id);
  assert.equal(stored.spec.clothCode, CLOTHS[0]);
  assert.ok(stored.completedSteps.includes("cloth"), "choosing a cloth completes the cloth step");
  const again = await drafts.commitChange(f.ctx, stored, { jacket: { vents: "single" } }, false, NOW + 2);
  assert.equal(again.applied, false);
  assert.equal(again.revision, 2);
  const empty = await drafts.commitChange(f.ctx, stored, { jacket: {} }, false, NOW + 3);
  assert.equal(empty.applied, false);
});

test("materials in a change must exist in the catalogue; monogram text is a field error", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  await assert.rejects(
    drafts.commitChange(f.ctx, draft, { clothCode: "not-a-cloth" }, false, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    drafts.commitChange(f.ctx, draft, { buttonCode: "btn-nope" }, false, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    drafts.commitChange(
      f.ctx,
      draft,
      { monogram: { text: "N1", placement: "cuff", thread: "gold", font: "block" } },
      false,
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    drafts.commitChange(
      f.ctx,
      draft,
      { monogram: { text: "NCSXY", placement: "cuff", thread: "gold", font: "block" } },
      false,
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  const ok = await drafts.commitChange(
    f.ctx,
    draft,
    { monogram: { text: "n.s.", placement: "cuff", thread: "gold", font: "block" } },
    false,
    NOW,
  );
  assert.equal(ok.applied, true);
  assert.equal(ok.spec.monogram.text, "N.S.");
  assert.ok((await f.ctx.db.get(draft._id)).completedSteps.includes("details"));
});

test("the shortlist holds at most three catalogue cloths", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  await assert.rejects(drafts.setShortlist(f.ctx, draft, CLOTHS.slice(0, 4), NOW), isAppError("INVALID_INPUT"));
  await assert.rejects(drafts.setShortlist(f.ctx, draft, ["not-a-cloth"], NOW), isAppError("INVALID_INPUT"));
  assert.deepEqual((await f.ctx.db.get(draft._id)).shortlist, [], "a refused shortlist writes nothing");
  const kept = await drafts.setShortlist(f.ctx, draft, [CLOTHS[0], CLOTHS[1], CLOTHS[1], CLOTHS[2]], NOW);
  assert.deepEqual(kept, CLOTHS.slice(0, 3), "duplicates collapse before the cap is counted");
  assert.deepEqual((await f.ctx.db.get(draft._id)).shortlist, CLOTHS.slice(0, 3));
  assert.deepEqual(await drafts.setShortlist(f.ctx, draft, [], NOW), []);
});

test("a submitted draft refuses every design edit but still reads, renames and remembers its stage", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  await f.ctx.db.patch(draft._id, { status: "submitted" });
  const submitted = await f.ctx.db.get(draft._id);
  const before = f.log.patches.length;
  await assert.rejects(
    drafts.commitChange(f.ctx, submitted, { jacket: { vents: "none" } }, true, NOW),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(drafts.setOccasion(f.ctx, submitted, { occasion: "wedding" }, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(drafts.setShortlist(f.ctx, submitted, [CLOTHS[0]], NOW), isAppError("INVALID_STATE"));
  await assert.rejects(drafts.setFitRoute(f.ctx, submitted, "remote", NOW), isAppError("INVALID_STATE"));
  await assert.rejects(drafts.applyLook(f.ctx, submitted, LOOKS[0].key, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(drafts.archiveDraft(f.ctx, submitted, guestActor, NOW), isAppError("INVALID_STATE"));
  assert.equal(f.log.patches.length, before, "nothing was written");
  const empty = await drafts.commitChange(f.ctx, submitted, {}, false, NOW);
  assert.equal(empty.applied, false);
  assert.equal(empty.revision, submitted.revision);
  await drafts.renameDraft(f.ctx, submitted, "  For the wedding  ", NOW);
  await drafts.setStage(f.ctx, submitted, "review", NOW);
  const after = await f.ctx.db.get(draft._id);
  assert.equal(after.name, "For the wedding");
  assert.equal(after.stage, "review");
  assert.equal(after.status, "submitted");
});

test("an archived draft is read-only and archiving is idempotent", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  await drafts.archiveDraft(f.ctx, draft, guestActor, NOW);
  const archived = await f.ctx.db.get(draft._id);
  assert.equal(archived.status, "archived");
  assert.ok(f.rowsOf("atelierAuditLog").some((row) => row.action === "draft.archive" && row.targetId === draft._id));
  await assert.rejects(drafts.renameDraft(f.ctx, archived, "x", NOW), isAppError("INVALID_STATE"));
  await assert.rejects(drafts.setStage(f.ctx, archived, "cloth", NOW), isAppError("INVALID_STATE"));
  await assert.rejects(
    drafts.commitChange(f.ctx, archived, { garment: "tuxedo" }, true, NOW),
    isAppError("INVALID_STATE"),
  );
  const writes = f.log.patches.length;
  await drafts.archiveDraft(f.ctx, archived, guestActor, NOW);
  assert.equal(f.log.patches.length, writes);
  assert.equal((await drafts.listMine(f.ctx, guestActor)).length, 0, "archived drafts leave the list");
});

test("occasion, fit route and stage are saved without touching the revision", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  await drafts.setOccasion(
    f.ctx,
    draft,
    { occasion: "black_tie", eventDate: NOW + 90 * DAY, intendedUse: "  A gala  " },
    NOW + 1,
  );
  await drafts.setFitRoute(f.ctx, await f.ctx.db.get(draft._id), "atelier", NOW + 2);
  await drafts.setStage(f.ctx, await f.ctx.db.get(draft._id), "fit", NOW + 3);
  const stored = await f.ctx.db.get(draft._id);
  assert.equal(stored.occasion, "black_tie");
  assert.equal(stored.eventDate, NOW + 90 * DAY);
  assert.equal(stored.intendedUse, "A gala");
  assert.equal(stored.fitRoute, "atelier");
  assert.equal(stored.stage, "fit");
  assert.equal(stored.revision, 1);
  assert.deepEqual(stored.completedSteps, ["occasion", "style", "fit"]);
  await assert.rejects(
    drafts.setOccasion(f.ctx, stored, { occasion: "wedding", eventDate: Number.NaN }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await drafts.setOccasion(f.ctx, stored, { occasion: "wedding" }, NOW + 4);
  assert.equal((await f.ctx.db.get(draft._id)).eventDate, undefined, "leaving the date out clears it");
});

test("applyLook replaces the design whole and records the look", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const look = LOOKS[3];
  const result = await drafts.applyLook(f.ctx, draft, look.key, NOW + 1);
  assert.equal(result.applied, true);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.revision, 2);
  const stored = await f.ctx.db.get(draft._id);
  assert.deepEqual(stored.spec, look.spec);
  assert.equal(stored.lookKey, look.key);
  const again = await drafts.applyLook(f.ctx, stored, look.key, NOW + 2);
  assert.equal(again.applied, false);
  await assert.rejects(drafts.applyLook(f.ctx, stored, "nope", NOW), isAppError("INVALID_INPUT"));
});

test("the view carries warnings from revalidate and never the guest key", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f, guestActor, { lookKey: LOOKS[0].key });
  let view = await drafts.toDraftView(f.ctx, draft, NOW);
  assert.deepEqual(view.warnings, []);
  assert.equal(view.cloth.code, LOOKS[0].spec.clothCode);
  assert.equal(view.ownedByAccount, false);
  assert.equal(view.hasPhoto, false);
  assert.equal(view.currentPreview, null);
  assert.equal(view.fitProfile, null);
  assert.equal(view.specHash, specHash(draft.spec));
  assert.ok(view.lines.some((line) => line.label === "Lapel" && line.productionId === "LAPEL_PEAK"));
  assert.ok(!("guestKey" in view) && !("userId" in view));

  const entry = f
    .rowsOf("atelierCatalogueEntries")
    .find((row) => row.kind === "cloth" && row.code === draft.spec.clothCode);
  entry.inStock = false;
  view = await drafts.toDraftView(f.ctx, draft, NOW);
  assert.deepEqual(
    view.warnings.map((warning) => warning.code),
    ["cloth_out_of_stock"],
  );
  entry.status = "withdrawn";
  await f.ctx.db.insert("atelierCatalogueVersions", { version: 2, publishedAt: NOW, note: "autumn book" });
  await f.ctx.db.patch(draft._id, { eventDate: NOW + 10 * DAY });
  view = await drafts.toDraftView(f.ctx, await f.ctx.db.get(draft._id), NOW);
  assert.deepEqual(
    view.warnings.map((warning) => warning.code),
    ["cloth_withdrawn", "catalogue_changed", "event_unlikely"],
  );
  assert.match(view.warnings[0].message, /no longer offered/);
});

test("a finished preview of an earlier design is flagged stale and not current", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const photoId = await f.ctx.db.insert("atelierPersonPhotos", { guestKey: GUEST_KEY, status: "active" });
  const jobId = await f.ctx.db.insert("atelierPreviewJobs", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    personPhotoId: photoId,
    specHash: specHash(draft.spec),
    status: "done",
  });
  await f.ctx.db.patch(draft._id, { personPhotoId: photoId, currentPreviewJobId: jobId });
  let view = await drafts.toDraftView(f.ctx, await f.ctx.db.get(draft._id), NOW);
  assert.equal(view.hasPhoto, true);
  assert.deepEqual(view.currentPreview, { jobId, status: "done", specHash: specHash(draft.spec), isCurrent: true });
  assert.deepEqual(view.warnings, []);
  await drafts.commitChange(f.ctx, await f.ctx.db.get(draft._id), { jacket: { lapel: "peak" } }, false, NOW + 1);
  const moved = await f.ctx.db.get(draft._id);
  assert.equal(moved.currentPreviewJobId, jobId, "the job is left in place; the hashes say it is stale");
  view = await drafts.toDraftView(f.ctx, moved, NOW + 1);
  assert.equal(view.currentPreview.isCurrent, false);
  assert.deepEqual(
    view.warnings.map((warning) => warning.code),
    ["preview_stale"],
  );
  assert.ok(!view.completedSteps.includes("preview"));
});

test("listMine shows the account's drafts and flags the browser's guest drafts as linkable", async () => {
  const f = fakeCtx();
  await makeDraft(f, guestActor, {}, NOW);
  await makeDraft(f, accountActor, { lookKey: LOOKS[1].key }, NOW + 1);
  await makeDraft(f, otherGuestActor, {}, NOW + 2);
  const asGuest = await drafts.listMine(f.ctx, guestActor);
  assert.equal(asGuest.length, 1);
  assert.equal(asGuest[0].linkable, false, "a guest alone has nothing to link to");
  const signedInWithGuestKey = await drafts.listMine(f.ctx, { user: accountUser, guestKey: GUEST_KEY });
  assert.deepEqual(
    signedInWithGuestKey.map((summary) => [summary.ownedByAccount, summary.linkable]),
    [
      [true, false],
      [false, true],
    ],
  );
  assert.equal(signedInWithGuestKey[0].summary.length > 0, true);
  assert.ok(signedInWithGuestKey.every((summary) => !("guestKey" in summary)));
  const stranger = await drafts.listMine(f.ctx, strangerActor);
  assert.deepEqual(stranger, []);
});

test("findAccessible returns another owner's draft as null", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  assert.ok(await drafts.findAccessible(f.ctx, draft._id, guestActor));
  assert.equal(await drafts.findAccessible(f.ctx, draft._id, otherGuestActor), null);
  assert.equal(await drafts.findAccessible(f.ctx, draft._id, accountActor), null);
  assert.equal(await drafts.findAccessible(f.ctx, "atelierDrafts|999", guestActor), null);
});

test("link moves the draft and what hangs off it to the account, and only with the right key", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f);
  const other = await makeDraft(f, otherGuestActor);
  const photoId = await f.ctx.db.insert("atelierPersonPhotos", { guestKey: GUEST_KEY, status: "active" });
  const otherPhotoId = await f.ctx.db.insert("atelierPersonPhotos", { guestKey: OTHER_GUEST_KEY, status: "active" });
  const jobId = await f.ctx.db.insert("atelierPreviewJobs", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    status: "queued",
  });
  const otherJobId = await f.ctx.db.insert("atelierPreviewJobs", {
    guestKey: GUEST_KEY,
    draftId: other._id,
    status: "queued",
  });
  const caseId = await f.ctx.db.insert("atelierCases", { guestKey: GUEST_KEY, draftId: draft._id, kind: "sample" });
  const appointmentId = await f.ctx.db.insert("atelierAppointments", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    status: "requested",
  });
  const orderId = await f.ctx.db.insert("atelierOrders", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    status: "preflight",
  });
  const correctionId = await f.ctx.db.insert("atelierCorrections", {
    guestKey: GUEST_KEY,
    orderId,
    status: "requested",
  });
  const privacyId = await f.ctx.db.insert("atelierPrivacyRequests", { guestKey: GUEST_KEY, kind: "export" });
  const shareId = await f.ctx.db.insert("atelierShares", {
    guestKey: GUEST_KEY,
    draftId: draft._id,
    token: "t1",
    audience: "a",
    expiresAt: NOW + DAY,
    createdAt: NOW,
  });
  const otherShareId = await f.ctx.db.insert("atelierShares", {
    guestKey: OTHER_GUEST_KEY,
    draftId: other._id,
    token: "t2",
    audience: "b",
    expiresAt: NOW + DAY,
    createdAt: NOW,
  });

  await assert.rejects(drafts.linkDraft(f.ctx, accountUser, draft._id, OTHER_GUEST_KEY, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(
    drafts.linkDraft(f.ctx, accountUser, "atelierDrafts|999", GUEST_KEY, NOW),
    isAppError("NOT_FOUND"),
  );
  assert.equal((await f.ctx.db.get(draft._id)).guestKey, GUEST_KEY, "a wrong key moves nothing");

  await drafts.linkDraft(f.ctx, accountUser, draft._id, GUEST_KEY, NOW + 5);
  const moved = await f.ctx.db.get(draft._id);
  assert.equal(moved.userId, accountUser._id);
  assert.equal(moved.guestKey, undefined);
  assert.equal(moved.lastSavedAt, NOW + 5);
  for (const id of [photoId, jobId, caseId, appointmentId, orderId, correctionId, privacyId, shareId]) {
    const row = await f.ctx.db.get(id);
    assert.equal(row.userId, accountUser._id, `${id} moved`);
    assert.equal(row.guestKey, undefined, `${id} lost its guest key`);
  }
  for (const id of [other._id, otherPhotoId, otherJobId, otherShareId]) {
    const row = await f.ctx.db.get(id);
    assert.equal(row.userId, undefined, `${id} stays where it was`);
  }
  assert.equal(
    (await f.ctx.db.get(otherJobId)).guestKey,
    GUEST_KEY,
    "this guest's job on another draft stays a guest job",
  );
  assert.ok(
    f
      .rowsOf("atelierAuditLog")
      .some((row) => row.action === "draft.link" && row.targetId === draft._id && row.actorKind === "client"),
  );

  const writes = f.log.patches.length;
  await drafts.linkDraft(f.ctx, accountUser, draft._id, GUEST_KEY, NOW + 6);
  assert.equal(f.log.patches.length, writes, "linking again is a no-op");
  await assert.rejects(
    drafts.linkDraft(f.ctx, { ...accountUser, _id: "users|2" }, draft._id, GUEST_KEY, NOW),
    isAppError("NOT_FOUND"),
  );
  assert.ok(await drafts.findAccessible(f.ctx, draft._id, accountActor));
  assert.equal(await drafts.findAccessible(f.ctx, draft._id, guestActor), null, "the old key no longer opens it");
});

/** A group with one joined participant: the organizer's row, the group, the participant and the design it made. */
async function groupDraft(f, actor, overrides = {}, now = NOW) {
  const organizer = await f.ctx.db.get(
    await f.ctx.db.insert("users", { clerkId: "clerk_kwame", role: "user", name: "Kwame Mensah", createdAt: 1 }),
  );
  const groupId = await groups.createGroup(
    f.ctx,
    organizer,
    {
      name: "Mensah wedding party",
      eventDate: now + 120 * DAY,
      occasion: "wedding",
      brief: "",
      sharedSpec: { ...DEFAULT_SPEC, clothCode: null },
      permittedIndividual: ["liningCode", "monogram", "trousers.hem"],
      ...overrides,
    },
    now,
  );
  const { participantId, inviteToken } = await groups.inviteParticipant(
    f.ctx,
    organizer,
    groupId,
    { name: "Yaw" },
    now,
  );
  const { draftId } = await groups.joinGroup(f.ctx, actor, inviteToken, now + 1);
  return { organizer, group: await f.ctx.db.get(groupId), participantId, draftId };
}

test("a group design may move only the lines the brief leaves to each participant, and the cloth when it is open (C28)", async () => {
  const f = fakeCtx();
  await makeDraft(f, otherGuestActor); // seeds the catalogue
  const { organizer, group, participantId, draftId } = await groupDraft(f, guestActor);
  let draft = await f.ctx.db.get(draftId);
  assert.equal(draft.groupId, group._id);

  // A shared line is refused by name before anything is proposed or written, accepted conflicts or not.
  const written = f.log.patches.length;
  await assert.rejects(drafts.commitChange(f.ctx, draft, { garment: "tuxedo" }, true, NOW + 2), (error) => {
    assert.ok(isAppError("INVALID_STATE")(error));
    assert.equal(error.data.details.field, "garment");
    assert.equal(error.data.details.groupId, group._id);
    assert.match(error.data.message, /^Garment follows the shared design for Mensah wedding party/);
    return true;
  });
  await assert.rejects(
    drafts.commitChange(f.ctx, draft, { jacket: { lapel: "peak" } }, false, NOW + 2),
    (error) => isAppError("INVALID_STATE")(error) && error.data.details.field === "jacket.lapel",
  );
  assert.equal(f.log.patches.length, written, "a refused change writes nothing");
  assert.deepEqual((await f.ctx.db.get(draftId)).spec, { ...DEFAULT_SPEC, clothCode: null });

  // The brief leaves the cloth open, so it is the participant's; so are the permitted lines.
  assert.equal((await drafts.commitChange(f.ctx, draft, { clothCode: CLOTHS[0] }, false, NOW + 3)).applied, true);
  draft = await f.ctx.db.get(draftId);
  const permitted = await drafts.commitChange(
    f.ctx,
    draft,
    {
      liningCode: LINING_SEED[0].code,
      trousers: { hem: "cuffed" },
      monogram: { text: "Y.M.", placement: "cuff", thread: "gold", font: "block" },
    },
    false,
    NOW + 4,
  );
  assert.equal(permitted.applied, true);
  draft = await f.ctx.db.get(draftId);
  assert.equal(draft.spec.liningCode, LINING_SEED[0].code);
  assert.equal(draft.spec.trousers.hem, "cuffed");

  // A recommended look replaces the whole design, so it is refused as the first shared line it would move.
  const look = LOOKS.find((candidate) =>
    specDifferences(group.sharedSpec, candidate.spec).some(
      (path) => path !== "clothCode" && !group.permittedIndividual.includes(path),
    ),
  );
  assert.ok(look, "a look that departs from the brief exists");
  await assert.rejects(drafts.applyLook(f.ctx, draft, look.key, NOW + 5), isAppError("INVALID_STATE"));
  assert.equal((await f.ctx.db.get(draftId)).revision, draft.revision);

  // The organizer moves the brief: lines already apart from it are not re-litigated, a permitted change
  // still goes through, a shared line may be brought back into agreement but not moved anywhere else.
  await groups.updateGroup(
    f.ctx,
    organizer,
    group._id,
    { sharedSpec: { ...DEFAULT_SPEC, clothCode: null, jacket: { ...DEFAULT_SPEC.jacket, lapelWidth: "wide" } } },
    NOW + 6,
  );
  draft = await f.ctx.db.get(draftId);
  assert.equal((await drafts.commitChange(f.ctx, draft, { trousers: { hem: "plain" } }, false, NOW + 7)).applied, true);
  draft = await f.ctx.db.get(draftId);
  await assert.rejects(
    drafts.commitChange(f.ctx, draft, { jacket: { lapelWidth: "slim" } }, false, NOW + 8),
    (error) => isAppError("INVALID_STATE")(error) && error.data.details.field === "jacket.lapelWidth",
  );
  assert.equal(
    (await drafts.commitChange(f.ctx, draft, { jacket: { lapelWidth: "wide" } }, false, NOW + 9)).applied,
    true,
    "back into agreement with the brief",
  );

  // Leaving the group makes the design private again.
  await groups.leaveGroup(f.ctx, guestActor, participantId, NOW + 10);
  draft = await f.ctx.db.get(draftId);
  assert.equal(draft.groupId, undefined);
  assert.equal((await drafts.commitChange(f.ctx, draft, { garment: "tuxedo" }, true, NOW + 11)).applied, true);
});

test("a brief that fixes the cloth keeps the participant to it", async () => {
  const f = fakeCtx();
  await makeDraft(f, otherGuestActor);
  const { draftId } = await groupDraft(f, guestActor, { sharedSpec: { ...DEFAULT_SPEC, clothCode: CLOTHS[0] } });
  const draft = await f.ctx.db.get(draftId);
  assert.equal(draft.spec.clothCode, CLOTHS[0]);
  await assert.rejects(
    drafts.commitChange(f.ctx, draft, { clothCode: CLOTHS[1] }, false, NOW + 2),
    (error) => isAppError("INVALID_STATE")(error) && error.data.details.field === "clothCode",
  );
  assert.equal(
    (await drafts.commitChange(f.ctx, draft, { liningCode: LINING_SEED[0].code }, false, NOW + 3)).applied,
    true,
  );
});

test("link carries a guest's group participation to the account, and no one else's (C28)", async () => {
  const f = fakeCtx();
  const { organizer, group, participantId, draftId } = await groupDraft(f, guestActor);
  const kofi = await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Kofi" }, NOW + 2);
  const { draftId: kofiDraft } = await groups.joinGroup(f.ctx, otherGuestActor, kofi.inviteToken, NOW + 3);
  assert.equal((await f.ctx.db.get(participantId)).userId, undefined, "a guest's participation names no account");

  await drafts.linkDraft(f.ctx, accountUser, draftId, GUEST_KEY, NOW + 5);
  const participant = await f.ctx.db.get(participantId);
  assert.equal(participant.userId, accountUser._id);
  assert.equal(participant.draftId, draftId);
  assert.equal(participant.status, "joined");
  const other = await f.ctx.db.get(kofi.participantId);
  assert.equal(other.userId, undefined, "another participant of the same group is untouched");
  assert.equal((await f.ctx.db.get(kofiDraft)).guestKey, OTHER_GUEST_KEY);
  const entry = f.rowsOf("atelierAuditLog").find((row) => row.action === "draft.link" && row.targetId === draftId);
  assert.equal(entry.meta.participants, 1);

  // The participation now reads as the account's: its fit readiness can come from the account's profile.
  const view = await groups.participationForDraft(f.ctx, await f.ctx.db.get(draftId));
  assert.equal(view.participantId, participantId);
});

test("duplicate keeps history: a new draft named (again), the source untouched, warnings from the old catalogue", async () => {
  const f = fakeCtx();
  const source = await makeDraft(f, accountActor, { lookKey: LOOKS[2].key, occasion: "business" });
  await drafts.setFitRoute(f.ctx, source, "atelier", NOW);
  await f.ctx.db.patch(source._id, { status: "submitted" });
  const orderId = await f.ctx.db.insert("atelierOrders", {
    userId: accountUser._id,
    draftId: source._id,
    status: "accepted",
  });
  const foreignOrderId = await f.ctx.db.insert("atelierOrders", {
    guestKey: OTHER_GUEST_KEY,
    draftId: source._id,
    status: "accepted",
  });
  const submitted = await f.ctx.db.get(source._id);
  await assert.rejects(
    drafts.duplicateDraft(f.ctx, accountActor, submitted, foreignOrderId, NOW),
    isAppError("NOT_FOUND"),
  );

  await f.ctx.db.insert("atelierCatalogueVersions", { version: 2, publishedAt: NOW, note: "new book" });
  const copyId = await drafts.duplicateDraft(f.ctx, accountActor, submitted, orderId, NOW + 1);
  const copy = await f.ctx.db.get(copyId);
  assert.notEqual(copyId, source._id);
  assert.equal(copy.name, `${LOOKS[2].name} (again)`);
  assert.equal(copy.status, "draft");
  assert.equal(copy.revision, 1);
  assert.equal(copy.stage, "review");
  assert.equal(copy.sourceOrderId, orderId);
  assert.equal(copy.userId, accountUser._id);
  assert.equal(copy.catalogueVersion, submitted.catalogueVersion);
  assert.deepEqual(copy.spec, submitted.spec);
  assert.equal(copy.fitRoute, "atelier");
  assert.equal(copy.currentPreviewJobId, undefined);
  assert.equal((await f.ctx.db.get(source._id)).status, "submitted", "the source is untouched");
  const view = await drafts.toDraftView(f.ctx, copy, NOW);
  assert.deepEqual(
    view.warnings.map((warning) => warning.code),
    ["catalogue_changed"],
  );
  assert.ok(f.rowsOf("atelierAuditLog").some((row) => row.action === "draft.duplicate" && row.targetId === copyId));
});

test("the export is the same lines as the view with exportedAt left to the client", async () => {
  const f = fakeCtx();
  const draft = await makeDraft(f, accountActor, { lookKey: LOOKS[0].key });
  const exported = await drafts.toDraftExport(f.ctx, draft);
  const view = await drafts.toDraftView(f.ctx, draft, NOW);
  assert.deepEqual(exported.lines, view.lines);
  assert.equal(exported.exportedAt, null);
  assert.equal(exported.specHash, view.specHash);
  assert.deepEqual(Object.keys(exported).sort(), ["exportedAt", "lines", "name", "revision", "spec", "specHash"]);
});
