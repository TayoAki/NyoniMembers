import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  acceptFit as acceptFitOnOrder,
  addMilestone as addMilestoneToOrder,
  findAccessibleOrder,
  listByStatus,
  listForActor,
  markDelivered as markOrderDelivered,
  markShipped as markOrderShipped,
  MILESTONE_SOURCE_LABELS,
  ORDER_MILESTONE_KINDS,
  preflightBlockers,
  recordPayment as recordOrderPayment,
  releaseOrder,
  requireOrder,
  requireOwnedOrder,
  setFirstFitChecklist as setChecklistOnOrder,
  setRisk as setOrderRisk,
  toOrderSummary,
  toOrderView,
  toPaymentView,
  toStaffOrderSummary,
  toStaffOrderView,
} from "../model/atelier/orders";
import {
  PRODUCTION_MILESTONE_KINDS,
  type ProductionMilestoneKind,
  vChecklistState,
  vCorrectionKind,
  vCorrectionStatus,
  vDescribedLine,
  vFitRegion,
  vFitRoute,
  vMilestoneSource,
  vOrderStatus,
  vPaymentState,
  vProductionMilestoneKind,
  vSuitSpec,
} from "../shared/atelier/validators";
import { requireActor, requireStaff, resolveActor } from "./access";
import { ownerArgs, vClothSummary } from "./views";

/**
 * Atelier orders: released commissions (contract §5.9; journeys C22, C23, O05; screens S29, S30, A05).
 * Thin wrappers over `convex/model/atelier/orders.ts`. The client sees real stages, sourced milestones
 * and estimates labelled as such; staff run preflight, release, record milestones and payments. Nothing
 * here can change a released order's specification: that is a new proposal on the case.
 */

export { MILESTONE_SOURCE_LABELS, ORDER_MILESTONE_KINDS, PRODUCTION_MILESTONE_KINDS, type ProductionMilestoneKind };
/** The kinds `addMilestone` records by hand; the others are written only by their own action. */
export const vMilestoneKind = vProductionMilestoneKind;

export const vPaymentView = v.object({
  state: vPaymentState,
  stateLabel: v.string(),
  amountUsd: v.union(v.number(), v.null()),
  confirmedAt: v.union(v.number(), v.null()),
});
export type PaymentView = Infer<typeof vPaymentView>;

export const vMilestoneView = v.object({
  milestoneId: v.id("atelierOrderMilestones"),
  kind: v.string(),
  label: v.string(),
  at: v.number(),
  source: vMilestoneSource,
  sourceLabel: v.string(),
  note: v.union(v.string(), v.null()),
  /** True for a date the house expects, not one that happened; the UI labels it "Estimate". */
  estimated: v.boolean(),
});
export type MilestoneView = Infer<typeof vMilestoneView>;

export const vChecklistEntryView = v.object({ region: vFitRegion, label: v.string(), state: vChecklistState });
export type ChecklistEntryView = Infer<typeof vChecklistEntryView>;

export const vCorrectionSummaryView = v.object({
  correctionId: v.id("atelierCorrections"),
  kind: vCorrectionKind,
  kindLabel: v.string(),
  status: vCorrectionStatus,
  statusLabel: v.string(),
  createdAt: v.number(),
});
export type CorrectionSummaryView = Infer<typeof vCorrectionSummaryView>;

/** `eventReadiness` from policy.ts: how the event date sits against the house's making time. */
export const vEventReadiness = v.object({
  state: v.union(v.literal("comfortable"), v.literal("tight"), v.literal("unlikely"), v.literal("none")),
  daysLeft: v.union(v.number(), v.null()),
  copy: v.string(),
});

export const vOrderView = v.object({
  _id: v.id("atelierOrders"),
  caseId: v.id("atelierCases"),
  quoteId: v.id("atelierQuotes"),
  quoteVersion: v.union(v.number(), v.null()),
  totalUsd: v.union(v.number(), v.null()),
  status: vOrderStatus,
  statusLabel: v.string(),
  payment: vPaymentView,
  /** The specification frozen at acceptance; it never changes on this row. */
  spec: vSuitSpec,
  specHash: v.string(),
  /** The order-book lines with production ids, the same the maker receives. */
  lines: v.array(vDescribedLine),
  cloth: v.union(vClothSummary, v.null()),
  summary: v.string(),
  milestones: v.array(vMilestoneView),
  /** An estimate; shown with the "Estimate" label beside it. */
  estimatedReadyAt: v.union(v.number(), v.null()),
  eventDate: v.union(v.number(), v.null()),
  eventReadiness: vEventReadiness,
  fitProfileVersion: v.union(v.number(), v.null()),
  fitRoute: v.union(vFitRoute, v.null()),
  firstFitChecklist: v.array(vChecklistEntryView),
  carrier: v.union(v.string(), v.null()),
  trackingRef: v.union(v.string(), v.null()),
  releasedAt: v.union(v.number(), v.null()),
  shippedAt: v.union(v.number(), v.null()),
  deliveredAt: v.union(v.number(), v.null()),
  fitAcceptedAt: v.union(v.number(), v.null()),
  riskNote: v.union(v.string(), v.null()),
  corrections: v.array(vCorrectionSummaryView),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type OrderView = Infer<typeof vOrderView>;

export const vOrderSummary = v.object({
  _id: v.id("atelierOrders"),
  status: vOrderStatus,
  statusLabel: v.string(),
  paymentState: vPaymentState,
  paymentStateLabel: v.string(),
  summary: v.string(),
  clothName: v.union(v.string(), v.null()),
  eventDate: v.union(v.number(), v.null()),
  estimatedReadyAt: v.union(v.number(), v.null()),
  releasedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type OrderSummaryView = Infer<typeof vOrderSummary>;

export const vStaffOrderSummary = v.object({
  ...vOrderSummary.fields,
  caseId: v.id("atelierCases"),
  clientName: v.string(),
  makerRef: v.union(v.string(), v.null()),
  hasRisk: v.boolean(),
});
export type StaffOrderSummaryView = Infer<typeof vStaffOrderSummary>;

export const vStaffOrderView = v.object({
  ...vOrderView.fields,
  clientName: v.string(),
  clientEmail: v.union(v.string(), v.null()),
  makerRef: v.union(v.string(), v.null()),
  paymentReference: v.union(v.string(), v.null()),
  paymentProvider: v.union(v.string(), v.null()),
  /** First name of the member of the house who released it. */
  releasedBy: v.union(v.string(), v.null()),
  /** What stands between this commission and release; empty when it may go. */
  blockers: v.array(v.string()),
});
export type StaffOrderView = Infer<typeof vStaffOrderView>;

/** Region keys from FIT_REGIONS; unknown keys are refused. */
export const vChecklistInput = v.record(v.string(), vChecklistState);

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

/** S29, S30. The client's commission, or null for one they do not own. */
export const get = query({
  args: { ...ownerArgs, orderId: v.id("atelierOrders") },
  returns: v.union(vOrderView, v.null()),
  handler: async (ctx, { guestKey, orderId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const order = await findAccessibleOrder(ctx, orderId, actor);
    return order ? toOrderView(ctx, order) : null;
  },
});

/** S29. Every commission the account or this browser owns, most recent activity first. */
export const listMine = query({
  args: ownerArgs,
  returns: v.array(vOrderSummary),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    const orders = await listForActor(ctx, actor);
    return Promise.all(orders.map((order) => toOrderSummary(ctx, order)));
  },
});

/**
 * S30. Saves the first-fit checklist (keys from FIT_REGIONS, values unchecked/ok/issue), merged with what
 * was saved before. Opens the fit review on a shipped or collected suit; never closes it. A flagged
 * issue is taken further with `corrections.request`.
 */
export const setFirstFitChecklist = mutation({
  args: { ...ownerArgs, orderId: v.id("atelierOrders"), checklist: vChecklistInput },
  returns: v.null(),
  handler: async (ctx, { guestKey, orderId, checklist }) => {
    const actor = await requireActor(ctx, guestKey);
    const order = await requireOwnedOrder(ctx, orderId, actor);
    await setChecklistOnOrder(ctx, actor, order, checklist);
    return null;
  },
});

/** C23. The client accepts the fit of a suit in hand. The house's alteration promise stands regardless. */
export const acceptFit = mutation({
  args: { ...ownerArgs, orderId: v.id("atelierOrders") },
  returns: v.null(),
  handler: async (ctx, { guestKey, orderId }) => {
    const actor = await requireActor(ctx, guestKey);
    const order = await requireOwnedOrder(ctx, orderId, actor);
    await acceptFitOnOrder(ctx, actor, order);
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (operations)
// ------------------------------------------------------------------------------------------------

/** A05. Commissions in one status, or all of them, most recent activity first. */
export const list = query({
  args: { status: v.optional(vOrderStatus) },
  returns: v.array(vStaffOrderSummary),
  handler: async (ctx, { status }) => {
    await requireStaff(ctx, "operations");
    const orders = await listByStatus(ctx, status);
    return Promise.all(orders.map((order) => toStaffOrderSummary(ctx, order)));
  },
});

/** A05. One commission with its blockers and payment record. A malformed id reads as null. */
export const staffGet = query({
  args: { orderId: v.string() },
  returns: v.union(vStaffOrderView, v.null()),
  handler: async (ctx, { orderId }) => {
    await requireStaff(ctx, "operations");
    const id = ctx.db.normalizeId("atelierOrders", orderId);
    if (!id) return null;
    const order = await ctx.db.get(id);
    return order ? toStaffOrderView(ctx, order) : null;
  },
});

/** O05. What stands between this commission and the cutter; an empty list means release may go ahead. */
export const preflight = query({
  args: { orderId: v.id("atelierOrders") },
  returns: v.object({ blockers: v.array(v.string()) }),
  handler: async (ctx, { orderId }) => {
    await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    return { blockers: await preflightBlockers(ctx, order) };
  },
});

/** O05. Releases the immutable package to the maker. RELEASE_BLOCKED carries the blockers. */
export const release = mutation({
  args: { orderId: v.id("atelierOrders"), makerRef: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, makerRef }) => {
    const staff = await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    await releaseOrder(ctx, staff, order, makerRef);
    return null;
  },
});

/**
 * O05. A dated, sourced milestone of a production kind. Facts of kind making/quality_review/shipped/collected/fit_review
 * advance the status; estimates never do. Quote acceptance, payment, release, delivery, fit acceptance and
 * corrections are written only by their own actions and are refused here.
 */
export const addMilestone = mutation({
  args: {
    orderId: v.id("atelierOrders"),
    kind: vMilestoneKind,
    label: v.string(),
    at: v.number(),
    source: vMilestoneSource,
    note: v.optional(v.string()),
    estimated: v.boolean(),
  },
  returns: v.id("atelierOrderMilestones"),
  handler: async (ctx, { orderId, ...input }) => {
    const staff = await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    return addMilestoneToOrder(ctx, staff, order, input);
  },
});

/** O05. Shipped with a carrier and tracking reference; the fit review stays open. */
export const markShipped = mutation({
  args: { orderId: v.id("atelierOrders"), carrier: v.string(), trackingRef: v.string(), at: v.number() },
  returns: v.null(),
  handler: async (ctx, { orderId, ...input }) => {
    const staff = await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    await markOrderShipped(ctx, staff, order, input);
    return null;
  },
});

/** O05. The carrier delivered; the commission moves to fit review, never to accepted. */
export const markDelivered = mutation({
  args: { orderId: v.id("atelierOrders"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, { orderId, at }) => {
    const staff = await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    await markOrderDelivered(ctx, staff, order, at);
    return null;
  },
});

/**
 * O04/O05. Records what the house's payment system reported, idempotent on the provider's reference.
 * Operations or finance. `changed` is false when the same reference in the same state was already recorded.
 */
export const recordPayment = mutation({
  args: {
    orderId: v.id("atelierOrders"),
    state: vPaymentState,
    amountUsd: v.number(),
    reference: v.string(),
    provider: v.string(),
  },
  returns: v.object({ changed: v.boolean(), payment: vPaymentView }),
  handler: async (ctx, { orderId, ...input }) => {
    const staff = await requireStaff(ctx, ["operations", "finance"]);
    const order = await requireOrder(ctx, orderId);
    const result = await recordOrderPayment(ctx, staff, order, input);
    return { changed: result.changed, payment: toPaymentView(result.payment) };
  },
});

/** C22. Records a risk to the client's date, told to them on the case, with any new estimate labelled as one. */
export const setRisk = mutation({
  args: { orderId: v.id("atelierOrders"), riskNote: v.string(), estimatedReadyAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { orderId, ...input }) => {
    const staff = await requireStaff(ctx, "operations");
    const order = await requireOrder(ctx, orderId);
    await setOrderRisk(ctx, staff, order, input);
    return null;
  },
});
