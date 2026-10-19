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

const cases = await import("../convex/model/atelier/cases.ts");
const drafts = await import("../convex/model/atelier/drafts.ts");
const { ATELIER_LIMITS, CASE_STATUS_LABELS, CASE_STATUSES, SAMPLE_STATES } =
  await import("../convex/shared/atelier/enums.ts");
const { specHash } = await import("../convex/shared/atelier/spec.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const HOUR = 3_600_000;
const DAY = 86_400_000;

const CONTACT = { name: "Nia Okafor", email: "Nia@Example.com", channel: "email" };
const ADDRESS = { line1: "12 Queens Road", city: "Charlotte", region: "NC", postalCode: "28202", country: "US" };

/** The shared fake knows `eq` only; the daily budget reads a range on the owner index and filters by `createdAt`. */
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
  const secondConcierge = await insertUser({ name: "Marcus Bell", staffRoles: ["concierge"] });
  const fitter = await insertUser({ name: "Tunde Ade", staffRoles: ["fitter"] });
  return { f, concierge, secondConcierge, fitter };
}

async function draftFor(f, actor = guestActor, input = { lookKey: "armada" }) {
  const id = await drafts.createDraft(f.ctx, actor, input, NOW);
  return f.ctx.db.get(id);
}

async function submitted(f, actor = guestActor, kind = "quote", key = "key-1") {
  const draft = await draftFor(f, actor);
  const result = await cases.submitCase(
    f.ctx,
    actor,
    { kind, draftId: draft._id, contact: CONTACT, message: "As designed, please.", submissionKey: key },
    NOW,
  );
  return { draft, ...result, row: await f.ctx.db.get(result.caseId) };
}

const messagesOf = (f, caseId) => f.rowsOf("atelierCaseMessages").filter((m) => m.caseId === caseId);
const auditsOf = (f, action) => f.rowsOf("atelierAuditLog").filter((a) => a.action === action);

// ------------------------------------------------------------------------------------------------
// Submission
// ------------------------------------------------------------------------------------------------

test("a quote request freezes the design, marks the draft submitted and leaves one receipt", async () => {
  const { f } = await setup();
  const { draft, caseId, revisionId, duplicate, row } = await submitted(f);
  assert.equal(duplicate, false);
  assert.equal(row.kind, "quote");
  assert.equal(row.status, "received");
  assert.equal(row.guestKey, GUEST_KEY);
  assert.equal(row.userId, undefined);
  assert.equal(row.revisionId, revisionId);
  assert.equal(row.draftId, draft._id);
  assert.equal(row.priority, "normal");
  assert.equal(row.contact.email, "nia@example.com", "the address is normalised");
  assert.equal(row.sample, undefined, "no address is ever asked for a quote");

  const revision = await f.ctx.db.get(revisionId);
  assert.equal(revision.reason, "submitted");
  assert.equal(revision.revision, draft.revision);
  assert.equal(revision.specHash, specHash(draft.spec));
  assert.equal((await f.ctx.db.get(draft._id)).status, "submitted");

  const messages = messagesOf(f, caseId);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].author, "system");
  assert.match(messages[0].body, /Quote request received/);
  assert.match(messages[0].body, /not a purchase and not a booking/);
  assert.equal(f.rowsOf("atelierNotifications").filter((n) => n.caseId === caseId && n.status === "queued").length, 1);
  assert.equal(auditsOf(f, "case.create").length, 1);
});

test("the same submission key returns the first receipt and writes nothing", async () => {
  const { f } = await setup();
  const first = await submitted(f, guestActor, "design_review", "retry-me");
  const inserts = f.log.inserts.length;
  const patches = f.log.patches.length;
  const again = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "design_review", draftId: first.draft._id, contact: CONTACT, submissionKey: "retry-me" },
    NOW + HOUR,
  );
  assert.deepEqual(again, { caseId: first.caseId, revisionId: first.revisionId, duplicate: true });
  assert.equal(f.log.inserts.length, inserts);
  assert.equal(f.log.patches.length, patches);
  assert.equal(f.rowsOf("atelierCases").length, 1, "every acknowledged request appears once");

  const other = await draftFor(f, otherGuestActor);
  const foreign = await cases.submitCase(
    f.ctx,
    otherGuestActor,
    { kind: "design_review", draftId: other._id, contact: CONTACT, submissionKey: "retry-me" },
    NOW,
  );
  assert.equal(foreign.duplicate, false);
  assert.notEqual(foreign.caseId, first.caseId, "another browser's key never reveals this case");
});

test("a design review needs a complete design, an owned draft and an actor", async () => {
  const { f } = await setup();
  const empty = await draftFor(f, guestActor, {});
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "design_review", draftId: empty._id, contact: CONTACT, submissionKey: "k1" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.submitCase(f.ctx, guestActor, { kind: "quote", contact: CONTACT, submissionKey: "k2" }, NOW),
    isAppError("INVALID_INPUT"),
  );
  const mine = await draftFor(f, guestActor);
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      otherGuestActor,
      { kind: "quote", draftId: mine._id, contact: CONTACT, submissionKey: "k3" },
      NOW,
    ),
    isAppError("NOT_FOUND"),
  );
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      { user: null, guestKey: null },
      { kind: "support", contact: CONTACT, message: "Hello", submissionKey: "k4" },
      NOW,
    ),
    isAppError("UNAUTHENTICATED"),
  );
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "quote", draftId: mine._id, contact: { ...CONTACT, email: "not-an-email" }, submissionKey: "k5" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "support", contact: CONTACT, message: "   ", submissionKey: "k6" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
    "a question needs words",
  );
  assert.equal(f.rowsOf("atelierCases").length, 0);
  assert.equal(f.rowsOf("atelierRevisions").length, 0);
  assert.equal((await f.ctx.db.get(mine._id)).status, "draft", "a failed send leaves the draft a draft");
});

test("a sample names a cloth the house can send and where; its state is requested, then accepted, then shipped", async () => {
  const { f, concierge } = await setup();
  await draftFor(f);
  const cloth = f.rowsOf("atelierCatalogueEntries").find((entry) => entry.kind === "cloth");
  await assert.rejects(
    cases.submitCase(f.ctx, guestActor, { kind: "sample", contact: CONTACT, submissionKey: "s0" }, NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      {
        kind: "sample",
        contact: CONTACT,
        sample: { clothCode: "no-such-cloth", address: ADDRESS },
        submissionKey: "s1",
      },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      {
        kind: "sample",
        contact: CONTACT,
        sample: { clothCode: cloth.code, address: { ...ADDRESS, city: " " } },
        submissionKey: "s2",
      },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  f.row(cloth._id).sampleAvailable = false;
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "sample", contact: CONTACT, sample: { clothCode: cloth.code, address: ADDRESS }, submissionKey: "s3" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  f.row(cloth._id).sampleAvailable = true;

  const { caseId } = await cases.submitCase(
    f.ctx,
    guestActor,
    {
      kind: "sample",
      contact: CONTACT,
      sample: { clothCode: cloth.code, address: { ...ADDRESS, line2: "  " } },
      submissionKey: "s4",
    },
    NOW,
  );
  const row = await f.ctx.db.get(caseId);
  assert.equal(row.sample.state, "requested");
  assert.equal(row.sample.address.line2, undefined);
  const view = await cases.toCaseView(f.ctx, row, NOW);
  assert.equal(view.sample.stateLabel, cases.SAMPLE_STATE_LABELS.requested);
  assert.equal(view.sample.clothName, cloth.name);

  await assert.rejects(
    cases.markSample(f.ctx, concierge, caseId, "shipped", NOW),
    isAppError("INVALID_STATE"),
    "received is not shipped",
  );
  await cases.markSample(f.ctx, concierge, caseId, "accepted", NOW + HOUR);
  assert.equal((await f.ctx.db.get(caseId)).sample.state, "accepted");
  await cases.markSample(f.ctx, concierge, caseId, "shipped", NOW + DAY);
  assert.equal((await f.ctx.db.get(caseId)).sample.state, "shipped");
  await assert.rejects(cases.markSample(f.ctx, concierge, caseId, "accepted", NOW + DAY), isAppError("INVALID_STATE"));
  await assert.rejects(cases.markSample(f.ctx, concierge, caseId, "declined", NOW + DAY), isAppError("INVALID_STATE"));
  const words = messagesOf(f, caseId).map((m) => m.body);
  assert.ok(words.some((body) => /being prepared/.test(body)));
  assert.ok(words.some((body) => /has shipped to Charlotte/.test(body)));
  assert.equal(auditsOf(f, "case.sample").length, 2);

  const question = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "support", contact: CONTACT, message: "Hello", submissionKey: "s5" },
    NOW,
  );
  await assert.rejects(
    cases.markSample(f.ctx, concierge, question.caseId, "accepted", NOW),
    isAppError("INVALID_STATE"),
  );
  for (const from of SAMPLE_STATES) assert.ok(Array.isArray(cases.SAMPLE_TRANSITIONS[from]));
});

test("an owner may send casesPerDay requests a day; the budget is per owner and resets with the UTC day", async () => {
  const { f } = await setup();
  for (let i = 0; i < ATELIER_LIMITS.casesPerDay; i += 1) {
    await cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "support", contact: CONTACT, message: `Question ${i}`, submissionKey: `q-${i}` },
      NOW + i,
    );
  }
  await assert.rejects(
    cases.submitCase(
      f.ctx,
      guestActor,
      { kind: "support", contact: CONTACT, message: "One more", submissionKey: "q-more" },
      NOW + HOUR,
    ),
    isAppError("RATE_LIMITED"),
  );
  const dup = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "support", contact: CONTACT, message: "Question 0", submissionKey: "q-0" },
    NOW + HOUR,
  );
  assert.equal(dup.duplicate, true, "a retry is never counted against the budget");
  const other = await cases.submitCase(
    f.ctx,
    otherGuestActor,
    { kind: "support", contact: CONTACT, message: "Hi", submissionKey: "other" },
    NOW + HOUR,
  );
  assert.equal(other.duplicate, false);
  const tomorrow = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "support", contact: CONTACT, message: "Next day", submissionKey: "q-next" },
    NOW + DAY,
  );
  assert.equal(tomorrow.duplicate, false);
});

// ------------------------------------------------------------------------------------------------
// Reads and ownership
// ------------------------------------------------------------------------------------------------

test("the client reads their own case with the status words, the owner's first name and nothing of anyone else", async () => {
  const { f, concierge } = await setup();
  const { caseId, row } = await submitted(f, accountActor);
  const before = await cases.toCaseView(f.ctx, row, NOW);
  assert.equal(before.statusLabel, CASE_STATUS_LABELS.received);
  assert.equal(before.ownerFirstName, null);
  assert.equal(before.revision.reason, "submitted");
  assert.ok(before.revision.lines.length > 10);
  assert.equal(before.latestMessage.author, "system");
  assert.deepEqual(before.proposals, []);
  assert.equal(before.quote, null);
  assert.equal(before.appointment, null);
  assert.equal(before.open, true);

  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + HOUR);
  const after = await cases.toCaseView(f.ctx, await f.ctx.db.get(caseId), NOW + HOUR);
  assert.equal(after.status, "assigned");
  assert.equal(after.statusLabel, CASE_STATUS_LABELS.assigned);
  assert.equal(after.ownerFirstName, "Adaeze");
  assert.equal(after.latestMessage.body, "Adaeze has your request.");
  const serialized = JSON.stringify(after);
  assert.ok(!serialized.includes("Nwosu"), "only the first name reaches the client");
  assert.ok(!serialized.includes(GUEST_KEY) && !serialized.includes("submissionKey"));

  assert.equal(await cases.findOwnedCase(f.ctx, caseId, strangerActor), null);
  assert.equal(await cases.findOwnedCase(f.ctx, caseId, guestActor), null);
  assert.ok(await cases.findOwnedCase(f.ctx, caseId, accountActor));
  assert.throws(() => cases.requireOwnedCase(row, strangerActor), isAppError("NOT_FOUND"));

  const mine = await cases.listMine(f.ctx, accountActor);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].ownerFirstName, "Adaeze");
  assert.deepEqual(await cases.listMine(f.ctx, strangerActor), []);
});

test("listMine merges the account's requests with the guest ones this browser still holds", async () => {
  const { f } = await setup();
  await submitted(f, guestActor, "quote", "g1");
  await submitted(f, accountActor, "quote", "a1");
  const both = await cases.listMine(f.ctx, { user: accountUser, guestKey: GUEST_KEY });
  assert.equal(both.length, 2);
  assert.equal((await cases.listMine(f.ctx, guestActor)).length, 1);
});

// ------------------------------------------------------------------------------------------------
// Conversation
// ------------------------------------------------------------------------------------------------

test("messages move the clock: a client reply is with the house, a concierge reply waits on the client, a closed case takes none", async () => {
  const { f, concierge } = await setup();
  const { caseId } = await submitted(f);
  let row = await f.ctx.db.get(caseId);
  await cases.sendClientMessage(f.ctx, guestActor, row, "  One more thought.  ", NOW + 1);
  row = await f.ctx.db.get(caseId);
  assert.equal(row.status, "received", "an unassigned request stays received: the words say awaiting a concierge");
  assert.equal(row.lastActivityAt, NOW + 1);
  await assert.rejects(cases.sendClientMessage(f.ctx, guestActor, row, "   ", NOW + 2), isAppError("INVALID_INPUT"));
  await assert.rejects(
    cases.sendClientMessage(f.ctx, otherGuestActor, row, "Not mine.", NOW + 2),
    isAppError("NOT_FOUND"),
  );

  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 2);
  await cases.staffReply(f.ctx, concierge, caseId, "Happy to. Two questions for you.", NOW + 3);
  row = await f.ctx.db.get(caseId);
  assert.equal(row.status, "awaiting_client");
  assert.equal(
    f.rowsOf("atelierNotifications").filter((n) => n.caseId === caseId).length,
    3,
    "receipt, assignment and reply were each queued",
  );
  assert.equal(auditsOf(f, "case.reply").length, 1);

  await cases.sendClientMessage(f.ctx, guestActor, row, "Answers below.", NOW + 4);
  row = await f.ctx.db.get(caseId);
  assert.equal(row.status, "awaiting_staff");

  const messages = await cases.listMessages(f.ctx, caseId);
  assert.deepEqual(
    messages.map((m) => m.author),
    ["system", "client", "system", "staff", "client"],
  );
  const nameOf = cases.nameCache(f.ctx);
  const views = await Promise.all(messages.map((m) => cases.toMessageView(m, nameOf)));
  assert.equal(views[3].authorName, "Adaeze");
  assert.equal(views[1].authorName, null);

  await cases.setStatus(f.ctx, concierge, caseId, "completed", NOW + 5);
  row = await f.ctx.db.get(caseId);
  assert.equal(row.closedAt, NOW + 5);
  await assert.rejects(cases.sendClientMessage(f.ctx, guestActor, row, "Hello?", NOW + 6), isAppError("INVALID_STATE"));
  await assert.rejects(cases.staffReply(f.ctx, concierge, caseId, "Hello?", NOW + 6), isAppError("INVALID_STATE"));
});

// ------------------------------------------------------------------------------------------------
// Assignment, transfer and status
// ------------------------------------------------------------------------------------------------

test("assign needs a concierge, names them to the client once and leaves the unassigned queue", async () => {
  const { f, concierge, secondConcierge, fitter } = await setup();
  const { caseId } = await submitted(f);
  await assert.rejects(cases.assign(f.ctx, concierge, caseId, fitter._id, NOW), isAppError("INVALID_INPUT"));
  assert.equal((await cases.queue(f.ctx, concierge, "unassigned", NOW)).length, 1);

  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 1);
  const row = await f.ctx.db.get(caseId);
  assert.equal(row.status, "assigned");
  assert.equal(row.ownerStaffId, concierge._id);
  assert.equal(row.assignedAt, NOW + 1);
  assert.equal(messagesOf(f, caseId).at(-1).body, "Adaeze has your request.");
  const notification = f
    .rowsOf("atelierNotifications")
    .filter((n) => n.caseId === caseId)
    .at(-1);
  assert.equal(notification.status, "queued");
  assert.match(notification.subject, /concierge/);
  assert.equal(auditsOf(f, "case.assign").length, 1);
  assert.equal(auditsOf(f, "case.assign")[0].actorKind, "staff");

  const writes = f.log.patches.length;
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 2);
  assert.equal(f.log.patches.length, writes, "assigning to the same owner twice changes nothing");
  await assert.rejects(
    cases.assign(f.ctx, concierge, caseId, secondConcierge._id, NOW + 2),
    isAppError("INVALID_STATE"),
    "an owned case is transferred, not re-assigned",
  );
  assert.equal((await cases.queue(f.ctx, concierge, "unassigned", NOW)).length, 0);
  assert.equal((await cases.queue(f.ctx, concierge, "mine", NOW)).length, 1);
  assert.equal((await cases.queue(f.ctx, secondConcierge, "mine", NOW)).length, 0);
});

test("transfer keeps the conversation and revisions, records the handover and moves the queue", async () => {
  const { f, concierge, secondConcierge } = await setup();
  const { caseId, revisionId } = await submitted(f);
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 1);
  await cases.staffReply(f.ctx, concierge, caseId, "Let us begin.", NOW + 2);
  const beforeCount = messagesOf(f, caseId).length;
  await assert.rejects(
    cases.transfer(f.ctx, concierge, caseId, concierge._id, "n/a", NOW + 3),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.transfer(f.ctx, concierge, caseId, secondConcierge._id, "  ", NOW + 3),
    isAppError("INVALID_INPUT"),
  );
  await cases.transfer(f.ctx, concierge, caseId, secondConcierge._id, "Adaeze is away this week.", NOW + 3);
  const row = await f.ctx.db.get(caseId);
  assert.equal(row.ownerStaffId, secondConcierge._id);
  assert.equal(row.status, "awaiting_client", "a transfer does not change whose turn it is");
  assert.equal(row.revisionId, revisionId);
  const messages = messagesOf(f, caseId);
  assert.equal(messages.length, beforeCount + 1);
  assert.match(messages.at(-1).body, /Marcus now has your request, taking over from Adaeze/);
  assert.ok(!messages.at(-1).body.includes("away"), "the handover note is for the house, not the client");
  const entry = auditsOf(f, "case.transfer")[0];
  assert.equal(entry.meta.from, concierge._id);
  assert.equal(entry.meta.to, secondConcierge._id);
  assert.equal(entry.meta.note, "Adaeze is away this week.");
  assert.equal((await cases.queue(f.ctx, secondConcierge, "mine", NOW)).length, 1);
  assert.equal((await cases.queue(f.ctx, concierge, "mine", NOW)).length, 0);
});

test("status moves only along the service state machine, and 'assigned' needs an owner", async () => {
  const { f, concierge } = await setup();
  for (const from of CASE_STATUSES) {
    for (const to of CASE_STATUSES) {
      const legal = cases.canTransition(from, to);
      if (from === "completed" || from === "cancelled") assert.equal(legal, false, `${from} is terminal`);
      if (to === "received") assert.equal(legal, false, "nothing goes back to received");
    }
  }
  const { caseId } = await submitted(f);
  await assert.rejects(cases.setStatus(f.ctx, concierge, caseId, "assigned", NOW), isAppError("INVALID_STATE"));
  await cases.setStatus(f.ctx, concierge, caseId, "awaiting_client", NOW + 1);
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 2);
  assert.equal(
    (await f.ctx.db.get(caseId)).status,
    "awaiting_client",
    "assigning a case waiting on the client keeps that truth",
  );
  await cases.setStatus(f.ctx, concierge, caseId, "assigned", NOW + 3);
  await cases.setStatus(f.ctx, concierge, caseId, "completed", NOW + 4);
  const row = await f.ctx.db.get(caseId);
  assert.equal(row.status, "completed");
  assert.equal(row.closedAt, NOW + 4);
  assert.match(messagesOf(f, caseId).at(-1).body, /complete/);
  await assert.rejects(
    cases.setStatus(f.ctx, concierge, caseId, "awaiting_staff", NOW + 5),
    isAppError("INVALID_STATE"),
  );
  await assert.rejects(cases.setStatus(f.ctx, concierge, caseId, "cancelled", NOW + 5), isAppError("INVALID_STATE"));
  assert.equal(auditsOf(f, "case.status").length, 3);
});

test("the next action is named before it is dated, and clearing it clears the date", async () => {
  const { f, concierge } = await setup();
  const { caseId } = await submitted(f);
  await assert.rejects(
    cases.setNextAction(f.ctx, concierge, caseId, "  ", NOW + DAY, NOW),
    isAppError("INVALID_INPUT"),
  );
  await cases.setNextAction(f.ctx, concierge, caseId, " Call about the cloth ", NOW + DAY, NOW);
  let row = await f.ctx.db.get(caseId);
  assert.equal(row.nextAction, "Call about the cloth");
  assert.equal(row.nextActionDueAt, NOW + DAY);
  await cases.setNextAction(f.ctx, concierge, caseId, "", undefined, NOW + 1);
  row = await f.ctx.db.get(caseId);
  assert.equal(row.nextAction, undefined);
  assert.equal(row.nextActionDueAt, undefined);
});

// ------------------------------------------------------------------------------------------------
// Proposals
// ------------------------------------------------------------------------------------------------

test("a proposal is pinned to the draft's revision; accepting writes a new revision and supersedes an offered quote", async () => {
  const { f, concierge } = await setup();
  const { draft, caseId, revisionId } = await submitted(f);
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 1);
  const quoteId = await f.ctx.db.insert("atelierQuotes", {
    caseId,
    draftId: draft._id,
    revisionId,
    version: 1,
    lines: [],
    subtotalUsd: 2400,
    totalUsd: 2400,
    terms: "Deposit on release.",
    expiresAt: NOW + 14 * DAY,
    status: "offered",
    offeredAt: NOW + 2,
    createdByStaffId: concierge._id,
    createdAt: NOW + 2,
  });

  const afterSpec = { ...draft.spec, jacket: { ...draft.spec.jacket, vents: "single" } };
  await assert.rejects(
    cases.propose(
      f.ctx,
      concierge,
      caseId,
      { afterSpec: draft.spec, rationale: "Same thing", commercialImpact: "none" },
      NOW + 3,
    ),
    isAppError("INVALID_INPUT"),
    "a proposal must change something",
  );
  await assert.rejects(
    cases.propose(
      f.ctx,
      concierge,
      caseId,
      { afterSpec: { ...afterSpec, clothCode: null }, rationale: "No cloth", commercialImpact: "none" },
      NOW + 3,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    cases.propose(
      f.ctx,
      concierge,
      caseId,
      {
        afterSpec: { ...afterSpec, jacket: { ...afterSpec.jacket, breast: "double" } },
        rationale: "DB",
        commercialImpact: "none",
      },
      NOW + 3,
    ),
    isAppError("INVALID_INPUT"),
    "a double-breasted front with a two-button stance is a conflict",
  );
  await assert.rejects(
    cases.propose(f.ctx, concierge, caseId, { afterSpec, rationale: "  ", commercialImpact: "none" }, NOW + 3),
    isAppError("INVALID_INPUT"),
  );

  const proposalId = await cases.propose(
    f.ctx,
    concierge,
    caseId,
    { afterSpec, rationale: "A single vent sits cleaner on your frame.", commercialImpact: "new_quote" },
    NOW + 3,
  );
  const proposal = await f.ctx.db.get(proposalId);
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.baseRevision, draft.revision);
  assert.deepEqual(proposal.beforeSpec, draft.spec);
  assert.equal(proposal.createdByStaffId, concierge._id);
  assert.equal((await f.ctx.db.get(caseId)).status, "awaiting_client");
  const carrying = messagesOf(f, caseId).at(-1);
  assert.equal(carrying.proposalId, proposalId);
  assert.match(carrying.body, /Adaeze proposed a change/);
  assert.match(carrying.body, /new quote will follow/);
  assert.equal(auditsOf(f, "proposal.create").length, 1);
  assert.deepEqual(
    await f.ctx.db.get(draft._id).then((d) => d.spec),
    draft.spec,
    "nothing changes through a proposal alone",
  );

  const view = await cases.toProposalView(f.ctx, proposal, draft.revision);
  assert.equal(view.stale, false);
  assert.equal(view.statusLabel, cases.PROPOSAL_STATUS_LABELS.proposed);
  assert.deepEqual(
    view.changes.map((c) => [c.section, c.label, c.from, c.to, c.fromProductionId, c.toProductionId]),
    [["Jacket", "Vents", "Double vents", "Single vent", "VENT_DOUBLE", "VENT_SINGLE"]],
  );

  await assert.rejects(
    cases.respondToProposal(f.ctx, otherGuestActor, proposalId, true, NOW + 4),
    isAppError("NOT_FOUND"),
  );
  const result = await cases.respondToProposal(f.ctx, guestActor, proposalId, true, NOW + 4);
  assert.equal(result.status, "accepted");
  assert.equal(result.revision, draft.revision + 1);
  const updated = await f.ctx.db.get(draft._id);
  assert.deepEqual(updated.spec, afterSpec);
  assert.equal(updated.revision, draft.revision + 1);
  assert.equal(updated.lastSavedAt, NOW + 4);
  const revision = await f.ctx.db.get(result.revisionId);
  assert.equal(revision.reason, "proposal_accepted");
  assert.equal(revision.revision, draft.revision + 1);
  assert.equal(revision.specHash, specHash(afterSpec));
  const row = await f.ctx.db.get(caseId);
  assert.equal(row.revisionId, result.revisionId, "the case now points at the agreed design");
  assert.equal(row.status, "awaiting_staff");
  assert.equal((await f.ctx.db.get(proposalId)).status, "accepted");
  assert.equal((await f.ctx.db.get(proposalId)).decidedAt, NOW + 4);
  assert.equal((await f.ctx.db.get(quoteId)).status, "superseded");
  assert.match(messagesOf(f, caseId).at(-1).body, /revision 2/);
  assert.match(messagesOf(f, caseId).at(-1).body, /set aside/);
  assert.equal(auditsOf(f, "proposal.accept").length, 1);
  await assert.rejects(
    cases.respondToProposal(f.ctx, guestActor, proposalId, false, NOW + 5),
    isAppError("INVALID_STATE"),
  );
});

test("a proposal against an older revision is refused; declining and withdrawing leave the design alone", async () => {
  const { f, concierge } = await setup();
  const { draft, caseId } = await submitted(f);
  const afterSpec = { ...draft.spec, trousers: { ...draft.spec.trousers, pleats: "single" } };
  const stale = await cases.propose(
    f.ctx,
    concierge,
    caseId,
    { afterSpec, rationale: "Ease when seated.", commercialImpact: "none" },
    NOW + 1,
  );
  await f.ctx.db.patch(draft._id, { revision: draft.revision + 1 });
  await assert.rejects(cases.respondToProposal(f.ctx, guestActor, stale, true, NOW + 2), isAppError("STALE_REVISION"));
  assert.equal((await f.ctx.db.get(stale)).status, "proposed", "the proposal is untouched");
  assert.equal((await cases.toProposalView(f.ctx, await f.ctx.db.get(stale), draft.revision + 1)).stale, true);
  await f.ctx.db.patch(draft._id, { revision: draft.revision });

  const declined = await cases.respondToProposal(f.ctx, guestActor, stale, false, NOW + 3);
  assert.equal(declined.status, "rejected");
  assert.equal(declined.revision, draft.revision);
  assert.deepEqual((await f.ctx.db.get(draft._id)).spec, draft.spec);
  assert.equal(f.rowsOf("atelierRevisions").length, 1, "declining writes no revision");
  assert.match(messagesOf(f, caseId).at(-1).body, /declined/);
  assert.equal(auditsOf(f, "proposal.reject").length, 1);

  const second = await cases.propose(
    f.ctx,
    concierge,
    caseId,
    { afterSpec, rationale: "Once more.", commercialImpact: "none" },
    NOW + 4,
  );
  await cases.withdrawProposal(f.ctx, concierge, second, NOW + 5);
  assert.equal((await f.ctx.db.get(second)).status, "withdrawn");
  await assert.rejects(cases.withdrawProposal(f.ctx, concierge, second, NOW + 6), isAppError("INVALID_STATE"));
  await assert.rejects(cases.respondToProposal(f.ctx, guestActor, second, true, NOW + 6), isAppError("INVALID_STATE"));
  assert.match(messagesOf(f, caseId).at(-1).body, /withdrew/);

  const question = await cases.submitCase(
    f.ctx,
    guestActor,
    { kind: "support", contact: CONTACT, message: "Hi", submissionKey: "q" },
    NOW,
  );
  await assert.rejects(
    cases.propose(
      f.ctx,
      concierge,
      question.caseId,
      { afterSpec, rationale: "No design here.", commercialImpact: "none" },
      NOW,
    ),
    isAppError("INVALID_STATE"),
  );
});

// ------------------------------------------------------------------------------------------------
// Queue and escalation
// ------------------------------------------------------------------------------------------------

test("the queue filters read as named and the cron escalates once per rule", async () => {
  const { f, concierge, secondConcierge } = await setup();
  const fresh = await submitted(f, guestActor, "quote", "fresh");
  const old = await submitted(f, otherGuestActor, "design_review", "old");
  f.row(old.caseId).createdAt = NOW - (ATELIER_LIMITS.assignWithinHours + 1) * HOUR;
  f.row(old.caseId).lastActivityAt = NOW - (ATELIER_LIMITS.assignWithinHours + 1) * HOUR;
  const mine = await submitted(f, accountActor, "quote", "mine");
  await cases.assign(f.ctx, concierge, mine.caseId, concierge._id, NOW);
  await cases.setNextAction(f.ctx, concierge, mine.caseId, "Price the cloth", NOW + HOUR, NOW);
  const waiting = await cases.submitCase(
    f.ctx,
    accountActor,
    { kind: "support", contact: CONTACT, message: "Hi", submissionKey: "waiting" },
    NOW,
  );
  await cases.assign(f.ctx, secondConcierge, waiting.caseId, secondConcierge._id, NOW);
  await cases.staffReply(f.ctx, secondConcierge, waiting.caseId, "Which showroom suits you?", NOW);
  const closed = await cases.submitCase(
    f.ctx,
    accountActor,
    { kind: "support", contact: CONTACT, message: "Bye", submissionKey: "closed" },
    NOW,
  );
  await cases.setStatus(f.ctx, concierge, closed.caseId, "cancelled", NOW);

  const ids = (rows) => rows.map((r) => r._id);
  assert.deepEqual(
    ids(await cases.queue(f.ctx, concierge, "unassigned", NOW)),
    [old.caseId, fresh.caseId],
    "longest waiting first",
  );
  assert.deepEqual(ids(await cases.queue(f.ctx, concierge, "mine", NOW)), [mine.caseId]);
  assert.deepEqual(ids(await cases.queue(f.ctx, secondConcierge, "mine", NOW)), [waiting.caseId]);
  assert.deepEqual(ids(await cases.queue(f.ctx, concierge, "awaiting_client", NOW)), [waiting.caseId]);
  assert.deepEqual(ids(await cases.queue(f.ctx, concierge, "overdue", NOW)), [old.caseId]);
  assert.deepEqual(
    ids(await cases.queue(f.ctx, concierge, "overdue", NOW + 2 * HOUR)).sort(),
    [old.caseId, mine.caseId].sort(),
  );
  const all = await cases.queue(f.ctx, concierge, "all", NOW);
  assert.equal(all.length, 5, "'all' includes closed requests");
  const rowFor = all.find((r) => r._id === mine.caseId);
  assert.equal(rowFor.clientFirstName, "Nia");
  assert.equal(rowFor.ownerFirstName, "Adaeze");
  assert.equal(rowFor.draftName, mine.draft.name);
  assert.equal(rowFor.nextAction, "Price the cloth");
  assert.ok(!JSON.stringify(all).includes(GUEST_KEY));

  const escalated = await cases.escalateOverdue(f.ctx, NOW);
  assert.equal(escalated, 1);
  let oldRow = await f.ctx.db.get(old.caseId);
  assert.equal(oldRow.priority, "high");
  assert.equal(oldRow.escalatedAt, NOW);
  assert.match(messagesOf(f, old.caseId).at(-1).body, /raised with the concierge team/);
  assert.equal((await f.ctx.db.get(fresh.caseId)).priority, "normal");
  assert.equal(auditsOf(f, "case.escalate")[0].actorKind, "system");

  assert.equal(await cases.escalateOverdue(f.ctx, NOW + 30 * 60_000), 0, "an escalated case is not flagged again");
  assert.equal(await cases.escalateOverdue(f.ctx, NOW + 2 * HOUR), 1, "the due next action escalates its case");
  assert.equal((await f.ctx.db.get(mine.caseId)).priority, "high");
  assert.equal(await cases.escalateOverdue(f.ctx, NOW + 3 * HOUR), 0);
  await cases.setNextAction(f.ctx, concierge, mine.caseId, "Offer the quote", NOW + 5 * HOUR, NOW + 3 * HOUR);
  assert.equal(await cases.escalateOverdue(f.ctx, NOW + 4 * HOUR), 0, "not before the new date");
  assert.equal(await cases.escalateOverdue(f.ctx, NOW + 6 * HOUR), 1, "a later due date escalates again");
  oldRow = await f.ctx.db.get(old.caseId);
  assert.equal(messagesOf(f, old.caseId).filter((m) => /raised with/.test(m.body)).length, 1);

  const first = (await cases.queue(f.ctx, concierge, "unassigned", NOW + 6 * HOUR))[0];
  assert.equal(first._id, old.caseId);
  assert.equal(first.priority, "high");
  assert.equal(first.overdue, true);
});

test("the staff view carries the conversation, the owner and the live design beside the submitted revision", async () => {
  const { f, concierge } = await setup();
  const { draft, caseId } = await submitted(f);
  await cases.assign(f.ctx, concierge, caseId, concierge._id, NOW + 1);
  const view = await cases.staffGet(f.ctx, caseId, NOW + 1);
  assert.equal(view.messages.length, 2);
  assert.equal(view.ownerStaffId, concierge._id);
  assert.equal(view.submissionKey, "key-1");
  assert.equal(view.draft._id, draft._id);
  assert.equal(view.draft.status, "submitted");
  assert.equal(view.draft.specHash, view.revision.specHash);
  assert.ok(view.draft.lines.some((line) => line.productionId === "LAPEL_PEAK"));
  await assert.rejects(cases.staffGet(f.ctx, "atelierCases|999", NOW), isAppError("NOT_FOUND"));
});

test("diffLines names only what differs and shows a side that lacks a line as a dash", () => {
  const before = [
    { section: "Jacket", label: "Lapel", value: "Notch lapel", productionId: "LAPEL_NOTCH" },
    { section: "Jacket", label: "Vents", value: "Double vents", productionId: "VENT_DOUBLE" },
  ];
  const after = [
    { section: "Jacket", label: "Lapel", value: "Peak lapel", productionId: "LAPEL_PEAK" },
    { section: "Jacket", label: "Vents", value: "Double vents", productionId: "VENT_DOUBLE" },
    { section: "Waistcoat", label: "Style", value: "Single-breasted, five buttons", productionId: "WC_SB5" },
  ];
  assert.deepEqual(cases.diffLines(before, after), [
    {
      section: "Jacket",
      label: "Lapel",
      from: "Notch lapel",
      to: "Peak lapel",
      fromProductionId: "LAPEL_NOTCH",
      toProductionId: "LAPEL_PEAK",
    },
    {
      section: "Waistcoat",
      label: "Style",
      from: "—",
      to: "Single-breasted, five buttons",
      fromProductionId: null,
      toProductionId: "WC_SB5",
    },
  ]);
  assert.deepEqual(
    cases.diffLines(after, before).map((c) => c.to),
    ["Notch lapel", "—"],
  );
});

test("normalizeContact trims, lowercases the email and insists on a phone for texts", () => {
  assert.deepEqual(cases.normalizeContact({ name: " Nia Okafor ", email: " NIA@Example.com ", channel: "either" }), {
    name: "Nia Okafor",
    email: "nia@example.com",
    channel: "either",
  });
  assert.throws(
    () => cases.normalizeContact({ name: "", email: "a@b.co", channel: "email" }),
    isAppError("INVALID_INPUT"),
  );
  assert.throws(
    () => cases.normalizeContact({ name: "Nia", email: "a@b.co", channel: "sms" }),
    isAppError("INVALID_INPUT"),
  );
  assert.equal(
    cases.normalizeContact({
      name: "Nia",
      email: "a@b.co",
      phone: " 980 ",
      channel: "sms",
      preferredShowroom: "atlanta",
    }).phone,
    "980",
  );
});
