import assert from "node:assert/strict";
import test from "node:test";
import {
  accountActor,
  accountUser,
  fakeCtx,
  GUEST_KEY,
  guestActor,
  isAppError,
  otherGuestActor,
  strangerActor,
} from "./atelier-fake-ctx.mjs";

const groups = await import("../convex/model/atelier/groups.ts");
const { ATELIER_LIMITS, GROUP_STATUSES } = await import("../convex/shared/atelier/enums.ts");
const { DEFAULT_SPEC } = await import("../convex/shared/atelier/spec.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;
const CLOTH = CLOTH_SEED[0].code;

/** Wraps the fake db so a test can see which tables a read touched. */
function withTableLog(f) {
  const touched = new Set();
  const { query, get } = f.ctx.db;
  f.ctx.db.query = (table) => {
    touched.add(table);
    return query.call(f.ctx.db, table);
  };
  f.ctx.db.get = async (id) => {
    touched.add(String(id).split("|")[0]);
    return get.call(f.ctx.db, id);
  };
  return touched;
}

async function setup() {
  const f = fakeCtx();
  const insertUser = async (doc) =>
    f.ctx.db.get(await f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc }));
  // The fake db numbers ids globally; these two rows give the fixture actors (users|1, users|2) real accounts.
  assert.equal((await insertUser({ name: accountUser.name }))._id, accountUser._id);
  assert.equal((await insertUser({ name: "Someone Else" }))._id, strangerActor.user._id);
  const organizer = await insertUser({ name: "Kwame Mensah", email: "kwame@example.com" });
  const concierge = await insertUser({ name: "Adaeze Nwosu", staffRoles: ["concierge"] });
  return { f, organizer, concierge };
}

function groupInput(overrides = {}) {
  return {
    name: "Mensah wedding party",
    eventDate: NOW + 120 * DAY,
    occasion: "wedding",
    brief: "Midnight navy, peak lapels, one row of buttons; each man picks his own lining.",
    sharedSpec: { ...DEFAULT_SPEC, clothCode: null },
    permittedIndividual: ["liningCode", "monogram"],
    ...overrides,
  };
}

async function groupWith(f, organizer, overrides = {}) {
  const groupId = await groups.createGroup(f.ctx, organizer, groupInput(overrides), NOW);
  return f.ctx.db.get(groupId);
}

test("the permitted-individual allow-list is fixed: unknown paths are refused, known ones are kept in order", async () => {
  assert.deepEqual(groups.normalizePermittedIndividual(["monogram", "jacket.vents", "monogram"]), [
    "jacket.vents",
    "monogram",
  ]);
  assert.deepEqual(groups.normalizePermittedIndividual([]), []);
  for (const path of ["jacket.lapel", "garment", "clothCode", "jacket", "trousers.rise", ""]) {
    assert.throws(() => groups.normalizePermittedIndividual([path]), isAppError("INVALID_INPUT"), path);
  }
  assert.deepEqual(
    [...groups.PERMITTED_INDIVIDUAL_PATHS],
    [
      "jacket.vents",
      "jacket.pockets",
      "jacket.ticketPocket",
      "jacket.sleeveButtons",
      "jacket.workingCuffs",
      "trousers.pleats",
      "trousers.hem",
      "trousers.waistband",
      "trousers.fit",
      "monogram",
      "liningCode",
    ],
  );

  const { f, organizer } = await setup();
  await assert.rejects(
    groups.createGroup(f.ctx, organizer, groupInput({ permittedIndividual: ["jacket.lapel"] }), NOW),
    isAppError("INVALID_INPUT"),
  );
  assert.equal(f.rowsOf("atelierGroups").length, 0);
});

test("the shared design may leave the cloth open but must otherwise be valid", async () => {
  assert.deepEqual(groups.validateSharedSpec({ ...DEFAULT_SPEC, clothCode: null }), []);
  const badStance = { ...DEFAULT_SPEC, jacket: { ...DEFAULT_SPEC.jacket, breast: "double" } };
  assert.ok(groups.validateSharedSpec(badStance).length > 0);

  const { f, organizer } = await setup();
  await assert.rejects(
    groups.createGroup(f.ctx, organizer, groupInput({ sharedSpec: badStance }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    groups.createGroup(
      f.ctx,
      organizer,
      groupInput({ sharedSpec: { ...DEFAULT_SPEC, clothCode: "not-a-cloth" } }),
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    groups.createGroup(f.ctx, organizer, groupInput({ eventDate: NOW - 30 * DAY }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    groups.createGroup(f.ctx, organizer, groupInput({ name: "   " }), NOW),
    isAppError("INVALID_INPUT"),
  );

  const group = await groupWith(f, organizer);
  assert.equal(group.status, "draft");
  assert.equal(group.organizerUserId, organizer._id);
  assert.deepEqual(group.permittedIndividual, ["monogram", "liningCode"]);
  assert.ok(f.rowsOf("atelierAuditLog").some((row) => row.action === "group.create" && row.targetId === group._id));
});

test("a group holds at most ATELIER_LIMITS.groupMaxParticipants live participants; declined ones free a place", async () => {
  const { f, organizer } = await setup();
  const group = await groupWith(f, organizer);
  const invited = [];
  for (let i = 0; i < ATELIER_LIMITS.groupMaxParticipants; i += 1) {
    invited.push(await groups.inviteParticipant(f.ctx, organizer, group._id, { name: `Guest ${i + 1}` }, NOW + i));
  }
  assert.equal((await f.ctx.db.get(group._id)).status, "inviting", "the first invitation moves the group out of draft");
  assert.ok(invited.every(({ inviteToken }) => /^[a-f0-9]{32}$/.test(inviteToken)));
  assert.equal(new Set(invited.map(({ inviteToken }) => inviteToken)).size, invited.length);

  await assert.rejects(
    groups.inviteParticipant(f.ctx, organizer, group._id, { name: "One too many" }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await groups.removeParticipant(f.ctx, organizer, invited[0].participantId, NOW);
  assert.equal((await f.ctx.db.get(invited[0].participantId)).status, "declined");
  const replacement = await groups.inviteParticipant(
    f.ctx,
    organizer,
    group._id,
    { name: "Late addition", email: " Late@Example.COM " },
    NOW,
  );
  assert.equal((await f.ctx.db.get(replacement.participantId)).email, "late@example.com");
  const queued = f.rowsOf("atelierNotifications");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].status, "queued");
  assert.equal(queued[0].to, "late@example.com");
  assert.equal(queued[0].userId, organizer._id);

  await assert.rejects(
    groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Bad mail", email: "nope" }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    groups.inviteParticipant(f.ctx, organizer, group._id, { name: "" }, NOW),
    isAppError("INVALID_INPUT"),
  );
});

test("joining creates a private design from the shared brief and hands it to whoever accepted", async () => {
  const { f, organizer } = await setup();
  const group = await groupWith(f, organizer, { sharedSpec: { ...DEFAULT_SPEC, clothCode: null } });
  const { participantId, inviteToken } = await groups.inviteParticipant(
    f.ctx,
    organizer,
    group._id,
    { name: "Yaw" },
    NOW,
  );

  const invite = await groups.inviteByToken(f.ctx, inviteToken);
  assert.equal(invite.groupName, group.name);
  assert.equal(invite.organizerFirstName, "Kwame");
  assert.equal(invite.participantName, "Yaw");
  assert.deepEqual(invite.permittedIndividual, ["monogram", "liningCode"]);
  assert.ok(invite.sharedLines.some((line) => line.label === "Cloth" && line.value === "Not yet chosen"));
  assert.ok(!JSON.stringify(invite).includes("example.com"), "the invite never carries the organizer's contact");
  assert.equal(await groups.inviteByToken(f.ctx, "deadbeef"), null);
  assert.equal(await groups.inviteByToken(f.ctx, ""), null);

  const { draftId } = await groups.joinGroup(f.ctx, guestActor, inviteToken, NOW + DAY);
  const draft = await f.ctx.db.get(draftId);
  assert.equal(draft.guestKey, GUEST_KEY);
  assert.equal(draft.userId, undefined);
  assert.equal(draft.name, "Mensah wedding party — Yaw");
  assert.equal(draft.occasion, "wedding");
  assert.equal(draft.eventDate, group.eventDate);
  assert.deepEqual(draft.spec, group.sharedSpec);
  assert.equal(draft.stage, "cloth", "no shared cloth: the participant starts at the cloth step");
  assert.deepEqual(draft.completedSteps, ["occasion", "style"]);
  assert.equal(draft.revision, 1);
  assert.equal(draft.status, "draft");
  assert.equal(draft.groupId, group._id);
  assert.ok(draft.catalogueVersion >= 1, "the catalogue was seeded on the way");
  const participant = await f.ctx.db.get(participantId);
  assert.equal(participant.status, "joined");
  assert.equal(participant.draftId, draftId);
  assert.equal(participant.joinedAt, NOW + DAY);
  assert.equal(participant.userId, undefined);

  // Accepting again from the same browser is idempotent; from another browser it is refused.
  assert.deepEqual(await groups.joinGroup(f.ctx, guestActor, inviteToken, NOW + 2 * DAY), { draftId });
  assert.equal(f.rowsOf("atelierDrafts").length, 1);
  await assert.rejects(groups.joinGroup(f.ctx, otherGuestActor, inviteToken, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(groups.joinGroup(f.ctx, accountActor, inviteToken, NOW), isAppError("INVALID_STATE"));

  // A shared cloth starts the participant at style; an account participant is recorded by account.
  const clothed = await groupWith(f, organizer, {
    name: "Black tie dinner",
    occasion: "black_tie",
    sharedSpec: { ...DEFAULT_SPEC, clothCode: CLOTH },
  });
  const second = await groups.inviteParticipant(f.ctx, organizer, clothed._id, { name: "Nia" }, NOW);
  const joined = await groups.joinGroup(f.ctx, accountActor, second.inviteToken, NOW);
  const accountDraft = await f.ctx.db.get(joined.draftId);
  assert.equal(accountDraft.userId, accountUser._id);
  assert.equal(accountDraft.stage, "style");
  assert.ok(accountDraft.completedSteps.includes("cloth"));
  assert.equal((await f.ctx.db.get(second.participantId)).userId, accountUser._id);

  // Declined and closed invitations are nothing to join.
  await groups.removeParticipant(f.ctx, organizer, second.participantId, NOW);
  assert.equal(await groups.inviteByToken(f.ctx, second.inviteToken), null);
  await assert.rejects(groups.joinGroup(f.ctx, strangerActor, second.inviteToken, NOW), isAppError("NOT_FOUND"));
});

test("the organizer sees consented status only and never reads a measurement or photo table", async () => {
  const { f, organizer } = await setup();
  const group = await groupWith(f, organizer);
  const yaw = await groups.inviteParticipant(
    f.ctx,
    organizer,
    group._id,
    { name: "Yaw", email: "yaw@example.com" },
    NOW,
  );
  const nia = await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Nia" }, NOW + 1);
  const kofi = await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Kofi" }, NOW + 2);

  const { draftId: yawDraft } = await groups.joinGroup(f.ctx, guestActor, yaw.inviteToken, NOW);
  await f.ctx.db.patch(yawDraft, { spec: { ...DEFAULT_SPEC, clothCode: CLOTH } });
  const { draftId: niaDraft } = await groups.joinGroup(f.ctx, accountActor, nia.inviteToken, NOW);
  await f.ctx.db.patch(niaDraft, {
    spec: {
      ...DEFAULT_SPEC,
      clothCode: CLOTH,
      monogram: { text: "N.O", placement: "cuff", thread: "gold", font: "script" },
    },
  });
  await f.ctx.db.insert("atelierFitProfiles", {
    userId: accountUser._id,
    version: 1,
    units: "cm",
    measurements: { chest: 98.5, waist: 84 },
    comfort: { jacket: "tailored", trousers: "tailored", movement: [] },
    provenance: "atelier",
    uncertainFields: [],
    status: "approved",
    createdAt: NOW,
    updatedAt: NOW,
  });
  await f.ctx.db.insert("atelierPersonPhotos", {
    userId: accountUser._id,
    storageId: "storage|1",
    mimeType: "image/jpeg",
    width: 1200,
    height: 1800,
    consentVersion: "1",
    consentAt: NOW,
    providerDisclosureVersion: "1",
    status: "active",
    expiresAt: NOW + 30 * DAY,
    validation: { ok: true, reasons: [] },
    createdAt: NOW,
  });

  // Nobody has consented yet: joined, nothing more, and no fit table was opened.
  let touched = withTableLog(f);
  let view = await groups.groupView(f.ctx, await f.ctx.db.get(group._id));
  assert.deepEqual(
    view.participants.map((p) => [p.name, p.status, p.hasDesign, p.designReady, p.fitReady]),
    [
      ["Yaw", "joined", true, false, false],
      ["Nia", "joined", true, false, false],
      ["Kofi", "invited", false, false, false],
    ],
  );
  assert.ok(!touched.has("atelierFitProfiles"), "no consent to share fit: the fit table is never read");
  assert.ok(
    !touched.has("atelierPersonPhotos") && !touched.has("atelierFitPhotos") && !touched.has("atelierPreviewJobs"),
  );

  // Yaw shares style; Nia shares style and fit. The organizer learns readiness, nothing else.
  await groups.setParticipantConsent(
    f.ctx,
    guestActor,
    yaw.participantId,
    { shareStyleStatus: true, shareFitStatus: false },
    NOW,
  );
  await groups.setParticipantConsent(
    f.ctx,
    accountActor,
    nia.participantId,
    { shareStyleStatus: true, shareFitStatus: true },
    NOW,
  );
  await assert.rejects(
    groups.setParticipantConsent(
      f.ctx,
      otherGuestActor,
      yaw.participantId,
      { shareStyleStatus: true, shareFitStatus: true },
      NOW,
    ),
    isAppError("NOT_FOUND"),
  );
  await assert.rejects(
    groups.setParticipantConsent(
      f.ctx,
      strangerActor,
      nia.participantId,
      { shareStyleStatus: false, shareFitStatus: false },
      NOW,
    ),
    isAppError("NOT_FOUND"),
  );

  touched = withTableLog(f);
  view = await groups.groupView(f.ctx, await f.ctx.db.get(group._id));
  assert.deepEqual(
    view.participants.map((p) => [p.name, p.status, p.statusLabel, p.designReady, p.fitReady]),
    [
      ["Yaw", "design_ready", "Design ready", true, false],
      ["Nia", "fit_ready", "Fit ready", true, true],
      ["Kofi", "invited", "Invited", false, false],
    ],
  );
  assert.ok(
    !touched.has("atelierPersonPhotos") && !touched.has("atelierFitPhotos"),
    "photo tables are never read for a group view",
  );
  const serialized = JSON.stringify(view);
  for (const secret of [
    GUEST_KEY,
    "yaw@example.com",
    "98.5",
    "chest",
    "N.O",
    "storage|",
    "measurements",
    '"spec":{"garment"',
  ]) {
    assert.ok(!serialized.includes(secret), `the organizer view must not carry ${secret}`);
  }
  assert.deepEqual(Object.keys(view.participants[0]).sort(), [
    "consent",
    "designReady",
    "fitReady",
    "hasDesign",
    "invitedAt",
    "joinedAt",
    "name",
    "participantId",
    "status",
    "statusLabel",
  ]);
  assert.equal(view.participants.find((p) => p.name === "Kofi").joinedAt, undefined);
  assert.equal(kofi.participantId, view.participants[2].participantId);

  // Withdrawing consent withdraws the status; it never sticks.
  await groups.setParticipantConsent(
    f.ctx,
    accountActor,
    nia.participantId,
    { shareStyleStatus: true, shareFitStatus: false },
    NOW,
  );
  view = await groups.groupView(f.ctx, await f.ctx.db.get(group._id));
  assert.equal(view.participants[1].status, "design_ready");
  assert.equal(view.participants[1].fitReady, false);

  // Another account cannot read or touch the group.
  await assert.rejects(groups.requireOrganizerGroup(f.ctx, group._id, accountUser), isAppError("NOT_FOUND"));
  await assert.rejects(
    groups.inviteParticipant(f.ctx, accountUser, group._id, { name: "Intruder" }, NOW),
    isAppError("NOT_FOUND"),
  );
  await assert.rejects(groups.removeParticipant(f.ctx, accountUser, yaw.participantId, NOW), isAppError("NOT_FOUND"));
  const mine = await groups.listGroupsForOrganizer(f.ctx, organizer);
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].participantCount, mine[0].joinedCount, mine[0].status], [3, 2, "inviting"]);
  assert.deepEqual(await groups.listGroupsForOrganizer(f.ctx, accountUser), []);

  // The participant's own standing is readable from their design, and only by them.
  const participation = await groups.participationForDraft(f.ctx, await f.ctx.db.get(yawDraft));
  assert.equal(participation.participantId, yaw.participantId);
  assert.equal(participation.groupName, group.name);
  assert.deepEqual(participation.consent, { shareStyleStatus: true, shareFitStatus: false });
});

test("leaving marks the participant declined, drops consent and takes the design out of the group", async () => {
  const { f, organizer } = await setup();
  const group = await groupWith(f, organizer);
  const yaw = await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Yaw" }, NOW);
  const { draftId } = await groups.joinGroup(f.ctx, guestActor, yaw.inviteToken, NOW);
  await groups.setParticipantConsent(
    f.ctx,
    guestActor,
    yaw.participantId,
    { shareStyleStatus: true, shareFitStatus: true },
    NOW,
  );

  await assert.rejects(groups.leaveGroup(f.ctx, otherGuestActor, yaw.participantId, NOW), isAppError("NOT_FOUND"));
  await groups.leaveGroup(f.ctx, guestActor, yaw.participantId, NOW + DAY);
  const participant = await f.ctx.db.get(yaw.participantId);
  assert.equal(participant.status, "declined");
  assert.deepEqual(participant.consent, { shareStyleStatus: false, shareFitStatus: false });
  const draft = await f.ctx.db.get(draftId);
  assert.equal(draft.groupId, undefined, "the design stays with the participant and leaves the group");
  assert.equal(draft.guestKey, GUEST_KEY);
  assert.equal(await groups.participationForDraft(f.ctx, draft), null);

  const view = await groups.groupView(f.ctx, await f.ctx.db.get(group._id));
  assert.deepEqual(
    view.participants.map((p) => [p.status, p.hasDesign, p.designReady, p.fitReady]),
    [["declined", false, false, false]],
  );
  await assert.rejects(
    groups.setParticipantConsent(
      f.ctx,
      guestActor,
      yaw.participantId,
      { shareStyleStatus: true, shareFitStatus: false },
      NOW,
    ),
    isAppError("INVALID_STATE"),
  );
  await groups.leaveGroup(f.ctx, guestActor, yaw.participantId, NOW + 2 * DAY);
  assert.equal(
    f.rowsOf("atelierAuditLog").filter((row) => row.action === "group.leave").length,
    1,
    "leaving twice is a no-op",
  );

  // Someone who has ordered cannot be removed by either side without the house.
  const nia = await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Nia" }, NOW);
  await groups.joinGroup(f.ctx, accountActor, nia.inviteToken, NOW);
  await f.ctx.db.patch(nia.participantId, { status: "ordered" });
  await assert.rejects(groups.leaveGroup(f.ctx, accountActor, nia.participantId, NOW), isAppError("INVALID_STATE"));
  await assert.rejects(groups.removeParticipant(f.ctx, organizer, nia.participantId, NOW), isAppError("INVALID_STATE"));
  const ordered = await groups.groupView(f.ctx, await f.ctx.db.get(group._id));
  assert.equal(ordered.participants.find((p) => p.name === "Nia").status, "ordered");
});

test("the group state machine: review words are the house's, and only lawful transitions pass", async () => {
  for (const from of GROUP_STATUSES) assert.ok(Array.isArray(groups.GROUP_TRANSITIONS[from]), from);
  assert.ok(groups.canTransitionGroup("draft", "inviting"));
  assert.ok(groups.canTransitionGroup("inviting", "in_review"));
  assert.ok(groups.canTransitionGroup("in_review", "approved"));
  assert.ok(groups.canTransitionGroup("approved", "in_review"));
  assert.ok(!groups.canTransitionGroup("draft", "approved"), "nothing is approved before the house has looked");
  assert.ok(!groups.canTransitionGroup("inviting", "approved"), "approval follows a review, never skips it");
  assert.ok(!groups.canTransitionGroup("in_review", "in_review"));
  assert.ok(!groups.canTransitionGroup("closed", "approved"));
  assert.ok(!groups.canTransitionGroup("closed", "in_review"));

  const { f, organizer, concierge } = await setup();
  const group = await groupWith(f, organizer);
  await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Yaw" }, NOW);

  await assert.rejects(
    groups.reviewGroup(f.ctx, concierge, group._id, { note: "", status: "approved" }, NOW),
    isAppError("INVALID_STATE"),
  );
  const reviewed = await groups.reviewGroup(
    f.ctx,
    concierge,
    group._id,
    { note: "  Compatible; waiting on two fittings. ", status: "in_review" },
    NOW + DAY,
  );
  assert.equal(reviewed.status, "in_review");
  assert.equal(reviewed.statusLabel, "With the house for review");
  assert.equal(reviewed.staffReviewNote, "Compatible; waiting on two fittings.");
  assert.equal(reviewed.organizerName, "Kwame");
  assert.deepEqual(
    [reviewed.participantCount, reviewed.joinedCount, reviewed.designReadyCount, reviewed.fitReadyCount],
    [1, 0, 0, 0],
  );
  assert.ok(!JSON.stringify(reviewed).includes("kwame@example.com"));
  const auditRow = f.rowsOf("atelierAuditLog").find((row) => row.action === "group.review");
  assert.equal(auditRow.actorUserId, concierge._id);
  assert.equal(auditRow.actorKind, "staff");
  assert.deepEqual(auditRow.meta, { from: "inviting", to: "in_review", noted: true });

  // Under review: the organizer may add to the brief but not change the design; invitations still go out.
  await groups.updateGroup(f.ctx, organizer, group._id, { brief: "Also: no ticket pockets." }, NOW);
  assert.equal((await f.ctx.db.get(group._id)).brief, "Also: no ticket pockets.");
  await assert.rejects(
    groups.updateGroup(f.ctx, organizer, group._id, { name: "Renamed" }, NOW),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    groups.updateGroup(f.ctx, organizer, group._id, { sharedSpec: { ...DEFAULT_SPEC, clothCode: CLOTH } }, NOW),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    groups.updateGroup(f.ctx, organizer, group._id, { permittedIndividual: [] }, NOW),
    isAppError("INVALID_STATE"),
  );
  await groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Nia" }, NOW);

  // A review note that is empty keeps the previous one.
  const approved = await groups.reviewGroup(
    f.ctx,
    concierge,
    group._id,
    { note: "", status: "approved" },
    NOW + 2 * DAY,
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.staffReviewNote, "Compatible; waiting on two fittings.");
  await assert.rejects(
    groups.inviteParticipant(f.ctx, organizer, group._id, { name: "Kofi" }, NOW),
    isAppError("INVALID_STATE"),
  );
  assert.equal((await groups.listGroupsForReview(f.ctx)).length, 1);

  const closed = await groups.reviewGroup(
    f.ctx,
    concierge,
    group._id,
    { note: "Event passed.", status: "closed" },
    NOW + 3 * DAY,
  );
  assert.equal(closed.status, "closed");
  await assert.rejects(
    groups.updateGroup(f.ctx, organizer, group._id, { brief: "Too late" }, NOW),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(
    groups.reviewGroup(f.ctx, concierge, group._id, { note: "", status: "in_review" }, NOW),
    isAppError("INVALID_STATE"),
  );
  assert.deepEqual(await groups.listGroupsForReview(f.ctx), []);
  await assert.rejects(
    groups.reviewGroup(f.ctx, concierge, "atelierGroups|999", { note: "", status: "closed" }, NOW),
    isAppError("NOT_FOUND"),
  );

  // Before any invitation a draft group can be edited freely, and an unknown field set is a no-op.
  const fresh = await groupWith(f, organizer, { name: "Board dinner", occasion: "business" });
  await groups.updateGroup(
    f.ctx,
    organizer,
    fresh._id,
    { name: "Board dinner 2027", eventDate: null, permittedIndividual: ["trousers.hem"] },
    NOW,
  );
  const updated = await f.ctx.db.get(fresh._id);
  assert.equal(updated.name, "Board dinner 2027");
  assert.equal(updated.eventDate, undefined);
  assert.deepEqual(updated.permittedIndividual, ["trousers.hem"]);
  const patchesBefore = f.log.patches.length;
  await groups.updateGroup(f.ctx, organizer, fresh._id, {}, NOW);
  assert.equal(f.log.patches.length, patchesBefore);
  assert.equal(
    (await groups.listGroupsForReview(f.ctx)).length,
    0,
    "a draft nobody was invited to is not yet the house's business",
  );
});

test("effectiveStatus never claims a readiness the participant did not consent to show", () => {
  assert.equal(groups.effectiveStatus("invited", { designReady: true, fitReady: true }), "invited");
  assert.equal(groups.effectiveStatus("joined", { designReady: false, fitReady: true }), "joined");
  assert.equal(groups.effectiveStatus("joined", { designReady: true, fitReady: false }), "design_ready");
  assert.equal(groups.effectiveStatus("joined", { designReady: true, fitReady: true }), "fit_ready");
  assert.equal(groups.effectiveStatus("declined", { designReady: true, fitReady: true }), "declined");
  assert.equal(groups.effectiveStatus("ordered", { designReady: false, fitReady: false }), "ordered");
});
