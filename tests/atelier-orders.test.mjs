import assert from "node:assert/strict";
import test from "node:test";
import { fakeCtx, GUEST_KEY, guestActor, isAppError, otherGuestActor, strangerActor } from "./atelier-fake-ctx.mjs";

const orders = await import("../convex/model/atelier/orders.ts");
const quotes = await import("../convex/model/atelier/quotes.ts");
const catalogue = await import("../convex/model/atelier/catalogue.ts");
const revisions = await import("../convex/model/atelier/revisions.ts");
const caseCore = await import("../convex/model/atelier/case_core.ts");
const { DEFAULT_SPEC } = await import("../convex/shared/atelier/spec.ts");
const { CLOTH_SEED } = await import("../convex/shared/atelier/cloths.ts");
const { ORDER_STATUS_LABELS, PAYMENT_STATE_LABELS, FIT_REGIONS, REFUND_PAYMENT_STATES } =
  await import("../convex/shared/atelier/enums.ts");
const { HOUSE_POLICY } = await import("../convex/shared/atelier/policy.ts");

const NOW = Date.UTC(2026, 9, 18, 12);
const DAY = 86_400_000;
const CLOTH = CLOTH_SEED[0].code;

const LINES = [
  { code: "COMMISSION", label: "Made-to-measure commission", amountUsd: 2400, kind: "commission" },
  { code: "TAX", label: "Sales tax", amountUsd: 180, kind: "tax" },
];

/** A member, operations and finance staff, a submitted design, an offered quote and the commission its acceptance opened. */
async function setup({ fitRoute = "atelier", eventDate = NOW + 120 * DAY, fitProfile = null } = {}) {
  const f = fakeCtx();
  await catalogue.ensureCatalogueSeeded(f.ctx, NOW);
  const insertUser = async (doc) =>
    f.ctx.db.get(await f.ctx.db.insert("users", { clerkId: `clerk_${doc.name}`, role: "user", createdAt: 1, ...doc }));
  const client = await insertUser({ name: "Nia Okafor" });
  const finance = await insertUser({ name: "Ada Mensah", staffRoles: ["finance"] });
  const operations = await insertUser({ name: "Kofi Boateng", staffRoles: ["operations"] });
  const actor = { user: client, guestKey: null };
  let fitProfileId;
  if (fitProfile) {
    fitProfileId = await f.ctx.db.insert("atelierFitProfiles", {
      userId: client._id,
      version: 1,
      units: "cm",
      measurements: { chest: 100 },
      comfort: { jacket: "easy", trousers: "easy", movement: [] },
      provenance: "remote_guided",
      uncertainFields: [],
      status: fitProfile,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
  const draftId = await f.ctx.db.insert("atelierDrafts", {
    userId: client._id,
    name: "Wedding suit",
    occasion: "wedding",
    eventDate,
    spec: { ...DEFAULT_SPEC, clothCode: CLOTH },
    shortlist: [],
    fitRoute,
    fitProfileId,
    stage: "review",
    completedSteps: ["occasion", "cloth", "style"],
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
      owner: { userId: client._id },
      actor,
      contact: { name: "Nia Okafor", email: "nia@example.test", channel: "email" },
      submissionKey: "sub-1",
      draftId,
      revisionId: revision._id,
    },
    NOW - DAY,
  );
  const caseDoc = await f.ctx.db.get(caseId);
  const quoteId = await quotes.createQuote(
    f.ctx,
    finance,
    caseDoc,
    { lines: LINES, terms: "Final sale.", expiresAt: NOW + 14 * DAY },
    NOW,
  );
  await quotes.offerQuote(f.ctx, finance, await f.ctx.db.get(quoteId), NOW);
  const { orderId } = await quotes.acceptQuote(f.ctx, actor, await f.ctx.db.get(quoteId), NOW);
  const order = async () => f.ctx.db.get(orderId);
  const milestones = () => f.rowsOf("atelierOrderMilestones").filter((row) => row.orderId === orderId);
  const messages = () =>
    f
      .rowsOf("atelierCaseMessages")
      .filter((row) => row.caseId === caseId)
      .map((row) => row.body);
  const pay = async (state = "confirmed", reference = "sq_1", at = NOW + 1, staff = operations) =>
    orders.recordPayment(f.ctx, staff, await order(), { state, amountUsd: 2580, reference, provider: "Square" }, at);
  const release = async (at = NOW + 2) => orders.releaseOrder(f.ctx, operations, await order(), "CLT-2026-0301", at);
  return {
    f,
    client,
    finance,
    operations,
    actor,
    draft,
    revision,
    caseDoc,
    quoteId,
    orderId,
    order,
    milestones,
    messages,
    pay,
    release,
  };
}

const auditActions = (f) => f.rowsOf("atelierAuditLog").map((row) => row.action);

// ------------------------------------------------------------------------------------------------
// Preflight and release (O05)
// ------------------------------------------------------------------------------------------------

test("preflight names payment, fit and event blockers as facts; each clears when the fact changes", async () => {
  const { f, operations, order, pay } = await setup({ fitRoute: "undecided", eventDate: NOW + 20 * DAY });
  let blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(blockers.includes("Payment not recorded."), blockers.join(" | "));
  assert.ok(
    blockers.some((line) => line.startsWith("No fit route recorded")),
    blockers.join(" | "),
  );
  assert.ok(
    blockers.some((line) => /inside the house's making time/.test(line)),
    blockers.join(" | "),
  );
  assert.equal(blockers.length, 3);

  await pay("pending", "sq_pending");
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(!blockers.includes("Payment not recorded."), "pending is enough to proceed");

  await f.ctx.db.patch((await order()).draftId, { fitRoute: "atelier" });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(!blockers.some((line) => /fit/i.test(line)), "measured at the fitting");

  await orders.setRisk(
    f.ctx,
    operations,
    await order(),
    { riskNote: "Client knows the date is tight; rush agreed.", estimatedReadyAt: NOW + 18 * DAY },
    NOW,
  );
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.deepEqual(blockers, [], "a recorded, acknowledged risk clears the event blocker");
  const risk = await order();
  assert.equal(risk.estimatedReadyAt, NOW + 18 * DAY);
  const estimate = f.rowsOf("atelierOrderMilestones").find((row) => row.kind === "estimated_ready");
  assert.equal(estimate.estimated, true, "an estimate is labelled as one");
});

test("preflight blocks on a fit profile that is not approved, a quote that is not accepted, a mismatched hash and a withdrawn cloth", async () => {
  const { f, order, quoteId, revision, pay } = await setup({ fitRoute: "remote", fitProfile: "provisional" });
  await pay();
  let blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.deepEqual(blockers, [
    "Fit profile version 1 is submitted · awaiting review by a fitter; a fitter must approve it, or record a showroom fitting.",
  ]);
  await f.ctx.db.patch((await order()).fitProfileId, { status: "approved" });
  assert.deepEqual(await orders.preflightBlockers(f.ctx, await order(), NOW), []);

  await f.ctx.db.patch(quoteId, { status: "withdrawn" });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(
    blockers.some((line) => /not accepted/.test(line)),
    blockers.join(" | "),
  );
  await f.ctx.db.patch(quoteId, { status: "accepted", acceptedSpecHash: "0000000000000000" });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(
    blockers.some((line) => /different design/.test(line)),
    blockers.join(" | "),
  );
  await f.ctx.db.patch(quoteId, { acceptedSpecHash: revision.specHash });

  await f.ctx.db.patch(revision._id, { specHash: "ffffffffffffffff" });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(
    blockers.some((line) => /does not match the commission's specification/.test(line)),
    blockers.join(" | "),
  );
  await f.ctx.db.patch(revision._id, { specHash: revision.specHash });

  const entry = await catalogue.getEntry(f.ctx, "cloth", CLOTH);
  await f.ctx.db.patch(entry._id, { status: "withdrawn" });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(
    blockers.some((line) => /no longer approved/.test(line)),
    blockers.join(" | "),
  );
  await f.ctx.db.patch(entry._id, { status: "approved", inStock: false });
  blockers = await orders.preflightBlockers(f.ctx, await order(), NOW);
  assert.ok(
    blockers.some((line) => /out of stock/.test(line)),
    blockers.join(" | "),
  );
});

test("release fails with the blockers, then releases once with a maker reference, a milestone and a message", async () => {
  const { f, operations, order, milestones, messages, pay, release } = await setup();
  await assert.rejects(
    release(),
    (error) => isAppError("RELEASE_BLOCKED")(error) && error.data.details.blockers.includes("Payment not recorded."),
  );
  assert.equal((await order()).status, "preflight");
  await pay();
  await assert.rejects(orders.releaseOrder(f.ctx, operations, await order(), "  ", NOW), isAppError("INVALID_INPUT"));
  await release(NOW + 2);
  const released = await order();
  assert.equal(released.status, "released");
  assert.equal(released.releasedAt, NOW + 2);
  assert.equal(released.releasedByStaffId, operations._id);
  assert.equal(released.makerRef, "CLT-2026-0301");
  const last = milestones().at(-1);
  assert.equal(last.kind, "released");
  assert.equal(last.source, "staff");
  assert.equal(last.byUserId, operations._id);
  assert.equal(last.estimated, false);
  assert.ok(messages().at(-1).startsWith("Your commission has been released to the cutter."));
  assert.ok(auditActions(f).includes("order.release"));
  await assert.rejects(
    release(NOW + 3),
    (error) => isAppError("INVALID_STATE")(error) && /new proposal on the case/.test(error.data.message),
  );
  assert.equal(released.specHash, (await order()).specHash, "nothing here moves a released specification");
});

// ------------------------------------------------------------------------------------------------
// Payment
// ------------------------------------------------------------------------------------------------

test("payment is idempotent on the provider reference and only moves along the allowed transitions", async () => {
  const { f, operations, finance, order, milestones, messages, pay } = await setup();
  const first = await pay("pending", "sq_1", NOW + 1);
  assert.equal(first.changed, true);
  assert.equal((await order()).payment.state, "pending");
  const paymentMilestones = () => milestones().filter((row) => row.kind === "payment");
  assert.equal(paymentMilestones().length, 1);

  const again = await pay("pending", "sq_1", NOW + 2);
  assert.equal(again.changed, false, "the same reference in the same state is one record");
  assert.equal(paymentMilestones().length, 1, "and one milestone");

  const confirmed = await pay("confirmed", "sq_1", NOW + 3);
  assert.equal(confirmed.changed, true, "the same reference may confirm what was pending");
  assert.equal((await order()).payment.confirmedAt, NOW + 3);
  assert.equal((await order()).payment.reference, "sq_1");
  assert.equal(paymentMilestones().length, 2);
  assert.equal(paymentMilestones().at(-1).label, PAYMENT_STATE_LABELS.confirmed);
  assert.ok(messages().at(-1).startsWith("Payment confirmed · $2,580.00"));

  await assert.rejects(
    pay("pending", "sq_2", NOW + 4),
    isAppError("INVALID_STATE"),
    "confirmed does not go back to pending",
  );
  await assert.rejects(pay("none", "sq_2", NOW + 4), isAppError("INVALID_INPUT"));
  await assert.rejects(
    orders.recordPayment(
      f.ctx,
      operations,
      await order(),
      { state: "confirmed", amountUsd: 10, reference: " ", provider: "Square" },
      NOW,
    ),
    isAppError("INVALID_INPUT"),
  );
  await pay("refunded_partial", "rf_1", NOW + 5, finance);
  assert.equal((await order()).payment.state, "refunded_partial");
  assert.equal((await order()).payment.confirmedAt, NOW + 3, "the confirmation date is kept through a refund");
  await pay("refunded", "rf_2", NOW + 6, finance);
  await assert.rejects(pay("confirmed", "sq_3", NOW + 7, finance), isAppError("INVALID_STATE"));
  assert.equal(paymentMilestones().length, 4);
  assert.equal(f.rowsOf("atelierAuditLog").filter((row) => row.action === "order.payment").length, 4);
  assert.equal((await order()).status, "preflight", "a payment record never releases anything");
});

test("“Refunded” and “Partly refunded” are finance's words: operations cannot record them, finance can, and the admin holds every role", async () => {
  const { f, operations, finance, order, milestones, pay } = await setup();
  await pay("confirmed", "sq_1", NOW + 1);
  const before = milestones().length;
  for (const state of REFUND_PAYMENT_STATES) {
    await assert.rejects(
      pay(state, `rf_${state}`, NOW + 2),
      (error) =>
        isAppError("FORBIDDEN")(error) &&
        error.data.details.state === state &&
        /finance/.test(error.data.message) &&
        /correction/.test(error.data.message),
      `${state} from operations`,
    );
  }
  assert.equal((await order()).payment.state, "confirmed", "nothing changed");
  assert.equal(milestones().length, before, "no milestone was written");
  assert.equal(f.rowsOf("atelierAuditLog").filter((row) => row.action === "order.payment").length, 1);
  assert.deepEqual(REFUND_PAYMENT_STATES, ["refunded_partial", "refunded"]);
  assert.ok(!REFUND_PAYMENT_STATES.includes("confirmed") && !REFUND_PAYMENT_STATES.includes("failed"));

  const admin = await f.ctx.db.get(
    await f.ctx.db.insert("users", { clerkId: "clerk_admin", role: "admin", name: "Zuri Adeyemi", createdAt: 1 }),
  );
  await pay("refunded_partial", "rf_1", NOW + 3, admin);
  assert.equal((await order()).payment.state, "refunded_partial");
  await pay("refunded", "rf_2", NOW + 4, finance);
  assert.equal((await order()).payment.state, "refunded");
  assert.equal(milestones().at(-1).label, PAYMENT_STATE_LABELS.refunded);
  void operations;
});

test("a failed payment can be retried and says nothing was charged twice", async () => {
  const { order, messages, pay } = await setup();
  await pay("pending", "sq_1");
  await pay("failed", "sq_1", NOW + 2);
  assert.match(messages().at(-1), /nothing has been charged twice/);
  await pay("pending", "sq_2", NOW + 3);
  assert.equal((await order()).payment.state, "pending");
  await pay("confirmed", "sq_2", NOW + 4);
  assert.equal((await order()).payment.state, "confirmed");
});

// ------------------------------------------------------------------------------------------------
// Production line
// ------------------------------------------------------------------------------------------------

test("milestones move the line forward only as facts; estimates never do; production needs release first", async () => {
  const { f, operations, order, milestones, pay, release } = await setup();
  const making = { kind: "making", label: "Cutting and making", at: NOW + 3, source: "maker", estimated: false };
  await assert.rejects(
    orders.addMilestone(f.ctx, operations, await order(), making, NOW + 3),
    (error) => isAppError("INVALID_STATE")(error) && /Release the commission/.test(error.data.message),
  );
  await pay();
  await release();

  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "quality_review", label: "Quality review", at: NOW + 30 * DAY, source: "maker", estimated: true },
    NOW + 3,
  );
  assert.equal((await order()).status, "released", "an estimate moves nothing");
  assert.equal(milestones().at(-1).estimated, true);

  await orders.addMilestone(f.ctx, operations, await order(), making, NOW + 4);
  assert.equal((await order()).status, "making");
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    {
      kind: "note",
      label: "Lining arrived",
      at: NOW + 5,
      source: "staff",
      estimated: false,
      note: "  Bemberg, navy  ",
    },
    NOW + 5,
  );
  assert.equal((await order()).status, "making", "a note moves nothing");
  assert.equal(milestones().at(-1).note, "Bemberg, navy");
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "quality_review", label: "Quality review", at: NOW + 6, source: "maker", estimated: false },
    NOW + 6,
  );
  assert.equal((await order()).status, "quality_review");
  await assert.rejects(
    orders.addMilestone(f.ctx, operations, await order(), making, NOW + 7),
    (error) => isAppError("INVALID_STATE")(error) && /cannot go back/.test(error.data.message),
  );
  await assert.rejects(
    orders.addMilestone(f.ctx, operations, await order(), { ...making, label: " " }, NOW + 7),
    isAppError("INVALID_INPUT"),
  );
  for (const row of milestones()) {
    assert.ok(typeof row.at === "number" && row.source, "every milestone has a source and a time");
  }
});

test("addMilestone records production kinds only; the kinds with an action of their own are refused as hand-written facts", async () => {
  const { f, operations, order, milestones, pay, release } = await setup();
  await pay();
  await release();
  const before = milestones().length;
  for (const kind of ["quote_accepted", "payment", "released", "delivered", "fit_accepted", "correction_opened"]) {
    await assert.rejects(
      orders.addMilestone(
        f.ctx,
        operations,
        await order(),
        { kind, label: "Fit accepted", at: NOW + 3, source: "staff", estimated: false },
        NOW + 3,
      ),
      (error) => isAppError("INVALID_INPUT")(error) && error.data.details.kind === kind,
      kind,
    );
  }
  assert.equal(milestones().length, before, "nothing was written");
  const current = await order();
  assert.equal(current.status, "released");
  assert.equal(current.fitAcceptedAt, undefined);
  assert.equal(
    f.rowsOf("atelierAuditLog").filter((row) => row.action === "order.milestone").length,
    0,
    "a refused milestone is not audited as recorded",
  );
  for (const kind of orders.PRODUCTION_MILESTONE_KINDS) assert.ok(orders.isProductionMilestoneKind(kind), kind);
  assert.ok(!orders.isProductionMilestoneKind("fit_accepted"));
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "cloth_cut", label: "Cloth cut", at: NOW + 4, source: "maker", estimated: false },
    NOW + 4,
  );
  assert.equal(milestones().at(-1).kind, "cloth_cut");
});

test("an “Estimated ready” milestone is always an estimate and becomes the commission's estimated ready date", async () => {
  const { f, operations, order, milestones, pay, release } = await setup();
  await pay();
  await release();
  assert.equal((await order()).estimatedReadyAt, undefined);
  const readyAt = NOW + 45 * DAY;
  // The desk's switch says "a fact"; the server records it as the estimate it is.
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "estimated_ready", label: "Estimated ready", at: readyAt, source: "maker", estimated: false },
    NOW + 3,
  );
  let current = await order();
  const written = milestones().at(-1);
  assert.equal(written.kind, "estimated_ready");
  assert.equal(written.estimated, true, "never a solid dot on the client's timeline");
  assert.equal(written.at, readyAt);
  assert.equal(current.estimatedReadyAt, readyAt, "the order's estimate follows the milestone");
  assert.equal(current.status, "released", "an estimate moves nothing");
  const audit = f
    .rowsOf("atelierAuditLog")
    .filter((row) => row.action === "order.milestone")
    .at(-1);
  assert.equal(audit.meta.estimated, true);
  assert.equal(audit.meta.estimatedReadyAt, readyAt);

  const view = await orders.toOrderView(f.ctx, current, NOW + 4);
  assert.equal(view.estimatedReadyAt, readyAt);
  assert.equal(view.milestones.at(-1).estimated, true);

  // A later estimate replaces the earlier one; the timeline keeps both.
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "estimated_ready", label: "Estimated ready", at: readyAt + 7 * DAY, source: "staff", estimated: true },
    NOW + 5,
  );
  current = await order();
  assert.equal(current.estimatedReadyAt, readyAt + 7 * DAY);
  assert.equal(milestones().filter((row) => row.kind === "estimated_ready").length, 2);

  // Other kinds keep the caller's word and never touch the estimate.
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "making", label: "In the making", at: NOW + 6, source: "maker", estimated: false },
    NOW + 6,
  );
  current = await order();
  assert.equal(current.status, "making");
  assert.equal(current.estimatedReadyAt, readyAt + 7 * DAY);
  assert.equal(milestones().at(-1).estimated, false);
});

test("shipped is a carrier fact that opens no fit review; delivered opens it and never closes it", async () => {
  const { f, operations, order, milestones, messages, pay, release } = await setup();
  const shipment = { carrier: "UPS", trackingRef: "1Z999AA10123456784", at: NOW + 10 };
  await assert.rejects(
    orders.markShipped(f.ctx, operations, await order(), shipment, NOW),
    isAppError("INVALID_STATE"),
    "not before release",
  );
  await pay();
  await release();
  await assert.rejects(
    orders.markDelivered(f.ctx, operations, await order(), NOW + 11, NOW),
    (error) => isAppError("INVALID_STATE")(error) && /Record shipping before delivery/.test(error.data.message),
  );
  await orders.markShipped(f.ctx, operations, await order(), shipment, NOW + 10);
  const shipped = await order();
  assert.equal(shipped.status, "shipped");
  assert.equal(shipped.shippedAt, NOW + 10);
  assert.equal(shipped.carrier, "UPS");
  assert.equal(shipped.trackingRef, "1Z999AA10123456784");
  assert.equal(shipped.deliveredAt, undefined);
  assert.equal(shipped.fitAcceptedAt, undefined);
  const shippedMilestone = milestones().at(-1);
  assert.equal(shippedMilestone.kind, "shipped");
  assert.equal(shippedMilestone.source, "carrier");
  assert.equal(shippedMilestone.estimated, false);
  assert.match(messages().at(-1), /Delivery is not a fitting/);

  const count = milestones().length;
  await orders.markShipped(f.ctx, operations, await order(), shipment, NOW + 12);
  assert.equal(milestones().length, count, "the same shipment twice is one milestone");
  await assert.rejects(
    orders.markShipped(f.ctx, operations, await order(), { ...shipment, trackingRef: "other" }, NOW + 12),
    isAppError("INVALID_STATE"),
  );

  await orders.markDelivered(f.ctx, operations, await order(), NOW + 15, NOW + 15);
  const delivered = await order();
  assert.equal(delivered.status, "fit_review", "Delivered opens the fit review, it does not accept the fit");
  assert.equal(delivered.deliveredAt, NOW + 15);
  assert.equal(delivered.fitAcceptedAt, undefined);
  assert.match(messages().at(-1), /Delivery does not close your fit review/);
  const after = milestones().length;
  await orders.markDelivered(f.ctx, operations, await order(), NOW + 16, NOW + 16);
  assert.equal(milestones().length, after, "delivered twice is one milestone");
  assert.equal((await order()).deliveredAt, NOW + 15);
});

test("an open correction stops the house marking the suit shipped or recording production progress", async () => {
  const { f, operations, order, pay, release } = await setup();
  await pay();
  await release();
  await f.ctx.db.patch((await order())._id, { status: "correction_open" });
  await assert.rejects(
    orders.markShipped(f.ctx, operations, await order(), { carrier: "UPS", trackingRef: "x", at: NOW }, NOW),
    (error) => isAppError("INVALID_STATE")(error) && /correction is open/.test(error.data.message),
  );
  await assert.rejects(
    orders.addMilestone(
      f.ctx,
      operations,
      await order(),
      { kind: "making", label: "Making", at: NOW, source: "maker", estimated: false },
      NOW,
    ),
    isAppError("INVALID_STATE"),
  );
  await orders.addMilestone(
    f.ctx,
    operations,
    await order(),
    { kind: "note", label: "Spoke with the client", at: NOW, source: "staff", estimated: false },
    NOW,
  );
  assert.equal((await order()).status, "correction_open", "a note is still allowed and moves nothing");
});

// ------------------------------------------------------------------------------------------------
// First fit (client)
// ------------------------------------------------------------------------------------------------

test("the checklist opens the fit review, refuses unknown regions, and an issue blocks acceptance until it is cleared", async () => {
  const { f, operations, actor, order, milestones, messages, pay, release } = await setup();
  await assert.rejects(
    orders.setFirstFitChecklist(f.ctx, actor, await order(), { jacket_shoulders: "ok" }, NOW),
    isAppError("INVALID_STATE"),
    "not before the suit is in hand",
  );
  await pay();
  await release();
  await orders.markShipped(
    f.ctx,
    operations,
    await order(),
    { carrier: "UPS", trackingRef: "1Z", at: NOW + 10 },
    NOW + 10,
  );
  await assert.rejects(
    orders.setFirstFitChecklist(f.ctx, actor, await order(), { hat: "ok" }, NOW + 11),
    (error) => isAppError("INVALID_INPUT")(error) && error.data.details.unknownKeys[0] === "hat",
  );
  await orders.setFirstFitChecklist(
    f.ctx,
    actor,
    await order(),
    { jacket_shoulders: "ok", trouser_length: "issue" },
    NOW + 11,
  );
  let current = await order();
  assert.equal(current.status, "fit_review", "the client has the suit in hand, so the review opens");
  assert.deepEqual(current.firstFitChecklist, { jacket_shoulders: "ok", trouser_length: "issue" });
  assert.equal(milestones().at(-1).kind, "fit_review");
  assert.equal(milestones().at(-1).source, "client");

  await assert.rejects(
    orders.acceptFit(f.ctx, actor, await order(), NOW + 12),
    (error) =>
      isAppError("INVALID_STATE")(error) &&
      /trouser length/.test(error.data.message) &&
      error.data.details.regions[0] === "trouser_length",
  );
  await orders.setFirstFitChecklist(f.ctx, actor, await order(), { trouser_length: "ok" }, NOW + 13);
  current = await order();
  assert.deepEqual(current.firstFitChecklist, { jacket_shoulders: "ok", trouser_length: "ok" }, "saves merge");
  assert.equal(current.status, "fit_review", "saving the checklist never accepts the fit");

  await orders.acceptFit(f.ctx, actor, await order(), NOW + 14);
  current = await order();
  assert.equal(current.status, "accepted");
  assert.equal(current.fitAcceptedAt, NOW + 14);
  assert.equal(milestones().at(-1).kind, "fit_accepted");
  assert.equal(milestones().at(-1).source, "client");
  const last = messages().at(-1);
  assert.ok(last.includes(HOUSE_POLICY.verified.alterations), "the alteration promise is restated");
  assert.match(last, /does not waive that promise/);
  const audit = f.rowsOf("atelierAuditLog").find((row) => row.action === "order.acceptFit");
  assert.equal(audit.actorKind, "client");

  const count = milestones().length;
  await orders.acceptFit(f.ctx, actor, await order(), NOW + 15);
  assert.equal(milestones().length, count, "accepting twice is one acceptance");
  await assert.rejects(
    orders.setFirstFitChecklist(f.ctx, actor, await order(), { jacket_chest: "issue" }, NOW + 16),
    (error) => isAppError("INVALID_STATE")(error) && /alteration/.test(error.data.message),
  );
});

test("acceptFit is refused before the suit arrives and while a correction is open", async () => {
  const { f, actor, order, pay, release } = await setup();
  await assert.rejects(
    orders.acceptFit(f.ctx, actor, await order(), NOW),
    (error) => isAppError("INVALID_STATE")(error) && /not arrived/.test(error.data.message),
  );
  await pay();
  await release();
  await f.ctx.db.patch((await order())._id, { status: "correction_open" });
  await assert.rejects(
    orders.acceptFit(f.ctx, actor, await order(), NOW),
    (error) => isAppError("INVALID_STATE")(error) && /correction is open/.test(error.data.message),
  );
});

// ------------------------------------------------------------------------------------------------
// Ownership and views
// ------------------------------------------------------------------------------------------------

test("another account or browser never sees or touches the commission", async () => {
  const { f, actor, orderId, order } = await setup();
  assert.equal(await orders.findAccessibleOrder(f.ctx, orderId, strangerActor), null);
  assert.equal(await orders.findAccessibleOrder(f.ctx, orderId, otherGuestActor), null);
  assert.equal(await orders.findAccessibleOrder(f.ctx, orderId, { user: null, guestKey: null }), null);
  assert.equal((await orders.findAccessibleOrder(f.ctx, orderId, actor))._id, orderId);
  await assert.rejects(orders.requireOwnedOrder(f.ctx, orderId, strangerActor), isAppError("NOT_FOUND"));
  await assert.rejects(orders.requireOwnedOrder(f.ctx, orderId, otherGuestActor), isAppError("NOT_FOUND"));
  assert.equal((await orders.requireOwnedOrder(f.ctx, orderId, actor))._id, orderId);
  void order;
  assert.equal((await orders.listForActor(f.ctx, strangerActor)).length, 0);
  assert.equal((await orders.listForActor(f.ctx, actor)).length, 1);
  assert.equal((await orders.listForActor(f.ctx, { user: null, guestKey: null })).length, 0);
});

test("listForActor lists the account's commissions and the browser's guest ones together, newest activity first, each once", async () => {
  const { f, client, actor, orderId, order } = await setup();
  const accountOrder = await order();
  const guestOrderId = await f.ctx.db.insert("atelierOrders", {
    guestKey: GUEST_KEY,
    caseId: accountOrder.caseId,
    quoteId: accountOrder.quoteId,
    revisionId: accountOrder.revisionId,
    draftId: accountOrder.draftId,
    spec: accountOrder.spec,
    specHash: accountOrder.specHash,
    status: "preflight",
    payment: { state: "none" },
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW + DAY,
  });
  const both = { user: client, guestKey: GUEST_KEY };
  assert.deepEqual(
    (await orders.listForActor(f.ctx, both)).map((row) => row._id),
    [guestOrderId, orderId],
    "the guest commission is listed beside the account's, most recent activity first",
  );
  assert.deepEqual(
    (await orders.listForActor(f.ctx, actor)).map((row) => row._id),
    [orderId],
    "an account without this browser's key sees only its own",
  );
  assert.deepEqual(
    (await orders.listForActor(f.ctx, guestActor)).map((row) => row._id),
    [guestOrderId],
    "the browser alone sees only the guest one",
  );
  assert.equal((await orders.listForActor(f.ctx, otherGuestActor)).length, 0);
  await f.ctx.db.patch(orderId, { updatedAt: NOW + 2 * DAY });
  assert.deepEqual(
    (await orders.listForActor(f.ctx, both)).map((row) => row._id),
    [orderId, guestOrderId],
    "sorted by updatedAt across both owners",
  );
  assert.equal(new Set((await orders.listForActor(f.ctx, both)).map((row) => row._id)).size, 2, "no duplicates");
});

test("the client's view labels every state, every milestone source and the estimate, and shows the frozen design", async () => {
  const { f, operations, actor, client, order, pay, release, revision } = await setup({ eventDate: NOW + 100 * DAY });
  await pay();
  await release();
  await orders.setRisk(
    f.ctx,
    operations,
    await order(),
    { riskNote: "Mill delivery slipped a week.", estimatedReadyAt: NOW + 50 * DAY },
    NOW + 3,
  );
  const view = await orders.toOrderView(f.ctx, await order(), NOW + 4);
  assert.equal(view.status, "released");
  assert.equal(view.statusLabel, ORDER_STATUS_LABELS.released);
  assert.equal(view.payment.state, "confirmed");
  assert.equal(view.payment.stateLabel, PAYMENT_STATE_LABELS.confirmed);
  assert.equal(view.payment.amountUsd, 2580);
  assert.ok(!("reference" in view.payment), "the provider reference stays with the house");
  assert.equal(view.quoteVersion, 1);
  assert.equal(view.totalUsd, 2580);
  assert.deepEqual(view.spec, revision.spec);
  assert.equal(view.specHash, revision.specHash);
  assert.ok(
    view.lines.some((line) => line.label === "Cloth" && line.productionId === CLOTH),
    "the order-book lines carry production ids",
  );
  assert.equal(view.cloth.code, CLOTH);
  assert.ok(view.summary.includes(view.cloth.name));
  assert.deepEqual(
    view.milestones.map((m) => [m.kind, m.sourceLabel, m.estimated]),
    [
      ["quote_accepted", "You", false],
      ["payment", "The house", false],
      ["released", "The house", false],
      ["risk", "The house", false],
      ["estimated_ready", "The house", true],
    ],
  );
  assert.equal(view.estimatedReadyAt, NOW + 50 * DAY);
  assert.equal(view.eventDate, NOW + 100 * DAY);
  assert.equal(view.eventReadiness.state, "comfortable");
  assert.equal(view.riskNote, "Mill delivery slipped a week.");
  assert.equal(view.fitRoute, "atelier");
  assert.equal(view.fitProfileVersion, null);
  assert.equal(view.firstFitChecklist.length, FIT_REGIONS.length);
  assert.ok(view.firstFitChecklist.every((entry) => entry.state === "unchecked" && entry.label.length > 0));
  assert.deepEqual(view.corrections, []);
  assert.equal(view.carrier, null);
  assert.equal(view.deliveredAt, null);
  assert.ok(!("guestKey" in view) && !("userId" in view));
  for (const key of Object.keys(view)) assert.notEqual(view[key], undefined, `${key} is never undefined`);

  const summaries = await Promise.all(
    (await orders.listForActor(f.ctx, actor)).map((row) => orders.toOrderSummary(f.ctx, row)),
  );
  assert.equal(summaries[0].statusLabel, ORDER_STATUS_LABELS.released);
  assert.equal(summaries[0].paymentStateLabel, PAYMENT_STATE_LABELS.confirmed);
  assert.equal(summaries[0].clothName, view.cloth.name);

  const staffView = await orders.toStaffOrderView(f.ctx, await order(), NOW + 4);
  assert.equal(staffView.clientName, "Nia Okafor");
  assert.equal(staffView.paymentReference, "sq_1");
  assert.equal(staffView.paymentProvider, "Square");
  assert.equal(staffView.makerRef, "CLT-2026-0301");
  assert.equal(staffView.releasedBy, "Kofi");
  assert.deepEqual(staffView.blockers, []);
  void client;

  const board = await orders.listByStatus(f.ctx);
  assert.equal(board.length, 1);
  assert.equal((await orders.listByStatus(f.ctx, "released")).length, 1);
  assert.equal((await orders.listByStatus(f.ctx, "making")).length, 0);
  const staffSummary = await orders.toStaffOrderSummary(f.ctx, board[0]);
  assert.equal(staffSummary.hasRisk, true);
});

test("money and dates read the same everywhere", () => {
  assert.equal(orders.formatUsd(2773.5), "$2,773.50");
  assert.equal(orders.formatUsd(0), "$0.00");
  assert.equal(orders.formatUsd(-2400), "-$2,400.00");
  assert.equal(orders.formatUsd(1234567.891), "$1,234,567.89");
  assert.equal(orders.formatDay(Date.UTC(2026, 9, 31)), "October 31, 2026");
  assert.equal(orders.formatDay(Date.UTC(2027, 0, 1)), "January 1, 2027");
});
