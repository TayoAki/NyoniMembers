import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, isOwner, staffDisplayName, type Actor, type Owned } from "../../atelier/access";
import type {
  ChecklistEntryView,
  MilestoneView,
  OrderSummaryView,
  OrderView,
  PaymentView,
  StaffOrderSummaryView,
  StaffOrderView,
} from "../../atelier/orders";
import { appError } from "../../lib/errors";
import {
  CORRECTION_KIND_LABELS,
  CORRECTION_STATUS_LABELS,
  FIT_PROFILE_STATUS_LABELS,
  FIT_REGION_LABELS,
  FIT_REGIONS,
  MILESTONE_SOURCE_LABELS,
  ORDER_MILESTONE_KINDS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATE_LABELS,
  QUOTE_STATUS_LABELS,
  type ChecklistState,
  type MilestoneSource,
  type OrderMilestoneKind,
  type OrderStatus,
  type PaymentState,
} from "../../shared/atelier/enums";
import { eventReadiness, HOUSE_POLICY } from "../../shared/atelier/policy";
import { describeSpec, specSummary, validateSpec } from "../../shared/atelier/spec";
import { PAYMENT_TRANSITIONS, STATUS_FOR_MILESTONE } from "../../shared/atelier/transitions";
import { clothSummary, getEntry, specNames } from "./catalogue";
import { appendMessage } from "./case_core";

type Ctx = QueryCtx | MutationCtx;
type Order = Doc<"atelierOrders">;
type Milestone = Doc<"atelierOrderMilestones">;
type User = Doc<"users">;
type Payment = Order["payment"];

/**
 * Released commissions (contract §5.9; journeys C22, C23, O05; screens S29, S30, A05). The production
 * line, from SCREENS-AND-STATES.md:
 *
 *   preflight ──▶ released ──▶ making ──▶ quality_review ──▶ shipped | collected ──▶ fit_review ──▶ accepted
 *                                                                                        │
 *                                                                                        └──▶ correction_open (corrections domain)
 *
 * Every status change is a dated, sourced milestone; an estimated milestone never moves the status. A
 * carrier's "Delivered" opens the fit review and never closes it; only the client accepts the fit. An
 * order's specification is frozen at acceptance: nothing here patches `spec` or `specHash`, and a change
 * after release is a new proposal on the case, never an edit of the released package (O05).
 */

export { ORDER_MILESTONE_KINDS, type OrderMilestoneKind };

/** Position on the line, so production never runs backwards. Shipped and collected share a place. */
const STATUS_RANK: Record<OrderStatus, number> = {
  preflight: 0,
  released: 1,
  making: 2,
  quality_review: 3,
  shipped: 4,
  collected: 4,
  fit_review: 5,
  accepted: 6,
  correction_open: 6,
  cancelled: 7,
};

export { PAYMENT_TRANSITIONS };

export { MILESTONE_SOURCE_LABELS };

/** Payment states that let a commission be released; "none" and "failed" block it. */
const RELEASABLE_PAYMENT_STATES: readonly PaymentState[] = ["pending", "confirmed"];
const SHIPPABLE_STATUSES: readonly OrderStatus[] = ["released", "making", "quality_review"];
const IN_HAND_STATUSES: readonly OrderStatus[] = ["shipped", "collected", "fit_review"];
const CHECKLIST_STATUSES: readonly OrderStatus[] = ["shipped", "collected", "fit_review", "correction_open"];

const ORDERS_PER_OWNER_MAX = 100;
const ORDERS_PER_STATUS_MAX = 100;
const ORDERS_PER_CASE_MAX = 20;
const MILESTONES_MAX = 200;
const CORRECTIONS_MAX = 50;
export const ORDER_TEXT_MAX = 2000;

// ------------------------------------------------------------------------------------------------
// Words for messages
// ------------------------------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "$2,773.50"; negative amounts keep their sign. Runs the same in Convex and in the browser. */
export function formatUsd(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".");
  return `${amount < 0 ? "-" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/** "October 31, 2026" in UTC, so a message reads the same wherever it is rendered. */
export function formatDay(ms: number): string {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function statusWord(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status].toLowerCase();
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function requireOrder(ctx: Ctx, orderId: Id<"atelierOrders">): Promise<Order> {
  const order = await ctx.db.get(orderId);
  if (!order) throw appError("NOT_FOUND", "That commission doesn't exist.");
  return order;
}

/** The client's own commission, or "not found": another client's order is never acknowledged. */
export async function requireOwnedOrder(ctx: Ctx, orderId: Id<"atelierOrders">, actor: Actor): Promise<Order> {
  const order = await ctx.db.get(orderId);
  if (!order || !isOwner(order, actor)) throw appError("NOT_FOUND", "That commission doesn't exist.");
  return order;
}

export async function findAccessibleOrder(ctx: Ctx, orderId: Id<"atelierOrders">, actor: Actor): Promise<Order | null> {
  const order = await ctx.db.get(orderId);
  return order && isOwner(order, actor) ? order : null;
}

/** Commissions owned by the account or the browser, newest activity first. */
export async function listForActor(ctx: Ctx, actor: Actor): Promise<Order[]> {
  if (actor.user) {
    const userId = actor.user._id;
    return ctx.db
      .query("atelierOrders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(ORDERS_PER_OWNER_MAX);
  }
  if (actor.guestKey) {
    const guestKey = actor.guestKey;
    return ctx.db
      .query("atelierOrders")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(ORDERS_PER_OWNER_MAX);
  }
  return [];
}

/** A05. One status, or every status with the most recent activity first. */
export async function listByStatus(ctx: Ctx, status?: OrderStatus): Promise<Order[]> {
  if (status) {
    return ctx.db
      .query("atelierOrders")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(ORDERS_PER_STATUS_MAX);
  }
  const pages = await Promise.all(
    ORDER_STATUSES.map((candidate) =>
      ctx.db
        .query("atelierOrders")
        .withIndex("by_status", (q) => q.eq("status", candidate))
        .order("desc")
        .take(ORDERS_PER_STATUS_MAX),
    ),
  );
  return pages.flat().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function milestonesFor(ctx: Ctx, orderId: Id<"atelierOrders">): Promise<Milestone[]> {
  return ctx.db
    .query("atelierOrderMilestones")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .order("asc")
    .take(MILESTONES_MAX);
}

export async function correctionsFor(ctx: Ctx, orderId: Id<"atelierOrders">): Promise<Doc<"atelierCorrections">[]> {
  return ctx.db
    .query("atelierCorrections")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(CORRECTIONS_MAX);
}

/** The commission an accepted quote produced, found through the quote's case. */
export async function orderForQuote(
  ctx: Ctx,
  caseId: Id<"atelierCases">,
  quoteId: Id<"atelierQuotes">,
): Promise<Order | null> {
  const orders = await ctx.db
    .query("atelierOrders")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .take(ORDERS_PER_CASE_MAX);
  return orders.find((order) => order.quoteId === quoteId) ?? null;
}

// ------------------------------------------------------------------------------------------------
// Views
// ------------------------------------------------------------------------------------------------

export function toPaymentView(payment: Payment): PaymentView {
  return {
    state: payment.state,
    stateLabel: PAYMENT_STATE_LABELS[payment.state],
    amountUsd: payment.amountUsd ?? null,
    confirmedAt: payment.confirmedAt ?? null,
  };
}

function toMilestoneView(milestone: Milestone): MilestoneView {
  return {
    milestoneId: milestone._id,
    kind: milestone.kind,
    label: milestone.label,
    at: milestone.at,
    source: milestone.source,
    sourceLabel: MILESTONE_SOURCE_LABELS[milestone.source],
    note: milestone.note ?? null,
    estimated: milestone.estimated,
  };
}

/** Every region, so the checklist always shows what has not been looked at yet. */
export function checklistEntries(checklist: Order["firstFitChecklist"]): ChecklistEntryView[] {
  return FIT_REGIONS.map((region) => ({
    region,
    label: FIT_REGION_LABELS[region],
    state: checklist?.[region] ?? "unchecked",
  }));
}

export async function toOrderView(ctx: Ctx, order: Order, now: number = Date.now()): Promise<OrderView> {
  const [quote, draft, profile, names, cloth, milestones, corrections] = await Promise.all([
    ctx.db.get(order.quoteId),
    ctx.db.get(order.draftId),
    order.fitProfileId ? ctx.db.get(order.fitProfileId) : Promise.resolve(null),
    specNames(ctx, order.spec),
    clothSummary(ctx, order.spec.clothCode),
    milestonesFor(ctx, order._id),
    correctionsFor(ctx, order._id),
  ]);
  return {
    _id: order._id,
    caseId: order.caseId,
    quoteId: order.quoteId,
    quoteVersion: quote?.version ?? null,
    totalUsd: quote?.totalUsd ?? null,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    payment: toPaymentView(order.payment),
    spec: order.spec,
    specHash: order.specHash,
    lines: describeSpec(order.spec, names),
    cloth,
    summary: specSummary(order.spec, cloth?.name),
    milestones: milestones.map(toMilestoneView),
    estimatedReadyAt: order.estimatedReadyAt ?? null,
    eventDate: order.eventDate ?? null,
    eventReadiness: eventReadiness(order.eventDate, now),
    fitProfileVersion: profile?.version ?? null,
    fitRoute: draft?.fitRoute ?? null,
    firstFitChecklist: checklistEntries(order.firstFitChecklist),
    carrier: order.carrier ?? null,
    trackingRef: order.trackingRef ?? null,
    releasedAt: order.releasedAt ?? null,
    shippedAt: order.shippedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    fitAcceptedAt: order.fitAcceptedAt ?? null,
    riskNote: order.riskNote ?? null,
    corrections: corrections.map((correction) => ({
      correctionId: correction._id,
      kind: correction.kind,
      kindLabel: CORRECTION_KIND_LABELS[correction.kind],
      status: correction.status,
      statusLabel: CORRECTION_STATUS_LABELS[correction.status],
      createdAt: correction.createdAt,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function toOrderSummary(ctx: Ctx, order: Order): Promise<OrderSummaryView> {
  const cloth = await clothSummary(ctx, order.spec.clothCode);
  return {
    _id: order._id,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentState: order.payment.state,
    paymentStateLabel: PAYMENT_STATE_LABELS[order.payment.state],
    summary: specSummary(order.spec, cloth?.name),
    clothName: cloth?.name ?? null,
    eventDate: order.eventDate ?? null,
    estimatedReadyAt: order.estimatedReadyAt ?? null,
    releasedAt: order.releasedAt ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function toStaffOrderSummary(ctx: Ctx, order: Order): Promise<StaffOrderSummaryView> {
  const [summary, caseDoc] = await Promise.all([toOrderSummary(ctx, order), ctx.db.get(order.caseId)]);
  return {
    ...summary,
    caseId: order.caseId,
    clientName: caseDoc?.contact.name ?? "Client",
    makerRef: order.makerRef ?? null,
    hasRisk: order.riskNote !== undefined,
  };
}

export async function toStaffOrderView(ctx: Ctx, order: Order, now: number = Date.now()): Promise<StaffOrderView> {
  const [view, caseDoc, releasedBy, blockers] = await Promise.all([
    toOrderView(ctx, order, now),
    ctx.db.get(order.caseId),
    order.releasedByStaffId ? ctx.db.get(order.releasedByStaffId) : Promise.resolve(null),
    preflightBlockers(ctx, order, now),
  ]);
  return {
    ...view,
    clientName: caseDoc?.contact.name ?? "Client",
    clientEmail: caseDoc?.contact.email ?? null,
    makerRef: order.makerRef ?? null,
    paymentReference: order.payment.reference ?? null,
    paymentProvider: order.payment.provider ?? null,
    releasedBy: staffDisplayName(releasedBy),
    blockers,
  };
}

// ------------------------------------------------------------------------------------------------
// Creation (called by the quotes model when a quote is accepted)
// ------------------------------------------------------------------------------------------------

export type MilestoneRow = {
  kind: string;
  label: string;
  at: number;
  source: MilestoneSource;
  byUserId?: Id<"users">;
  note?: string;
  estimated: boolean;
};

export async function insertMilestone(
  ctx: MutationCtx,
  orderId: Id<"atelierOrders">,
  row: MilestoneRow,
): Promise<Id<"atelierOrderMilestones">> {
  return ctx.db.insert("atelierOrderMilestones", {
    orderId,
    kind: row.kind,
    label: row.label,
    at: row.at,
    source: row.source,
    byUserId: row.byUserId,
    note: row.note,
    estimated: row.estimated,
  });
}

export type CreateOrderInput = {
  owner: Owned;
  caseId: Id<"atelierCases">;
  quoteId: Id<"atelierQuotes">;
  revisionId: Id<"atelierRevisions">;
  draftId: Id<"atelierDrafts">;
  fitProfileId?: Id<"atelierFitProfiles">;
  spec: Order["spec"];
  specHash: string;
  eventDate?: number;
};

/** A commission in preflight with no payment recorded and "Quote accepted" as its first milestone. */
export async function createOrder(
  ctx: MutationCtx,
  input: CreateOrderInput,
  now: number = Date.now(),
): Promise<Id<"atelierOrders">> {
  const orderId = await ctx.db.insert("atelierOrders", {
    ...input.owner,
    caseId: input.caseId,
    quoteId: input.quoteId,
    revisionId: input.revisionId,
    draftId: input.draftId,
    fitProfileId: input.fitProfileId,
    spec: input.spec,
    specHash: input.specHash,
    status: "preflight",
    payment: { state: "none" },
    eventDate: input.eventDate,
    createdAt: now,
    updatedAt: now,
  });
  await insertMilestone(ctx, orderId, {
    kind: "quote_accepted",
    label: "Quote accepted",
    at: now,
    source: "client",
    estimated: false,
  });
  return orderId;
}

// ------------------------------------------------------------------------------------------------
// Preflight and release (O05)
// ------------------------------------------------------------------------------------------------

/**
 * What stands between this commission and the cutter. Each line is a fact the house must change, in
 * words the production board can show; an empty list means release may go ahead.
 */
export async function preflightBlockers(ctx: Ctx, order: Order, now: number = Date.now()): Promise<string[]> {
  const blockers: string[] = [];
  const [quote, revision, draft, profile, cloth] = await Promise.all([
    ctx.db.get(order.quoteId),
    ctx.db.get(order.revisionId),
    ctx.db.get(order.draftId),
    order.fitProfileId ? ctx.db.get(order.fitProfileId) : Promise.resolve(null),
    order.spec.clothCode ? getEntry(ctx, "cloth", order.spec.clothCode) : Promise.resolve(null),
  ]);

  if (!quote) blockers.push("The accepted quote could not be found.");
  else if (quote.status !== "accepted")
    blockers.push(
      `Quote version ${quote.version} is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()}, not accepted.`,
    );
  else if (quote.acceptedSpecHash !== order.specHash)
    blockers.push("The accepted quote prices a different design from this commission.");

  if (!revision) blockers.push("The design revision could not be found.");
  else if (revision.specHash !== order.specHash)
    blockers.push(`Design revision ${revision.revision} does not match the commission's specification.`);

  for (const error of validateSpec(order.spec)) blockers.push(`Design: ${error}`);
  if (order.spec.clothCode) {
    if (!cloth || cloth.status !== "approved") {
      blockers.push(
        `Cloth ${cloth?.name ?? order.spec.clothCode} is no longer approved; the client must choose another cloth and accept a new quote.`,
      );
    } else if (!cloth.inStock) {
      blockers.push(`Cloth ${cloth.name} is out of stock; confirm it can be sourced before release.`);
    }
  }

  const fitApproved = profile !== null && profile.status === "approved";
  const measuredAtFitting = draft?.fitRoute === "atelier";
  if (!fitApproved && !measuredAtFitting) {
    if (profile) {
      blockers.push(
        `Fit profile version ${profile.version} is ${FIT_PROFILE_STATUS_LABELS[profile.status].toLowerCase()}; a fitter must approve it, or record a showroom fitting.`,
      );
    } else if (draft?.fitRoute === "remote") {
      blockers.push(
        "No approved fit profile: the client chose guided measurements from home and none has been approved yet.",
      );
    } else {
      blockers.push("No fit route recorded: an approved fit profile or a showroom fitting is needed before release.");
    }
  }

  if (!RELEASABLE_PAYMENT_STATES.includes(order.payment.state)) {
    blockers.push(
      order.payment.state === "none" ? "Payment not recorded." : `${PAYMENT_STATE_LABELS[order.payment.state]}.`,
    );
  }

  const readiness = eventReadiness(order.eventDate, now);
  if (readiness.state === "unlikely" && order.riskNote === undefined) {
    blockers.push(
      readiness.daysLeft !== null && readiness.daysLeft < 0
        ? "The event date has passed; record a risk note confirming the client still wants the commission before release."
        : `The event is ${readiness.daysLeft} days away, inside the house's making time; record a risk note acknowledging this with the client before release.`,
    );
  }
  return blockers;
}

/** The released package is immutable: the same ids the client approved go to the maker (O05). */
export async function releaseOrder(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  makerRef: string,
  now: number = Date.now(),
): Promise<void> {
  if (order.status === "cancelled") throw appError("INVALID_STATE", "This commission was cancelled.");
  if (order.status !== "preflight") {
    throw appError(
      "INVALID_STATE",
      `This commission was released on ${formatDay(order.releasedAt ?? order.updatedAt)} and its specification cannot change. A change is a new proposal on the case.`,
    );
  }
  const ref = makerRef.trim();
  if (!ref) throw appError("INVALID_INPUT", "Give the maker's reference for this release.");
  const blockers = await preflightBlockers(ctx, order, now);
  if (blockers.length > 0) {
    throw appError("RELEASE_BLOCKED", `This commission cannot be released yet. ${blockers.join(" ")}`, { blockers });
  }
  await ctx.db.patch(order._id, {
    status: "released",
    releasedAt: now,
    releasedByStaffId: staff._id,
    makerRef: ref,
    updatedAt: now,
  });
  await insertMilestone(ctx, order._id, {
    kind: "released",
    label: ORDER_STATUS_LABELS.released,
    at: now,
    source: "staff",
    byUserId: staff._id,
    estimated: false,
  });
  await appendMessage(
    ctx,
    order.caseId,
    {
      author: "system",
      body: `Your commission has been released to the cutter. ${HOUSE_POLICY.verified.leadTime} Any date you see before the house confirms it is an estimate.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "order.release",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { makerRef: ref, specHash: order.specHash },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Production milestones (staff)
// ------------------------------------------------------------------------------------------------

/** Why production progress cannot be recorded on this commission right now. */
function assertProductionOpen(order: Order): void {
  switch (order.status) {
    case "cancelled":
      throw appError("INVALID_STATE", "This commission was cancelled.");
    case "preflight":
      throw appError("INVALID_STATE", "Release the commission before recording production.");
    case "correction_open":
      throw appError(
        "INVALID_STATE",
        "A correction is open on this commission; resolve it before recording production progress.",
      );
    case "accepted":
      throw appError(
        "INVALID_STATE",
        "The fit on this commission has been accepted; there is no production left to record.",
      );
    default:
      return;
  }
}

export type StaffMilestoneInput = {
  kind: OrderMilestoneKind;
  label: string;
  at: number;
  source: MilestoneSource;
  note?: string;
  estimated: boolean;
};

/**
 * Records a dated, sourced milestone. A fact of kind making, quality_review, shipped, collected or
 * fit_review moves the status forward; an estimate of any kind moves nothing (C22: estimates are
 * labelled, never promoted).
 */
export async function addMilestone(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  input: StaffMilestoneInput,
  now: number = Date.now(),
): Promise<Id<"atelierOrderMilestones">> {
  const label = input.label.trim();
  if (!label) throw appError("INVALID_INPUT", "Give the milestone a label.");
  if (!Number.isFinite(input.at)) throw appError("INVALID_INPUT", "Give the milestone a date.");
  if (order.status === "cancelled") throw appError("INVALID_STATE", "This commission was cancelled.");
  const target = input.estimated ? undefined : STATUS_FOR_MILESTONE[input.kind];
  if (target) {
    assertProductionOpen(order);
    if (STATUS_RANK[target] < STATUS_RANK[order.status]) {
      throw appError(
        "INVALID_STATE",
        `A commission that is ${statusWord(order.status)} cannot go back to ${statusWord(target)}.`,
      );
    }
  }
  const id = await insertMilestone(ctx, order._id, {
    kind: input.kind,
    label,
    at: input.at,
    source: input.source,
    byUserId: staff._id,
    note: input.note?.trim() || undefined,
    estimated: input.estimated,
  });
  const patch: { updatedAt: number; status?: OrderStatus } = { updatedAt: now };
  if (target && target !== order.status) patch.status = target;
  await ctx.db.patch(order._id, patch);
  await audit(
    ctx,
    {
      actor: staff,
      action: "order.milestone",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { kind: input.kind, estimated: input.estimated, status: patch.status ?? order.status },
    },
    now,
  );
  return id;
}

export type ShipmentInput = { carrier: string; trackingRef: string; at: number };

/** Shipped is a carrier fact: the fit review opens on arrival and is never closed by shipping. */
export async function markShipped(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  input: ShipmentInput,
  now: number = Date.now(),
): Promise<void> {
  const carrier = input.carrier.trim();
  const trackingRef = input.trackingRef.trim();
  if (!carrier || !trackingRef) throw appError("INVALID_INPUT", "Give the carrier and the tracking reference.");
  if (!Number.isFinite(input.at))
    throw appError("INVALID_INPUT", "Give the date the parcel was handed to the carrier.");
  if (order.status === "shipped" && order.carrier === carrier && order.trackingRef === trackingRef) return;
  if (!SHIPPABLE_STATUSES.includes(order.status)) {
    assertProductionOpen(order);
    throw appError("INVALID_STATE", `This commission is already ${statusWord(order.status)}.`);
  }
  await ctx.db.patch(order._id, { status: "shipped", shippedAt: input.at, carrier, trackingRef, updatedAt: now });
  await insertMilestone(ctx, order._id, {
    kind: "shipped",
    label: ORDER_STATUS_LABELS.shipped,
    at: input.at,
    source: "carrier",
    byUserId: staff._id,
    note: `${carrier} · ${trackingRef}`,
    estimated: false,
  });
  await appendMessage(
    ctx,
    order.caseId,
    {
      author: "system",
      body: `Shipped with ${carrier}, tracking ${trackingRef}. Delivery is not a fitting: your fit review opens when the suit arrives, and the house will refine anything that needs it.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "order.ship",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { carrier, trackingRef },
    },
    now,
  );
}

/** A carrier's "Delivered" opens the fit review (C23); only the client's acceptance closes it. */
export async function markDelivered(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  at: number,
  now: number = Date.now(),
): Promise<void> {
  if (!Number.isFinite(at)) throw appError("INVALID_INPUT", "Give the delivery date.");
  if (
    order.deliveredAt !== undefined &&
    (order.status === "fit_review" || order.status === "accepted" || order.status === "correction_open")
  )
    return;
  if (order.status !== "shipped" && order.status !== "collected") {
    assertProductionOpen(order);
    throw appError("INVALID_STATE", "Record shipping before delivery.");
  }
  await ctx.db.patch(order._id, { status: "fit_review", deliveredAt: at, updatedAt: now });
  await insertMilestone(ctx, order._id, {
    kind: "delivered",
    label: "Delivered · fit review open",
    at,
    source: "carrier",
    byUserId: staff._id,
    estimated: false,
  });
  await appendMessage(
    ctx,
    order.caseId,
    {
      author: "system",
      body: `Your suit was delivered on ${formatDay(at)}. Delivery does not close your fit review: go through the first-fit checklist when you have tried it on, and tell the house about anything that needs refining.`,
    },
    now,
  );
  await audit(
    ctx,
    { actor: staff, action: "order.deliver", targetTable: "atelierOrders", targetId: order._id, meta: { at } },
    now,
  );
}

export type PaymentInput = { state: PaymentState; amountUsd: number; reference: string; provider: string };

function paymentMessage(payment: Payment): string | null {
  const amount = payment.amountUsd !== undefined ? ` · ${formatUsd(payment.amountUsd)}` : "";
  switch (payment.state) {
    case "pending":
      return `Payment pending${amount}. The house is confirming it with ${payment.provider ?? "the payment provider"}.`;
    case "confirmed":
      return `Payment confirmed${amount}.`;
    case "failed":
      return "Payment did not go through. Nothing in your design has changed and nothing has been charged twice; your concierge will be in touch.";
    case "refunded_partial":
      return `Partly refunded${amount}. The remainder is explained on your aftercare case.`;
    case "refunded":
      return `Refunded${amount}.`;
    default:
      return null;
  }
}

/**
 * Records a payment the house's real payment system reported, idempotent on the provider's reference:
 * the same reference in the same state is one record and one milestone however many times it arrives
 * (cross-cutting scenario 10). A record never implies production: release is a separate decision.
 */
export async function recordPayment(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  input: PaymentInput,
  now: number = Date.now(),
): Promise<{ changed: boolean; payment: Payment }> {
  const reference = input.reference.trim();
  const provider = input.provider.trim();
  if (!reference || !provider) throw appError("INVALID_INPUT", "Give the payment provider and its reference.");
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0)
    throw appError("INVALID_INPUT", "Give the amount recorded by the provider.");
  if (input.state === "none")
    throw appError("INVALID_INPUT", "Record what the provider reported: pending, confirmed, failed or a refund.");
  const current = order.payment;
  if (current.reference === reference && current.state === input.state) return { changed: false, payment: current };
  if (!PAYMENT_TRANSITIONS[current.state].includes(input.state)) {
    throw appError(
      "INVALID_STATE",
      `Payment cannot move from "${PAYMENT_STATE_LABELS[current.state]}" to "${PAYMENT_STATE_LABELS[input.state]}".`,
    );
  }
  const payment: Payment = {
    state: input.state,
    amountUsd: input.amountUsd,
    reference,
    provider,
    ...(input.state === "confirmed"
      ? { confirmedAt: now }
      : current.confirmedAt !== undefined
        ? { confirmedAt: current.confirmedAt }
        : {}),
  };
  await ctx.db.patch(order._id, { payment, updatedAt: now });
  await insertMilestone(ctx, order._id, {
    kind: "payment",
    label: PAYMENT_STATE_LABELS[input.state],
    at: now,
    source: "staff",
    byUserId: staff._id,
    note: `${provider} · ${reference}`,
    estimated: false,
  });
  const body = paymentMessage(payment);
  if (body) await appendMessage(ctx, order.caseId, { author: "system", body }, now);
  await audit(
    ctx,
    {
      actor: staff,
      action: "order.payment",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { state: input.state, reference, provider, amountUsd: input.amountUsd },
    },
    now,
  );
  return { changed: true, payment };
}

export type RiskInput = { riskNote: string; estimatedReadyAt?: number };

/** C22: a risk to the date is told to the client and recorded, with any new estimate labelled as one. */
export async function setRisk(
  ctx: MutationCtx,
  staff: User,
  order: Order,
  input: RiskInput,
  now: number = Date.now(),
): Promise<void> {
  const riskNote = input.riskNote.trim();
  if (!riskNote) throw appError("INVALID_INPUT", "Say what the risk to the date is.");
  if (riskNote.length > ORDER_TEXT_MAX)
    throw appError("INVALID_INPUT", `Keep the risk note under ${ORDER_TEXT_MAX} characters.`);
  if (input.estimatedReadyAt !== undefined && !Number.isFinite(input.estimatedReadyAt))
    throw appError("INVALID_INPUT", "Give the estimate as a date.");
  if (order.status === "cancelled") throw appError("INVALID_STATE", "This commission was cancelled.");
  if (order.status === "accepted")
    throw appError("INVALID_STATE", "The fit on this commission has been accepted; there is no date left at risk.");
  await ctx.db.patch(order._id, {
    riskNote,
    ...(input.estimatedReadyAt !== undefined ? { estimatedReadyAt: input.estimatedReadyAt } : {}),
    updatedAt: now,
  });
  await insertMilestone(ctx, order._id, {
    kind: "risk",
    label: "Risk to your date noted",
    at: now,
    source: "staff",
    byUserId: staff._id,
    note: riskNote,
    estimated: false,
  });
  if (input.estimatedReadyAt !== undefined) {
    await insertMilestone(ctx, order._id, {
      kind: "estimated_ready",
      label: "Estimated ready",
      at: input.estimatedReadyAt,
      source: "staff",
      byUserId: staff._id,
      estimated: true,
    });
  }
  const estimate =
    input.estimatedReadyAt !== undefined
      ? ` The current estimate for your suit to be ready is ${formatDay(input.estimatedReadyAt)}; it is an estimate, not a promise.`
      : "";
  await appendMessage(
    ctx,
    order.caseId,
    {
      author: "system",
      body: `The house has noted a risk to your date: ${riskNote}${estimate} Nothing in your design changes without your decision.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "order.risk",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { estimatedReadyAt: input.estimatedReadyAt ?? null },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// First fit (client)
// ------------------------------------------------------------------------------------------------

function isFitRegion(key: string): key is (typeof FIT_REGIONS)[number] {
  return (FIT_REGIONS as readonly string[]).includes(key);
}

/**
 * S30. Saves the client's first-fit checklist, merging with what they saved before. The first save on a
 * shipped or collected suit opens the fit review; nothing here closes it, and a flagged issue goes to
 * `corrections.request`, not to a status change.
 */
export async function setFirstFitChecklist(
  ctx: MutationCtx,
  actor: Actor,
  order: Order,
  checklist: Record<string, ChecklistState>,
  now: number = Date.now(),
): Promise<void> {
  const unknownKeys = Object.keys(checklist).filter((key) => !isFitRegion(key));
  if (unknownKeys.length > 0)
    throw appError("INVALID_INPUT", "The checklist names a region the house does not know.", { unknownKeys });
  if (!CHECKLIST_STATUSES.includes(order.status)) {
    throw appError(
      "INVALID_STATE",
      order.status === "accepted"
        ? "You have accepted the fit of this suit. If something has changed, ask the house for an alteration."
        : order.status === "cancelled"
          ? "This commission was cancelled."
          : "Your suit has not been shipped yet; the checklist opens when it arrives.",
    );
  }
  const merged = { ...(order.firstFitChecklist ?? {}), ...checklist };
  const opensReview = order.status === "shipped" || order.status === "collected";
  await ctx.db.patch(order._id, {
    firstFitChecklist: merged,
    updatedAt: now,
    ...(opensReview ? { status: "fit_review" as const } : {}),
  });
  if (opensReview) {
    await insertMilestone(ctx, order._id, {
      kind: "fit_review",
      label: ORDER_STATUS_LABELS.fit_review,
      at: now,
      source: "client",
      estimated: false,
    });
  }
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "order.checklist",
      targetTable: "atelierOrders",
      targetId: order._id,
      meta: { regions: Object.keys(checklist) },
    },
    now,
  );
}

/**
 * C23. The client accepts the fit. Allowed with the suit in hand (shipped, collected or in fit review)
 * and no region still flagged as an issue. Accepting does not waive the house's alteration promise.
 */
export async function acceptFit(ctx: MutationCtx, actor: Actor, order: Order, now: number = Date.now()): Promise<void> {
  if (order.status === "accepted") return;
  if (!IN_HAND_STATUSES.includes(order.status)) {
    throw appError(
      "INVALID_STATE",
      order.status === "correction_open"
        ? "A correction is open on this suit; the house will ask you to reassess the fit once it is done."
        : order.status === "cancelled"
          ? "This commission was cancelled."
          : "Your suit has not arrived yet.",
    );
  }
  const issues = FIT_REGIONS.filter((region) => order.firstFitChecklist?.[region] === "issue");
  if (issues.length > 0) {
    throw appError(
      "INVALID_STATE",
      `Your checklist notes an issue with ${issues.map((region) => FIT_REGION_LABELS[region].toLowerCase()).join(", ")}. Ask the house to look at it, or mark it as fine, before accepting the fit.`,
      { regions: [...issues] },
    );
  }
  await ctx.db.patch(order._id, { status: "accepted", fitAcceptedAt: now, updatedAt: now });
  await insertMilestone(ctx, order._id, {
    kind: "fit_accepted",
    label: ORDER_STATUS_LABELS.accepted,
    at: now,
    source: "client",
    estimated: false,
  });
  await appendMessage(
    ctx,
    order.caseId,
    {
      author: "system",
      body: `Fit accepted on ${formatDay(now)}. ${HOUSE_POLICY.verified.alterations} Accepting the fit does not waive that promise.`,
    },
    now,
  );
  await audit(
    ctx,
    { actor, actorKind: "client", action: "order.acceptFit", targetTable: "atelierOrders", targetId: order._id },
    now,
  );
}
