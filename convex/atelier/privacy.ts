import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  advance as advanceRequest,
  AUDIT_LIMIT_MAX,
  complete as completeRequest,
  exportPayload as buildExportPayload,
  listAudit as listAuditRows,
  listMine as listMyRequests,
  markStepFailed,
  PRIVACY_STEP_KEYS,
  PRIVACY_STEP_LABELS,
  PRIVACY_STEPS_BY_KIND,
  queue as queueRequests,
  recordExport as recordExportFile,
  reject as rejectRequest,
  requestPrivacy,
  requireOwnedRequest,
  requireRequest,
  staffExportUrl as signStaffExportUrl,
  toRequestSummary,
  toRequestView,
  toStaffRequestView,
  toStaffRow,
} from "../model/atelier/privacy";
import {
  vAuditActorKind,
  vCaseKind,
  vCaseStatus,
  vDescribedLine,
  vDraftStatus,
  vFitComfort,
  vFitProfileStatus,
  vFitProvenance,
  vMilestoneSource,
  vOccasion,
  vOrderStatus,
  vPaymentState,
  vPrivacyKind,
  vPrivacyStatus,
  vPrivacyStepStatus,
  vSuitSpec,
  vUnit,
} from "../shared/atelier/validators";
import { literals } from "../shared/validators";
import { requireActor, requireStaff, resolveActor } from "./access";
import { ownerArgs } from "./views";

/**
 * Atelier privacy: export, photo removal, design deletion and account closure (contract §5.11; journeys C11,
 * C27, O08; screens S34, A08). Thin wrappers over `convex/model/atelier/privacy.ts`. A request runs as named
 * steps, one per transaction, and the client reads each step's real outcome; the export file is written by an
 * action because only an action can store a file. Staff with the privacy role re-run failed steps, complete
 * or reject with a documented note, and read the audit log.
 */

export { AUDIT_LIMIT_MAX, PRIVACY_STEP_KEYS, PRIVACY_STEP_LABELS, PRIVACY_STEPS_BY_KIND };
export const vPrivacyStepKey = literals(PRIVACY_STEP_KEYS);

export const vPrivacyStepView = v.object({
  key: v.string(),
  label: v.string(),
  status: vPrivacyStepStatus,
  at: v.union(v.number(), v.null()),
  note: v.union(v.string(), v.null()),
  /** Ran what it could and now rests with a privacy staff member, whose completion records it (A08). */
  awaitsStaff: v.boolean(),
});
export type PrivacyStepView = Infer<typeof vPrivacyStepView>;

const requestViewFields = {
  _id: v.id("atelierPrivacyRequests"),
  kind: vPrivacyKind,
  kindLabel: v.string(),
  status: vPrivacyStatus,
  /** From PRIVACY_STATUS_LABELS, or "Completed with exceptions" when that is the truth. */
  statusLabel: v.string(),
  steps: v.array(vPrivacyStepView),
  /** What the house keeps and why, disclosed when the request is made and added to as steps run. */
  exceptions: v.array(v.string()),
  requestedAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
  caseId: v.union(v.id("atelierCases"), v.null()),
  hasFailedStep: v.boolean(),
  completedWithExceptions: v.boolean(),
};

/** The owner's view of their own request. */
export const vPrivacyRequestView = v.object({
  ...requestViewFields,
  /** A signed link to the export file once it has been written. */
  exportUrl: v.union(v.string(), v.null()),
});
export type PrivacyRequestView = Infer<typeof vPrivacyRequestView>;

/** The staff view: whether an export exists, never its link; `staffExportUrl` signs one and records the look. */
export const vStaffPrivacyRequestView = v.object({
  ...requestViewFields,
  hasExport: v.boolean(),
});
export type StaffPrivacyRequestView = Infer<typeof vStaffPrivacyRequestView>;

export const vPrivacyRequestSummary = v.object({
  _id: v.id("atelierPrivacyRequests"),
  kind: vPrivacyKind,
  kindLabel: v.string(),
  status: vPrivacyStatus,
  statusLabel: v.string(),
  requestedAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
  pendingSteps: v.number(),
  failedSteps: v.number(),
});
export type PrivacyRequestSummary = Infer<typeof vPrivacyRequestSummary>;

export const vStaffPrivacyRow = v.object({
  ...vPrivacyRequestSummary.fields,
  ownerKind: v.union(v.literal("account"), v.literal("guest")),
  clientName: v.string(),
  exceptionCount: v.number(),
  handledBy: v.union(v.string(), v.null()),
});
export type StaffPrivacyRow = Infer<typeof vStaffPrivacyRow>;

export const vAuditRow = v.object({
  _id: v.id("atelierAuditLog"),
  actorUserId: v.union(v.id("users"), v.null()),
  actorName: v.union(v.string(), v.null()),
  actorKind: vAuditActorKind,
  action: v.string(),
  targetTable: v.string(),
  targetId: v.string(),
  meta: v.union(v.record(v.string(), v.any()), v.null()),
  at: v.number(),
});
export type AuditRow = Infer<typeof vAuditRow>;

/** The export file's shape: the owner's designs, requests, commissions and fit profiles, nothing of anyone else's. */
export const vExportPayload = v.object({
  format: v.literal("nyoni-atelier-export/1"),
  exportedAt: v.number(),
  requestId: v.id("atelierPrivacyRequests"),
  account: v.union(v.object({ name: v.union(v.string(), v.null()), email: v.union(v.string(), v.null()) }), v.null()),
  designs: v.array(
    v.object({
      id: v.id("atelierDrafts"),
      name: v.string(),
      status: vDraftStatus,
      occasion: v.union(vOccasion, v.null()),
      eventDate: v.union(v.number(), v.null()),
      revision: v.number(),
      spec: vSuitSpec,
      lines: v.array(vDescribedLine),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  requests: v.array(
    v.object({
      id: v.id("atelierCases"),
      kind: vCaseKind,
      kindLabel: v.string(),
      status: vCaseStatus,
      statusLabel: v.string(),
      createdAt: v.number(),
      lastActivityAt: v.number(),
      closedAt: v.union(v.number(), v.null()),
    }),
  ),
  commissions: v.array(
    v.object({
      id: v.id("atelierOrders"),
      status: vOrderStatus,
      statusLabel: v.string(),
      spec: vSuitSpec,
      lines: v.array(vDescribedLine),
      payment: v.object({
        state: vPaymentState,
        stateLabel: v.string(),
        amountUsd: v.union(v.number(), v.null()),
        confirmedAt: v.union(v.number(), v.null()),
      }),
      milestones: v.array(
        v.object({
          kind: v.string(),
          label: v.string(),
          at: v.number(),
          source: vMilestoneSource,
          estimated: v.boolean(),
        }),
      ),
      createdAt: v.number(),
    }),
  ),
  fitProfiles: v.array(
    v.object({
      version: v.number(),
      units: vUnit,
      measurements: v.record(v.string(), v.number()),
      comfort: vFitComfort,
      status: vFitProfileStatus,
      provenance: vFitProvenance,
      createdAt: v.number(),
    }),
  ),
});
export type ExportPayload = Infer<typeof vExportPayload>;

const requestArgs = { ...ownerArgs, requestId: v.id("atelierPrivacyRequests") };

// ------------------------------------------------------------------------------------------------
// Client (S34)
// ------------------------------------------------------------------------------------------------

/** C27. Plans the steps, discloses the exceptions, opens the privacy case and schedules the first step. */
export const request = mutation({
  args: { ...ownerArgs, kind: vPrivacyKind },
  returns: v.object({ requestId: v.id("atelierPrivacyRequests"), duplicate: v.boolean() }),
  handler: async (ctx, { guestKey, kind }) => {
    const actor = await requireActor(ctx, guestKey);
    return requestPrivacy(ctx, actor, kind);
  },
});

export const get = query({
  args: requestArgs,
  returns: v.union(vPrivacyRequestView, v.null()),
  handler: async (ctx, { guestKey, requestId }) => {
    const actor = await resolveActor(ctx, guestKey);
    try {
      return await toRequestView(ctx, await requireOwnedRequest(ctx, requestId, actor));
    } catch {
      return null;
    }
  },
});

export const listMine = query({
  args: ownerArgs,
  returns: v.array(vPrivacyRequestSummary),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    return (await listMyRequests(ctx, actor)).map(toRequestSummary);
  },
});

// ------------------------------------------------------------------------------------------------
// Internal: the step runner and the export writer
// ------------------------------------------------------------------------------------------------

const vAdvanceResult = v.object({ ran: v.union(v.string(), v.null()), status: vPrivacyStatus, scheduled: v.boolean() });

/** Scheduled by `request` and by itself: runs the next pending step in a fresh transaction. */
export const advance = internalMutation({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: vAdvanceResult,
  handler: async (ctx, { requestId }) => advanceRequest(ctx, requestId),
});

export const exportPayload = internalQuery({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: v.union(vExportPayload, v.null()),
  handler: async (ctx, { requestId }) => buildExportPayload(ctx, requestId),
});

export const recordExport = internalMutation({
  args: { requestId: v.id("atelierPrivacyRequests"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, { requestId, storageId }) => recordExportFile(ctx, requestId, storageId),
});

export const recordStepFailure = internalMutation({
  args: { requestId: v.id("atelierPrivacyRequests"), key: vPrivacyStepKey, note: v.string() },
  returns: v.null(),
  handler: async (ctx, { requestId, key, note }) => {
    await markStepFailed(ctx, requestId, key, note);
    return null;
  },
});

/**
 * Writes the export file. Only an action may store a file, so `advance` schedules this for the "write_export"
 * step and it reports the outcome back by mutation; a failure is recorded on the step for staff to re-run.
 */
export const writeExport = internalAction({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: v.null(),
  handler: async (ctx, { requestId }): Promise<null> => {
    const payload: ExportPayload | null = await ctx.runQuery(internal.atelier.privacy.exportPayload, { requestId });
    if (payload === null) return null;
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation(internal.atelier.privacy.recordExport, { requestId, storageId });
    } catch (error) {
      const note = error instanceof Error ? error.message : "The export could not be written.";
      await ctx.runMutation(internal.atelier.privacy.recordStepFailure, { requestId, key: "write_export", note });
    }
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (A08, O08)
// ------------------------------------------------------------------------------------------------

export const queue = query({
  args: {},
  returns: v.array(vStaffPrivacyRow),
  handler: async (ctx) => {
    await requireStaff(ctx, "privacy");
    return Promise.all((await queueRequests(ctx)).map((request) => toStaffRow(ctx, request)));
  },
});

export const staffGet = query({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: vStaffPrivacyRequestView,
  handler: async (ctx, { requestId }) => {
    await requireStaff(ctx, "privacy");
    return toStaffRequestView(ctx, await requireRequest(ctx, requestId));
  },
});

/**
 * A mutation, not a query: the export holds the client's name, email and measurements, so every staff
 * look at it is written to the audit log (`export.view`) before the link is signed.
 */
export const staffExportUrl = mutation({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
  handler: async (ctx, { requestId }) => {
    const staff = await requireStaff(ctx, "privacy");
    return signStaffExportUrl(ctx, staff, await requireRequest(ctx, requestId));
  },
});

/**
 * Manual run of the next step: a re-run of one that failed, or the staff member's record of one that awaits
 * them (the account removed at the identity provider). Audited as the staff member's action.
 */
export const staffAdvance = mutation({
  args: { requestId: v.id("atelierPrivacyRequests") },
  returns: vAdvanceResult,
  handler: async (ctx, { requestId }) => {
    const staff = await requireStaff(ctx, "privacy");
    return advanceRequest(ctx, requestId, { manual: true, actor: staff });
  },
});

export const complete = mutation({
  args: { requestId: v.id("atelierPrivacyRequests"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { requestId, note }) => {
    const staff = await requireStaff(ctx, "privacy");
    await completeRequest(ctx, staff, await requireRequest(ctx, requestId), note);
    return null;
  },
});

export const reject = mutation({
  args: { requestId: v.id("atelierPrivacyRequests"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { requestId, note }) => {
    const staff = await requireStaff(ctx, "privacy");
    await rejectRequest(ctx, staff, await requireRequest(ctx, requestId), note);
    return null;
  },
});

export const listAudit = query({
  args: { targetTable: v.optional(v.string()), targetId: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(vAuditRow),
  handler: async (ctx, filter) => {
    await requireStaff(ctx, "privacy");
    return listAuditRows(ctx, filter);
  },
});
