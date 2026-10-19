import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  acceptRemedy as acceptCorrectionRemedy,
  approveRefund as approveCorrectionRefund,
  confirmRefund as confirmCorrectionRefund,
  CORRECTION_PHOTOS_MAX,
  CORRECTION_TEXT_MAX,
  CORRECTION_TRANSITIONS,
  correctionsForOrder,
  escalate as escalateCorrection,
  listByStatus,
  proposeRemedy as proposeCorrectionRemedy,
  reassess as reassessCorrection,
  requestCorrection,
  requireCorrection,
  requireOwnedCorrection,
  setStatus as setCorrectionStatus,
  STAFF_SETTABLE_STATUSES,
  toCorrectionSummary,
  toCorrectionView,
  toStaffRow,
  toStaffView,
  triage as triageCorrection,
  viewPhotosAsStaff,
} from "../model/atelier/corrections";
import {
  vCasePriority,
  vCorrectionKind,
  vCorrectionStatus,
  vDescribedLine,
  vFitRegion,
  vOrderStatus,
  vPaymentState,
  vReassessment,
  vReassessmentOutcome,
  vRefundState,
  vRemedyCoverage,
  vSuitSpec,
} from "../shared/atelier/validators";
import { requireActor, requireOwned, requireStaff, resolveActor } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier corrections: aftercare on a released commission (contract §5.10; journeys C23, C24, C25, O07;
 * screens S30, S31, S32, A07). Thin wrappers over `convex/model/atelier/corrections.ts`. A client raises
 * one issue, reads the house's proposed remedy and accepts it, and reassesses the fit when the work is
 * done; operations triage and run the remedy, finance confirms a refund from the payment system with a
 * reference. Every staff write is audited.
 */

export { CORRECTION_PHOTOS_MAX, CORRECTION_TEXT_MAX, CORRECTION_TRANSITIONS, STAFF_SETTABLE_STATUSES };

export const vRemedyView = v.object({
  kind: vCorrectionKind,
  kindLabel: v.string(),
  coverage: vRemedyCoverage,
  coverageLabel: v.string(),
  amountUsd: v.union(v.number(), v.null()),
  logistics: v.string(),
  /** A target the house set; shown with the "Estimate" label. */
  deadline: v.union(v.number(), v.null()),
  /** First name of the staff member who approved it. */
  approvedBy: v.union(v.string(), v.null()),
});
export type RemedyView = Infer<typeof vRemedyView>;

export const vRefundView = v.object({
  state: vRefundState,
  /** From REFUND_STATE_LABELS: "approved" reads "Refund approved · not yet returned to you". */
  stateLabel: v.string(),
  amountUsd: v.union(v.number(), v.null()),
  confirmedAt: v.union(v.number(), v.null()),
  reference: v.union(v.string(), v.null()),
});
export type RefundView = Infer<typeof vRefundView>;

/** The commission as the correction inspects it: frozen specification, order-book lines and the fit profile version it was cut against. */
export const vCorrectionOrderView = v.object({
  orderId: v.id("atelierOrders"),
  status: vOrderStatus,
  statusLabel: v.string(),
  spec: vSuitSpec,
  specHash: v.string(),
  lines: v.array(vDescribedLine),
  summary: v.string(),
  fitProfileVersion: v.union(v.number(), v.null()),
  releasedAt: v.union(v.number(), v.null()),
  deliveredAt: v.union(v.number(), v.null()),
});
export type CorrectionOrderView = Infer<typeof vCorrectionOrderView>;

/** What every view of a correction carries; the client's adds signed photo URLs, the staff view a count. */
const correctionViewFields = {
  _id: v.id("atelierCorrections"),
  orderId: v.id("atelierOrders"),
  caseId: v.id("atelierCases"),
  kind: vCorrectionKind,
  kindLabel: v.string(),
  region: v.union(vFitRegion, v.null()),
  regionLabel: v.union(v.string(), v.null()),
  /** True when the client reported a detail that does not match the design: a manufacturing check, not a fit correction. */
  isDetailMismatch: v.boolean(),
  description: v.string(),
  status: vCorrectionStatus,
  statusLabel: v.string(),
  open: v.boolean(),
  remedy: v.union(vRemedyView, v.null()),
  refund: v.union(vRefundView, v.null()),
  reassessment: v.union(vReassessment, v.null()),
  order: vCorrectionOrderView,
  fitProfileVersionBefore: v.union(v.number(), v.null()),
  fitProfileVersionAfter: v.union(v.number(), v.null()),
  /** A cancellation asked for after release: the house reviews it and nothing is cancelled until they confirm. */
  requiresHouseReview: v.boolean(),
  escalatedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const vCorrectionView = v.object({
  ...correctionViewFields,
  /** Signed URLs of the client's own supporting photographs; never storage ids. */
  photoUrls: v.array(v.string()),
});
export type CorrectionView = Infer<typeof vCorrectionView>;

export const vCorrectionSummary = v.object({
  _id: v.id("atelierCorrections"),
  orderId: v.id("atelierOrders"),
  caseId: v.id("atelierCases"),
  kind: vCorrectionKind,
  kindLabel: v.string(),
  region: v.union(vFitRegion, v.null()),
  regionLabel: v.union(v.string(), v.null()),
  status: vCorrectionStatus,
  statusLabel: v.string(),
  open: v.boolean(),
  refundStateLabel: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type CorrectionSummary = Infer<typeof vCorrectionSummary>;

const vOwnerKind = v.union(v.literal("account"), v.literal("guest"));

export const vStaffCorrectionRow = v.object({
  ...vCorrectionSummary.fields,
  clientName: v.string(),
  ownerKind: vOwnerKind,
  caseOwner: v.union(v.string(), v.null()),
  casePriority: vCasePriority,
  escalatedAt: v.union(v.number(), v.null()),
});
export type StaffCorrectionRow = Infer<typeof vStaffCorrectionRow>;

export const vStaffCorrectionView = v.object({
  ...correctionViewFields,
  /** How many photographs the client sent; the URLs come only from `staffPhotoUrls`, which records the look. */
  photoCount: v.number(),
  clientName: v.string(),
  ownerKind: vOwnerKind,
  caseOwner: v.union(v.string(), v.null()),
  casePriority: vCasePriority,
  /** The commission's payment record as operations and finance see it; the client reads it on the order. */
  payment: v.union(
    v.object({
      state: vPaymentState,
      stateLabel: v.string(),
      amountUsd: v.union(v.number(), v.null()),
      reference: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  priorCorrections: v.array(vCorrectionSummary),
});
export type StaffCorrectionView = Infer<typeof vStaffCorrectionView>;

export const vRemedyInput = v.object({
  kind: vCorrectionKind,
  coverage: vRemedyCoverage,
  amountUsd: v.optional(v.number()),
  logistics: v.string(),
  deadline: v.optional(v.number()),
});
export type RemedyInput = Infer<typeof vRemedyInput>;

const correctionArgs = { ...ownerArgs, correctionId: v.id("atelierCorrections") };

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

/** C23/C24/C25. Raises one issue on an owned commission; idempotent on `submissionKey` (scenario 8). */
export const request = mutation({
  args: {
    ...ownerArgs,
    orderId: v.id("atelierOrders"),
    kind: vCorrectionKind,
    region: v.optional(vFitRegion),
    description: v.string(),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    submissionKey: v.string(),
  },
  returns: v.object({ correctionId: v.id("atelierCorrections"), caseId: v.id("atelierCases"), duplicate: v.boolean() }),
  handler: async (ctx, { guestKey, orderId, ...input }) => {
    const actor = await requireActor(ctx, guestKey);
    return requestCorrection(ctx, actor, orderId, input);
  },
});

export const get = query({
  args: correctionArgs,
  returns: v.union(vCorrectionView, v.null()),
  handler: async (ctx, { guestKey, correctionId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const c = await ctx.db.get(correctionId);
    if (!c) return null;
    try {
      requireOwned(c, actor, "correction");
    } catch {
      return null;
    }
    return toCorrectionView(ctx, c);
  },
});

export const listForOrder = query({
  args: { ...ownerArgs, orderId: v.id("atelierOrders") },
  returns: v.array(vCorrectionSummary),
  handler: async (ctx, { guestKey, orderId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const order = await ctx.db.get(orderId);
    try {
      requireOwned(order, actor, "commission");
    } catch {
      return [];
    }
    return (await correctionsForOrder(ctx, orderId)).map(toCorrectionSummary);
  },
});

export const acceptRemedy = mutation({
  args: correctionArgs,
  returns: v.null(),
  handler: async (ctx, { guestKey, correctionId }) => {
    const actor = await requireActor(ctx, guestKey);
    await acceptCorrectionRemedy(ctx, actor, await requireOwnedCorrection(ctx, correctionId, actor));
    return null;
  },
});

export const reassess = mutation({
  args: { ...correctionArgs, outcome: vReassessmentOutcome, note: v.string() },
  returns: v.null(),
  handler: async (ctx, { guestKey, correctionId, outcome, note }) => {
    const actor = await requireActor(ctx, guestKey);
    await reassessCorrection(ctx, actor, await requireOwnedCorrection(ctx, correctionId, actor), { outcome, note });
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (A07, O07)
// ------------------------------------------------------------------------------------------------

export const queue = query({
  args: { status: v.optional(vCorrectionStatus) },
  returns: v.array(vStaffCorrectionRow),
  handler: async (ctx, { status }) => {
    await requireStaff(ctx, ["operations", "finance"]);
    const rows = await listByStatus(ctx, status);
    return Promise.all(rows.map((c) => toStaffRow(ctx, c)));
  },
});

export const staffGet = query({
  args: { correctionId: v.id("atelierCorrections") },
  returns: vStaffCorrectionView,
  handler: async (ctx, { correctionId }) => {
    await requireStaff(ctx, ["operations", "finance"]);
    return toStaffView(ctx, await requireCorrection(ctx, correctionId));
  },
});

/** A07. Signed URLs for the client's correction photographs; every look is recorded (`photo.view`), one row per photograph. */
export const staffPhotoUrls = mutation({
  args: { correctionId: v.id("atelierCorrections") },
  returns: v.array(v.string()),
  handler: async (ctx, { correctionId }) => {
    const staff = await requireStaff(ctx, "operations");
    return viewPhotosAsStaff(ctx, staff, await requireCorrection(ctx, correctionId));
  },
});

export const triage = mutation({
  args: { correctionId: v.id("atelierCorrections"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { correctionId, note }) => {
    const staff = await requireStaff(ctx, "operations");
    await triageCorrection(ctx, staff, await requireCorrection(ctx, correctionId), note);
    return null;
  },
});

export const proposeRemedy = mutation({
  args: { correctionId: v.id("atelierCorrections"), remedy: vRemedyInput },
  returns: v.null(),
  handler: async (ctx, { correctionId, remedy }) => {
    const staff = await requireStaff(ctx, "operations");
    await proposeCorrectionRemedy(ctx, staff, await requireCorrection(ctx, correctionId), remedy);
    return null;
  },
});

export const setStatus = mutation({
  args: { correctionId: v.id("atelierCorrections"), status: vCorrectionStatus, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { correctionId, status, note }) => {
    const staff = await requireStaff(ctx, "operations");
    await setCorrectionStatus(ctx, staff, await requireCorrection(ctx, correctionId), status, note);
    return null;
  },
});

export const approveRefund = mutation({
  args: { correctionId: v.id("atelierCorrections"), amountUsd: v.number() },
  returns: v.null(),
  handler: async (ctx, { correctionId, amountUsd }) => {
    const staff = await requireStaff(ctx, ["finance", "operations"]);
    await approveCorrectionRefund(ctx, staff, await requireCorrection(ctx, correctionId), amountUsd);
    return null;
  },
});

/** The only way a refund reads "Refunded": finance records the payment system's reference. Idempotent on it. */
export const confirmRefund = mutation({
  args: { correctionId: v.id("atelierCorrections"), amountUsd: v.number(), reference: v.string() },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, { correctionId, amountUsd, reference }) => {
    const staff = await requireStaff(ctx, "finance");
    return confirmCorrectionRefund(ctx, staff, await requireCorrection(ctx, correctionId), { amountUsd, reference });
  },
});

export const escalate = mutation({
  args: { correctionId: v.id("atelierCorrections"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { correctionId, note }) => {
    const staff = await requireStaff(ctx, ["operations", "finance"]);
    await escalateCorrection(ctx, staff, await requireCorrection(ctx, correctionId), note);
    return null;
  },
});
