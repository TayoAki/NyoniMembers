import assert from "node:assert/strict";
import test from "node:test";
import { fakeCtx, GUEST_KEY, guestActor, isAppError, otherGuestActor } from "./atelier-fake-ctx.mjs";

const quotes = await import("../convex/model/atelier/quotes.ts");
const benefits = await import("../convex/model/atelier/benefits.ts");
const catalogue = await import("../convex/model/atelier/catalogue.ts");
const revisions = await import("../convex/model/atelier/revisions.ts");
const caseCore = await import("../convex/model/atelier/case_core.ts");
const { DEFAULT_SPEC, specHash } = await import("../convex/shared/atelier/spec.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { CASE_STATUS_LABELS, QUOTE_STATUS_LABELS } = await import("../convex/shared/atelier/enums.ts");
const { TIER_LABELS, MEMBERSHIP_TIERS } = await import("../convex/shared/membership.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;
const CLOTH = CLOTH_SEED[0].code;
const OTHER_CLOTH = CLOTH_SEED[1].code;

const LINES = [
  { code: "COMMISSION", label: "Made-to-measure commission", amountUsd: 2400, kind: "commission" },
  { code: "CANVAS_FULL", label: "Full canvas", amountUsd: 180, kind: "option" },
  { code: "DELIVERY", label: "Delivery", amountUsd: 0, kind: "shipping" },
  { code: "TAX", label: "Sales tax", amountUsd: 193.5, kind: "tax" },
];

function input(overrides = {}) {
  return {
    lines: LINES,
    leadTimeWeeks: 6,
    fittingsIncluded: 2,
    terms: "Final sale on confirmation of the design.",
    expiresAt: NOW + 14 * DAY,
    ...overrides,
  };
}

/** A seeded catalogue, a member with a Signature membership, finance staff, and a submitted design with a quote case. */
async function setup({
  owner = "account",
  membership = { tier: "signature", status: "active", since: Date.UTC(2026, 2, 15), updatedAt: 1 },
} = {}) {
  const f = fakeCtx();
  await catalogue.ensureCatalogueSeeded(f.ctx, NOW);
  const insertUser = async (doc) =>
    f.ctx.db.get(
      await f.ctx.db.insert("users", {
        clerkId: `clerk_${doc.name}`,
        role: "user",
        createdAt: Date.UTC(2025, 0, 10),
        ...doc,
      }),
    );
  const client = await insertUser({ name: "Nia Okafor", membership });
  const finance = await insertUser({ name: "Ada Mensah", staffRoles: ["finance"] });
  const actor = owner === "account" ? { user: client, guestKey: null } : guestActor;
  const ownerFields = owner === "account" ? { userId: client._id } : { guestKey: GUEST_KEY };
  const spec = { ...DEFAULT_SPEC, clothCode: CLOTH };
  const draftId = await f.ctx.db.insert("atelierDrafts", {
    ...ownerFields,
    name: "Wedding suit",
    occasion: "wedding",
    eventDate: NOW + 120 * DAY,
    spec,
    shortlist: [],
    fitRoute: "atelier",
    stage: "review",
    completedSteps: ["occasion", "cloth", "style", "fit"],
    catalogueVersion: 1,
    revision: 1,
    status: "submitted",
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    lastSavedAt: NOW - DAY,
  });
  const draft = await f.ctx.db.get(draftId);
  const revision = await revisions.createRevision(f.ctx, draft, "submitted", NOW - DAY);
  const { caseId } = await caseCore.createCase(
    f.ctx,
    {
      kind: "quote",
      owner: ownerFields,
      actor,
      contact: { name: "Nia Okafor", email: "nia@example.test", channel: "email" },
      submissionKey: "sub-1",
      draftId,
      revisionId: revision._id,
    },
    NOW - DAY,
  );
  const caseDoc = await f.ctx.db.get(caseId);
  const quote = async (id) => f.ctx.db.get(id);
  const offered = async (overrides = {}) => {
    const id = await quotes.createQuote(f.ctx, finance, caseDoc, input(overrides), NOW);
    await quotes.offerQuote(f.ctx, finance, await quote(id), NOW);
    return quote(id);
  };
  return { f, client, finance, actor, draft, revision, caseDoc, quote, offered };
}

const messages = (f, caseId) =>
  f
    .rowsOf("atelierCaseMessages")
    .filter((row) => row.caseId === caseId)
    .map((row) => row.body);
const auditActions = (f) => f.rowsOf("atelierAuditLog").map((row) => row.action);

test("create prices the lines server-side, versions count up and the client never sees a draft quote", async () => {
  const { f, finance, caseDoc, quote } = await setup();
  const first = await quotes.createQuote(
    f.ctx,
    finance,
    caseDoc,
    input({ lines: [...LINES].map((line) => ({ ...line, label: ` ${line.label} ` })) }),
    NOW,
  );
  const q1 = await quote(first);
  assert.equal(q1.status, "draft");
  assert.equal(q1.version, 1);
  assert.equal(q1.subtotalUsd, 2580, "subtotal is the garment: commission + options");
  assert.equal(q1.totalUsd, 2773.5, "total is every line");
  assert.equal(q1.lines[0].label, "Made-to-measure commission", "labels are trimmed");
  assert.equal(q1.revisionId, caseDoc.revisionId);
  assert.equal(q1.createdByStaffId, finance._id);
  assert.ok(auditActions(f).includes("quote.create"));
  assert.equal(quotes.isClientVisible(q1), false);

  const second = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  assert.equal((await quote(second)).version, 2);
});

test("create refuses bad lines, a past expiry, empty terms and a case without a submitted design", async () => {
  const { f, finance, caseDoc } = await setup();
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, caseDoc, input({ lines: [] }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    quotes.createQuote(
      f.ctx,
      finance,
      caseDoc,
      input({ lines: [{ code: "BENEFIT", label: "Annual suit", amountUsd: 500, kind: "benefit" }] }),
      NOW,
    ),
    (error) => isAppError("INVALID_INPUT")(error) && /takes money off/.test(error.data.message),
  );
  await assert.rejects(
    quotes.createQuote(
      f.ctx,
      finance,
      caseDoc,
      input({ lines: [{ code: "COMMISSION", label: "Commission", amountUsd: -10, kind: "commission" }] }),
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, caseDoc, input({ expiresAt: NOW - 1 }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, caseDoc, input({ terms: "  " }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, caseDoc, input({ leadTimeWeeks: 2.5 }), NOW),
    isAppError("INVALID_INPUT"),
  );
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, { ...caseDoc, revisionId: undefined }, input(), NOW),
    isAppError("INVALID_STATE"),
  );
  assert.equal(f.rowsOf("atelierQuotes").length, 0, "nothing was written");
});

test("a design that moved on since submission cannot be priced against the stale revision", async () => {
  const { f, finance, caseDoc, draft } = await setup();
  await f.ctx.db.patch(draft._id, { spec: { ...draft.spec, clothCode: OTHER_CLOTH } });
  await assert.rejects(quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW), isAppError("STALE_REVISION"));
});

test("offer tells the client, queues a notification, moves the case and supersedes the previous offer", async () => {
  const { f, finance, caseDoc, quote } = await setup();
  const firstId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(firstId), NOW);
  const first = await quote(firstId);
  assert.equal(first.status, "offered");
  assert.equal(first.offeredAt, NOW);
  assert.equal(first.supersedesId, undefined);
  assert.ok(messages(f, caseDoc._id).some((body) => body.startsWith("A quote is ready for your approval")));
  const notification = f.rowsOf("atelierNotifications").at(-1);
  assert.equal(notification.status, "queued", "recorded, not sent");
  assert.equal(notification.to, "nia@example.test");
  assert.equal(notification.userId, caseDoc.userId);
  assert.equal((await f.ctx.db.get(caseDoc._id)).status, "awaiting_client");
  assert.ok(auditActions(f).includes("quote.offer"));

  await quotes.offerQuote(f.ctx, finance, await quote(firstId), NOW + 1);
  assert.equal((await quote(firstId)).offeredAt, NOW, "offering twice is one offer");

  const secondId = await quotes.createQuote(f.ctx, finance, caseDoc, input({ lines: LINES.slice(0, 1) }), NOW + 2);
  await quotes.offerQuote(f.ctx, finance, await quote(secondId), NOW + 2);
  assert.equal((await quote(firstId)).status, "superseded");
  assert.equal((await quote(secondId)).supersedesId, firstId);
  assert.equal((await quote(secondId)).status, "offered");
  assert.ok(messages(f, caseDoc._id).at(-1).includes("It replaces version 1"));

  await assert.rejects(
    quotes.offerQuote(f.ctx, finance, await quote(firstId), NOW + 3),
    isAppError("INVALID_STATE"),
    "a superseded quote cannot be offered again",
  );
  const lateId = await quotes.createQuote(f.ctx, finance, caseDoc, input({ expiresAt: NOW + 1 }), NOW);
  await assert.rejects(
    quotes.offerQuote(f.ctx, finance, await quote(lateId), NOW + 2),
    isAppError("INVALID_INPUT"),
    "an expiry already passed cannot be offered",
  );
});

test("supersede is create + offer in one and keeps the history of the quote it replaces", async () => {
  const { f, finance, quote, offered } = await setup();
  const first = await offered();
  const nextId = await quotes.supersedeQuote(
    f.ctx,
    finance,
    first,
    input({ lines: [...LINES, { code: "RUSH", label: "Rush making", amountUsd: 300, kind: "option" }] }),
    NOW + 1,
  );
  const next = await quote(nextId);
  assert.equal(next.status, "offered");
  assert.equal(next.version, 2);
  assert.equal(next.supersedesId, first._id);
  assert.equal(next.totalUsd, 3073.5);
  assert.equal((await quote(first._id)).status, "superseded");
  assert.equal((await quote(first._id)).totalUsd, 2773.5, "history is kept");
  await assert.rejects(
    quotes.supersedeQuote(f.ctx, finance, await quote(first._id), input(), NOW + 2),
    isAppError("INVALID_STATE"),
  );
});

test("accept creates the commission in preflight with no payment, a client milestone and a truthful message", async () => {
  const { f, actor, caseDoc, draft, revision, quote, offered } = await setup();
  const q = await offered();
  const { orderId } = await quotes.acceptQuote(f.ctx, actor, q, NOW + 1);
  const accepted = await quote(q._id);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.acceptedAt, NOW + 1);
  assert.equal(accepted.acceptedSpecHash, revision.specHash);

  const order = await f.ctx.db.get(orderId);
  assert.equal(order.status, "preflight");
  assert.deepEqual(order.payment, { state: "none" });
  assert.equal(order.userId, caseDoc.userId);
  assert.equal(order.guestKey, undefined);
  assert.equal(order.caseId, caseDoc._id);
  assert.equal(order.quoteId, q._id);
  assert.equal(order.revisionId, revision._id);
  assert.equal(order.draftId, draft._id);
  assert.deepEqual(order.spec, revision.spec);
  assert.equal(order.specHash, specHash(revision.spec));
  assert.equal(order.eventDate, draft.eventDate);
  const milestones = f.rowsOf("atelierOrderMilestones").filter((row) => row.orderId === orderId);
  assert.deepEqual(
    milestones.map((row) => [row.kind, row.label, row.source, row.estimated]),
    [["quote_accepted", "Quote accepted", "client", false]],
  );
  assert.equal((await f.ctx.db.get(caseDoc._id)).orderId, orderId, "the request now points at its commission");
  assert.equal((await f.ctx.db.get(caseDoc._id)).status, "awaiting_staff");
  assert.ok(messages(f, caseDoc._id).at(-1).startsWith("Quote accepted · payment not yet recorded"));
  const audit = f.rowsOf("atelierAuditLog").find((row) => row.action === "quote.accept");
  assert.equal(audit.actorKind, "client");
  assert.equal(audit.meta.orderId, orderId);

  const again = await quotes.acceptQuote(f.ctx, actor, await quote(q._id), NOW + 2);
  assert.equal(again.orderId, orderId, "accepting twice is one commission");
  assert.equal(f.rowsOf("atelierOrders").length, 1);

  const view = await quotes.toQuoteView(f.ctx, await quote(q._id));
  assert.equal(view.statusLabel, QUOTE_STATUS_LABELS.accepted);
  assert.equal(view.orderId, orderId);
  assert.equal(view.isCurrentRevision, true);
  assert.equal(view.lines[0].kindLabel, "Commission");
  assert.equal(view.revision.specHash, revision.specHash);
  assert.ok(!("guestKey" in view) && !("userId" in view));
});

test("accept refuses a quote that is not offered, one that has expired, and a stranger", async () => {
  const { f, finance, actor, caseDoc, quote, offered } = await setup();
  const draftId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  await assert.rejects(quotes.acceptQuote(f.ctx, actor, await quote(draftId), NOW), isAppError("INVALID_STATE"));

  const q = await offered();
  await assert.rejects(quotes.acceptQuote(f.ctx, { user: null, guestKey: null }, q, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(quotes.acceptQuote(f.ctx, otherGuestActor, q, NOW), isAppError("NOT_FOUND"));
  await assert.rejects(quotes.acceptQuote(f.ctx, actor, q, q.expiresAt), isAppError("QUOTE_EXPIRED"));
  await assert.rejects(quotes.acceptQuote(f.ctx, actor, q, q.expiresAt + DAY), isAppError("QUOTE_EXPIRED"));
  assert.equal((await quote(q._id)).status, "offered", "a refused acceptance changes nothing");
  assert.equal(f.rowsOf("atelierOrders").length, 0);
});

test("accept refuses a stale hash: the client cannot pay an old quote for a new design", async () => {
  const { f, actor, draft, quote, offered } = await setup();
  const q = await offered();
  await f.ctx.db.patch(draft._id, {
    spec: { ...draft.spec, jacket: { ...draft.spec.jacket, lapel: "peak" } },
    revision: 2,
  });
  await revisions.createRevision(f.ctx, await f.ctx.db.get(draft._id), "proposal_accepted", NOW + 1);
  await assert.rejects(quotes.acceptQuote(f.ctx, actor, q, NOW + 2), isAppError("STALE_REVISION"));
  assert.equal((await quote(q._id)).status, "offered");
  assert.equal(f.rowsOf("atelierOrders").length, 0);
  const view = await quotes.toQuoteView(f.ctx, await quote(q._id));
  assert.equal(view.isCurrentRevision, false, "the view says the design has moved past the quote");
});

test("accept refuses a cloth the house withdrew or ran out of, with an explicit new decision", async () => {
  const { f, actor, offered } = await setup();
  const q = await offered();
  const entry = await catalogue.getEntry(f.ctx, "cloth", CLOTH);
  await f.ctx.db.patch(entry._id, { inStock: false });
  await assert.rejects(
    quotes.acceptQuote(f.ctx, actor, q, NOW),
    (error) =>
      isAppError("INVALID_STATE")(error) &&
      /not in stock/.test(error.data.message) &&
      /new quote will follow/.test(error.data.message),
  );
  await f.ctx.db.patch(entry._id, { inStock: true, status: "withdrawn" });
  await assert.rejects(
    quotes.acceptQuote(f.ctx, actor, q, NOW),
    (error) =>
      isAppError("INVALID_STATE")(error) &&
      /no longer offered/.test(error.data.message) &&
      /nothing has been changed on your behalf/.test(error.data.message),
  );
  assert.equal(f.rowsOf("atelierOrders").length, 0);
});

test("a guest owns their quote through the case and another browser does not", async () => {
  const { f, offered } = await setup({ owner: "guest" });
  const q = await offered();
  await assert.rejects(quotes.acceptQuote(f.ctx, otherGuestActor, q, NOW), isAppError("NOT_FOUND"));
  const { orderId } = await quotes.acceptQuote(f.ctx, guestActor, q, NOW);
  const order = await f.ctx.db.get(orderId);
  assert.equal(order.guestKey, GUEST_KEY);
  assert.equal(order.userId, undefined);
});

test("withdraw frees the quote's benefit and tells the client only when it had been offered", async () => {
  const { f, finance, caseDoc, quote, offered } = await setup();
  const draftId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  const before = messages(f, caseDoc._id).length;
  await quotes.withdrawQuote(f.ctx, finance, await quote(draftId), undefined, NOW);
  assert.equal((await quote(draftId)).status, "withdrawn");
  assert.equal(messages(f, caseDoc._id).length, before, "a draft was never shown, so nothing is said");

  const q = await offered();
  await quotes.withdrawQuote(f.ctx, finance, q, "Pricing error", NOW + 1);
  assert.equal((await quote(q._id)).status, "withdrawn");
  assert.ok(messages(f, caseDoc._id).at(-1).includes("withdrawn by the house"));
  await assert.rejects(
    quotes.withdrawQuote(f.ctx, finance, await quote(q._id), undefined, NOW + 2),
    isAppError("INVALID_STATE"),
  );
});

test("expire marks offered quotes past their expiry, says so on the case and leaves the rest", async () => {
  const { f, finance, caseDoc, quote } = await setup();
  const soonId = await quotes.createQuote(f.ctx, finance, caseDoc, input({ expiresAt: NOW + DAY }), NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(soonId), NOW);
  const laterId = await quotes.createQuote(f.ctx, finance, caseDoc, input({ expiresAt: NOW + 10 * DAY }), NOW + 1);
  // Offering the later quote would supersede the sooner one on the same case, so give the sooner one its own case.
  const { caseId: otherCaseId } = await caseCore.createCase(
    f.ctx,
    {
      kind: "quote",
      owner: { userId: caseDoc.userId },
      actor: { user: await f.ctx.db.get(caseDoc.userId), guestKey: null },
      contact: caseDoc.contact,
      submissionKey: "sub-2",
      draftId: caseDoc.draftId,
      revisionId: caseDoc.revisionId,
    },
    NOW,
  );
  await f.ctx.db.patch(soonId, { caseId: otherCaseId });
  await quotes.offerQuote(f.ctx, finance, await quote(laterId), NOW + 1);
  assert.equal((await quote(soonId)).status, "offered");
  assert.equal((await quote(laterId)).status, "offered");

  assert.equal(await quotes.expireQuotes(f.ctx, NOW + DAY - 1), 0, "nothing is expired early");
  assert.equal(await quotes.expireQuotes(f.ctx, NOW + DAY), 1);
  assert.equal((await quote(soonId)).status, "expired");
  assert.equal((await quote(laterId)).status, "offered");
  assert.ok(messages(f, otherCaseId).at(-1).includes("expired on"));
  const audit = f.rowsOf("atelierAuditLog").find((row) => row.action === "quote.expire");
  assert.equal(audit.actorKind, "system");
  assert.equal(await quotes.expireQuotes(f.ctx, NOW + DAY + 1), 0, "an expired quote is not expired twice");
});

test("the queue lists offered quotes soonest to expire, then drafts, with the client's name", async () => {
  const { f, finance, caseDoc, quote } = await setup();
  const draftId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  const offeredId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(offeredId), NOW);
  const queue = await quotes.listQueue(f.ctx);
  assert.deepEqual(
    queue.map((item) => [item.quoteId, item.status, item.clientName, item.isCurrentRevision]),
    [
      [offeredId, "offered", "Nia Okafor", true],
      [draftId, "draft", "Nia Okafor", true],
    ],
  );
});

// ------------------------------------------------------------------------------------------------
// Benefits (C14)
// ------------------------------------------------------------------------------------------------

test("the membership year is counted from the date the house recorded, or the account's creation", () => {
  const since = Date.UTC(2026, 2, 15);
  assert.equal(
    benefits.membershipYearKey(
      { createdAt: 1, membership: { tier: "signature", status: "active", since, updatedAt: 1 } },
      Date.UTC(2026, 9, 18),
    ),
    "2026",
  );
  assert.equal(
    benefits.membershipYearKey(
      { createdAt: 1, membership: { tier: "signature", status: "active", since, updatedAt: 1 } },
      Date.UTC(2027, 1, 1),
    ),
    "2026",
    "before the anniversary it is still the first year",
  );
  assert.equal(
    benefits.membershipYearKey(
      { createdAt: 1, membership: { tier: "signature", status: "active", since, updatedAt: 1 } },
      Date.UTC(2027, 2, 15),
    ),
    "2027",
    "the anniversary starts the next year",
  );
  assert.equal(
    benefits.membershipYearKey(
      { createdAt: Date.UTC(2025, 11, 31), membership: { tier: "prestige", status: "active", updatedAt: 1 } },
      Date.UTC(2026, 9, 18),
    ),
    "2025",
    "no recorded date: counted from the account",
  );
  assert.equal(benefits.membershipYearKey({ createdAt: Date.UTC(2025, 5, 1) }, Date.UTC(2026, 9, 18)), "2026");
  assert.equal(
    benefits.membershipYearKey(
      { createdAt: 1, membership: { tier: "signature", status: "active", since: Date.UTC(2027, 0, 1), updatedAt: 1 } },
      Date.UTC(2026, 9, 18),
    ),
    "2027",
    "a future start is its own year",
  );
  assert.equal(
    benefits.membershipYearStart(Date.UTC(2024, 1, 29), Date.UTC(2026, 9, 18)),
    Date.UTC(2026, 2, 1),
    "February 29 falls on March 1",
  );
});

test("eligibility is read from the house's record only and explains every tier and state in the house's voice", async () => {
  const { f, client } = await setup();
  for (const tier of MEMBERSHIP_TIERS) {
    const user = { ...client, membership: { tier, status: "active", since: Date.UTC(2026, 2, 15), updatedAt: 1 } };
    const view = await benefits.eligibilityFor(f.ctx, user, NOW);
    assert.equal(view.tier, tier);
    assert.equal(view.tierLabel, TIER_LABELS[tier]);
    assert.equal(view.yearKey, "2026");
    assert.equal(view.included, tier !== "client");
    assert.equal(view.available, tier !== "client");
    assert.equal(view.redemption, null);
    assert.ok(view.reason.length > 40, `${tier} has a reason`);
    assert.ok(!/credit|AI|generate|upload|user\b/i.test(view.reason), `${tier} reason is in the house's voice`);
    if (tier === "client") {
      assert.equal(view.cloth, null);
      assert.match(view.reason, /joined with the house/);
    } else {
      assert.match(view.reason, new RegExp(TIER_LABELS[tier]));
      assert.match(view.reason, /browsing and designing do not use it/);
    }
  }
  const lapsed = await benefits.eligibilityFor(
    f.ctx,
    { ...client, membership: { tier: "prestige", status: "lapsed", updatedAt: 1 } },
    NOW,
  );
  assert.equal(lapsed.included, false);
  assert.equal(lapsed.available, false);
  assert.match(lapsed.reason, /lapsed/);
  const none = await benefits.eligibilityFor(f.ctx, { ...client, membership: undefined }, NOW);
  assert.equal(none.tier, "client");
  assert.equal(none.included, false);
});

test("finance reserves the suit against a quote; browsing reserved nothing; one live reservation a year", async () => {
  const { f, client, finance, caseDoc, quote } = await setup();
  assert.equal(f.rowsOf("atelierBenefitRedemptions").length, 0, "reading eligibility reserved nothing");
  const quoteId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  const redemptionId = await benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId }, NOW);
  const redemption = await f.ctx.db.get(redemptionId);
  assert.equal(redemption.status, "reserved");
  assert.equal(redemption.membershipYearKey, "2026");
  assert.equal(redemption.tier, "signature");
  assert.equal(redemption.quoteId, quoteId);
  const q = await quote(quoteId);
  assert.equal(q.benefit.redemptionId, redemptionId);
  assert.equal(q.benefit.tier, "signature");
  assert.match(q.benefit.description, /Signature membership includes one made-to-measure suit/);
  assert.ok(auditActions(f).includes("benefit.reserve"));

  assert.equal(
    await benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId }, NOW + 1),
    redemptionId,
    "the same quote is the same reservation",
  );
  const otherQuoteId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  await assert.rejects(
    benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId: otherQuoteId }, NOW),
    isAppError("INVALID_STATE"),
  );
  assert.equal(f.rowsOf("atelierBenefitRedemptions").length, 1);

  const view = await benefits.eligibilityFor(f.ctx, client, NOW);
  assert.equal(view.available, false);
  assert.equal(view.redemption.status, "reserved");
  assert.match(view.reason, /reserved against a quote awaiting your approval/);
});

test("reserve refuses a client account, a lapsed member and a quote for someone else", async () => {
  const { f, client, finance, caseDoc } = await setup();
  const quoteId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  const plainId = await f.ctx.db.insert("users", { clerkId: "c2", role: "user", name: "Plain Client", createdAt: 1 });
  await assert.rejects(
    benefits.reserveBenefit(f.ctx, finance, { userId: plainId, quoteId }, NOW),
    isAppError("NOT_ELIGIBLE"),
  );
  const lapsedId = await f.ctx.db.insert("users", {
    clerkId: "c3",
    role: "user",
    name: "Lapsed",
    createdAt: 1,
    membership: { tier: "prestige", status: "lapsed", updatedAt: 1 },
  });
  await assert.rejects(
    benefits.reserveBenefit(f.ctx, finance, { userId: lapsedId, quoteId }, NOW),
    isAppError("NOT_ELIGIBLE"),
  );
  const otherMemberId = await f.ctx.db.insert("users", {
    clerkId: "c4",
    role: "user",
    name: "Other Member",
    createdAt: 1,
    membership: { tier: "circle_elite", status: "active", updatedAt: 1 },
  });
  await assert.rejects(
    benefits.reserveBenefit(f.ctx, finance, { userId: otherMemberId, quoteId }, NOW),
    isAppError("NOT_ELIGIBLE"),
    "the quote is not for their commission",
  );
  void client;
  assert.equal(f.rowsOf("atelierBenefitRedemptions").length, 0);
});

test("accepting a quote with a benefit redeems the reservation once; withdrawing or expiring releases it", async () => {
  const { f, client, finance, actor, caseDoc, quote } = await setup();
  const quoteId = await quotes.createQuote(
    f.ctx,
    finance,
    caseDoc,
    input({
      lines: [...LINES, { code: "BENEFIT", label: "Annual suit · Signature", amountUsd: -2400, kind: "benefit" }],
    }),
    NOW,
  );
  const redemptionId = await benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId }, NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(quoteId), NOW);
  assert.equal((await quote(quoteId)).totalUsd, 373.5);
  const { orderId } = await quotes.acceptQuote(f.ctx, actor, await quote(quoteId), NOW + 1);
  const redeemed = await f.ctx.db.get(redemptionId);
  assert.equal(redeemed.status, "redeemed");
  assert.equal(redeemed.redeemedAt, NOW + 1);
  assert.equal(redeemed.orderId, orderId);
  const view = await benefits.eligibilityFor(f.ctx, client, NOW + 2);
  assert.equal(view.available, false);
  assert.match(view.reason, /has been used on an accepted commission/);
  await assert.rejects(
    benefits.releaseReservation(f.ctx, finance, redeemed, "oops", NOW + 3),
    isAppError("INVALID_STATE"),
    "a used benefit is not released here",
  );
  await assert.rejects(
    benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId }, NOW + 3),
    isAppError("INVALID_STATE"),
    "used this year",
  );

  // A second member's quote: withdrawn → released, and the quote stops claiming the benefit.
  const { f: g, client: member2, finance: finance2, caseDoc: case2, quote: quote2 } = await setup();
  const q2 = await quotes.createQuote(g.ctx, finance2, case2, input(), NOW);
  const r2 = await benefits.reserveBenefit(g.ctx, finance2, { userId: member2._id, quoteId: q2 }, NOW);
  await quotes.offerQuote(g.ctx, finance2, await quote2(q2), NOW);
  await quotes.withdrawQuote(g.ctx, finance2, await quote2(q2), "re-pricing", NOW + 1);
  assert.equal((await g.ctx.db.get(r2)).status, "released");
  assert.equal((await quote2(q2)).benefit.redemptionId, r2, "a withdrawn quote keeps what it carried as history");
  assert.equal(
    (await quotes.toQuoteView(g.ctx, await quote2(q2))).benefit.redemptionStatus,
    "released",
    "and says the reservation is gone",
  );
  assert.equal((await benefits.eligibilityFor(g.ctx, member2, NOW + 2)).available, true, "the suit is available again");

  // Finance releasing a reservation on a live quote: the quote stops claiming the benefit, so it must be re-quoted.
  const q3 = await quotes.createQuote(g.ctx, finance2, case2, input(), NOW + 2);
  const r3 = await benefits.reserveBenefit(g.ctx, finance2, { userId: member2._id, quoteId: q3 }, NOW + 2);
  await quotes.offerQuote(g.ctx, finance2, await quote2(q3), NOW + 2);
  await benefits.releaseReservation(
    g.ctx,
    finance2,
    await g.ctx.db.get(r3),
    "Member asked to keep the suit for later",
    NOW + 3,
  );
  assert.equal((await g.ctx.db.get(r3)).status, "released");
  assert.equal((await g.ctx.db.get(r3)).note, "Member asked to keep the suit for later");
  assert.equal((await quote2(q3)).benefit, undefined, "a live quote no longer claims a released benefit");
  assert.equal((await quote2(q3)).status, "offered", "the quote itself stands until finance withdraws or replaces it");
  await assert.rejects(
    benefits.releaseReservation(g.ctx, finance2, await g.ctx.db.get(r3), "", NOW + 4),
    isAppError("INVALID_STATE"),
    "released twice is refused",
  );
  await quotes.withdrawQuote(g.ctx, finance2, await quote2(q3), undefined, NOW + 4);
  const r4 = await benefits.reserveBenefit(
    g.ctx,
    finance2,
    {
      userId: member2._id,
      quoteId: await quotes.createQuote(g.ctx, finance2, case2, input({ expiresAt: NOW + DAY }), NOW + 5),
    },
    NOW + 5,
  );
  await quotes.offerQuote(g.ctx, finance2, await quote2((await g.ctx.db.get(r4)).quoteId), NOW + 5);
  await quotes.expireQuotes(g.ctx, NOW + DAY);
  assert.equal((await g.ctx.db.get(r4)).status, "released", "expiry frees the suit too");
});

test("superseding a quote carries its live reservation to the new version", async () => {
  const { f, client, finance, caseDoc, quote } = await setup();
  const firstId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW);
  const redemptionId = await benefits.reserveBenefit(f.ctx, finance, { userId: client._id, quoteId: firstId }, NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(firstId), NOW);
  const nextId = await quotes.supersedeQuote(f.ctx, finance, await quote(firstId), input(), NOW + 1);
  assert.equal((await quote(nextId)).benefit.redemptionId, redemptionId);
  assert.equal((await f.ctx.db.get(redemptionId)).quoteId, nextId);
  assert.equal((await f.ctx.db.get(redemptionId)).status, "reserved");
  const view = await quotes.toQuoteView(f.ctx, await quote(nextId));
  assert.equal(view.benefit.redemptionStatus, "reserved");
  assert.equal(view.benefit.tierLabel, "Signature");
  assert.ok(!("redemptionId" in view.benefit), "no ids in the client's benefit view");

  const draftId = await quotes.createQuote(
    f.ctx,
    finance,
    caseDoc,
    input({ benefitRedemptionId: redemptionId }),
    NOW + 2,
  );
  assert.equal(
    (await quote(draftId)).benefit.redemptionId,
    redemptionId,
    "finance may carry a live reservation onto a new draft",
  );
  assert.equal((await f.ctx.db.get(redemptionId)).quoteId, draftId, "and the reservation follows it");
  const { f: g, finance: finance2, caseDoc: case2 } = await setup();
  const strangerRedemption = await g.ctx.db.insert("atelierBenefitRedemptions", {
    userId: "users|999",
    membershipYearKey: "2026",
    tier: "prestige",
    status: "reserved",
    reservedAt: NOW,
  });
  await assert.rejects(
    quotes.createQuote(g.ctx, finance2, case2, input({ benefitRedemptionId: strangerRedemption }), NOW),
    isAppError("NOT_ELIGIBLE"),
  );
  await g.ctx.db.patch(strangerRedemption, { userId: case2.userId, status: "released" });
  await assert.rejects(
    quotes.createQuote(g.ctx, finance2, case2, input({ benefitRedemptionId: strangerRedemption }), NOW),
    isAppError("INVALID_STATE"),
  );
});

// ------------------------------------------------------------------------------------------------
// Regression: a quote never moves a closed request
// ------------------------------------------------------------------------------------------------

test("a closed request takes no quote: nothing is prepared, offered or accepted on it, and a withdrawal does not reopen it", async () => {
  const { f, finance, actor, caseDoc, quote, offered } = await setup();
  const q = await offered();
  const draftId = await quotes.createQuote(f.ctx, finance, caseDoc, input(), NOW + 1);
  // The house closed the request while the quote was out (an older row, or a race with setStatus's guard).
  await f.ctx.db.patch(caseDoc._id, { status: "cancelled", closedAt: NOW + 2 });
  const closed = await f.ctx.db.get(caseDoc._id);
  assert.equal(quotes.isCaseOpen(closed), false);
  assert.equal(quotes.isCaseOpen(caseDoc), true);

  await assert.rejects(
    quotes.acceptQuote(f.ctx, actor, await quote(q._id), NOW + 3),
    (error) =>
      isAppError("INVALID_STATE")(error) &&
      error.data.message.includes(CASE_STATUS_LABELS.cancelled.toLowerCase()) &&
      /can no longer be accepted/.test(error.data.message),
  );
  assert.equal((await quote(q._id)).status, "offered", "a refused acceptance changes nothing");
  assert.equal(f.rowsOf("atelierOrders").length, 0, "no commission opens on a cancelled request");
  assert.equal((await f.ctx.db.get(caseDoc._id)).status, "cancelled", "and the request stays closed");

  await assert.rejects(
    quotes.offerQuote(f.ctx, finance, await quote(draftId), NOW + 3),
    (error) => isAppError("INVALID_STATE")(error) && /cannot be offered/.test(error.data.message),
  );
  assert.equal((await quote(draftId)).status, "draft");
  await assert.rejects(
    quotes.createQuote(f.ctx, finance, closed, input(), NOW + 3),
    (error) => isAppError("INVALID_STATE")(error) && /cannot be prepared/.test(error.data.message),
  );
  await assert.rejects(
    quotes.supersedeQuote(f.ctx, finance, await quote(q._id), input(), NOW + 3),
    isAppError("INVALID_STATE"),
  );
  assert.equal((await f.ctx.db.get(caseDoc._id)).status, "cancelled");

  const before = await f.ctx.db.get(caseDoc._id);
  await quotes.withdrawQuote(f.ctx, finance, await quote(q._id), "Request was cancelled", NOW + 4);
  assert.equal((await quote(q._id)).status, "withdrawn");
  assert.ok(messages(f, caseDoc._id).at(-1).includes("withdrawn by the house"), "the record says what happened");
  const after = await f.ctx.db.get(caseDoc._id);
  assert.equal(after.status, "cancelled", "withdrawing a quote does not reopen a closed request");
  assert.equal(after.nextAction, before.nextAction, "nor does it hand the concierge a follow-up on it");
  assert.equal(after.closedAt, NOW + 2);
});

test("the expiry cron marks a quote on a completed request expired without reopening it", async () => {
  const { f, finance, caseDoc, quote } = await setup();
  const quoteId = await quotes.createQuote(f.ctx, finance, caseDoc, input({ expiresAt: NOW + DAY }), NOW);
  await quotes.offerQuote(f.ctx, finance, await quote(quoteId), NOW);
  await f.ctx.db.patch(caseDoc._id, { status: "completed", closedAt: NOW + 1 });
  const before = await f.ctx.db.get(caseDoc._id);

  assert.equal(await quotes.expireQuotes(f.ctx, NOW + DAY), 1);
  assert.equal((await quote(quoteId)).status, "expired", "the quote's own truth still moves");
  assert.ok(messages(f, caseDoc._id).at(-1).includes("expired on"));
  const after = await f.ctx.db.get(caseDoc._id);
  assert.equal(after.status, "completed", "the cron never reopens a closed request");
  assert.equal(after.nextAction, before.nextAction, "and never asks the concierge to re-quote or close it");
  assert.equal(after.closedAt, NOW + 1);
  assert.ok(auditActions(f).includes("quote.expire"));
});
