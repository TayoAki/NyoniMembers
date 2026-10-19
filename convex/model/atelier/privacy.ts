import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, clientDisplayName, ownerFieldsFor, requireOwned, type Actor, type Owned } from "../../atelier/access";
import type {
  AuditRow,
  ExportPayload,
  PrivacyRequestSummary,
  PrivacyRequestView,
  PrivacyStepView,
  StaffPrivacyRequestView,
  StaffPrivacyRow,
} from "../../atelier/privacy";
import { appError } from "../../lib/errors";
import {
  CASE_KIND_LABELS,
  CASE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PRIVACY_KIND_LABELS,
  PRIVACY_STATUS_LABELS,
  type CaseStatus,
  type PrivacyKind,
  type PrivacyStatus,
} from "../../shared/atelier/enums";
import { PROVIDER_DISCLOSURE_VERSION } from "../../shared/atelier/policy";
import { describeSpec, specSummary } from "../../shared/atelier/spec";
import { clothSummary, specNames } from "./catalogue";
import { appendMessage, createCase, findBySubmissionKey, touchCase, type CaseContactInput } from "./case_core";

type Ctx = QueryCtx | MutationCtx;
type Request = Doc<"atelierPrivacyRequests">;
type Step = Request["steps"][number];
type User = Doc<"users">;
type Draft = Doc<"atelierDrafts">;
type Job = Doc<"atelierPreviewJobs">;

/**
 * Privacy requests (contract §5.11 and §0 "Deletion"; journeys C11, C27, O08; screens S34, A08). A request is
 * a plan of named steps that run one per transaction, each recorded as done, failed or an exception, so the
 * client reads what has actually happened: "Access removed", "Deleting", "Waiting on a provider", "Completed
 * with exceptions". Nothing here touches `atelierOrders`: a commission's specification and fit profile stay
 * with the commission, and that is disclosed up front rather than discovered later (C27 acceptance: removing
 * a photo never cancels an order). Only the owner's rows are ever read, through the owner indexes.
 *
 *   requested ─▶ access_revoked ─▶ primary_deleted ─▶ downstream_pending ─▶ completed
 *                                                                        └─▶ rejected (staff, with a note)
 */

export const PRIVACY_STEP_KEYS = [
  "collect_designs",
  "collect_cases_orders",
  "write_export",
  "revoke_preview_links",
  "cancel_preview_jobs",
  "delete_photos",
  "notify_provider",
  "revoke_shares",
  "archive_drafts",
  "delete_unreferenced_drafts",
  "revoke_access",
] as const;
export type PrivacyStepKey = (typeof PRIVACY_STEP_KEYS)[number];

export const PRIVACY_STEP_LABELS: Record<PrivacyStepKey, string> = {
  collect_designs: "Collect your designs",
  collect_cases_orders: "Collect your requests and commissions",
  write_export: "Write your export",
  revoke_preview_links: "Revoke preview links",
  cancel_preview_jobs: "Cancel preview jobs",
  delete_photos: "Delete photographs and preview results",
  notify_provider: "Notify the preview provider",
  revoke_shares: "Revoke shared links",
  archive_drafts: "Archive drafts",
  delete_unreferenced_drafts: "Delete designs not tied to a commission or a request",
  revoke_access: "Revoke access",
};

export const EXPORT_STEPS: readonly PrivacyStepKey[] = ["collect_designs", "collect_cases_orders", "write_export"];
export const PHOTO_STEPS: readonly PrivacyStepKey[] = [
  "revoke_preview_links",
  "cancel_preview_jobs",
  "delete_photos",
  "notify_provider",
];
export const DESIGN_STEPS: readonly PrivacyStepKey[] = [
  "revoke_shares",
  "archive_drafts",
  "delete_unreferenced_drafts",
];

export const PRIVACY_STEPS_BY_KIND: Record<PrivacyKind, readonly PrivacyStepKey[]> = {
  export: EXPORT_STEPS,
  delete_photos: PHOTO_STEPS,
  delete_designs: DESIGN_STEPS,
  close_account: [...EXPORT_STEPS, ...PHOTO_STEPS, ...DESIGN_STEPS, "revoke_access"],
};

/** Steps whose completion means the client's data can no longer be reached from outside. */
const REVOCATION_KEYS: readonly PrivacyStepKey[] = ["revoke_shares", "revoke_preview_links", "revoke_access"];
/** Steps whose completion means primary copies are gone from the house's systems. */
const DELETION_KEYS: readonly PrivacyStepKey[] = ["delete_photos", "delete_unreferenced_drafts"];

export const OPEN_PRIVACY_STATUSES: readonly PrivacyStatus[] = [
  "requested",
  "access_revoked",
  "primary_deleted",
  "downstream_pending",
];
export const SETTLED_STEP_STATUSES: readonly Step["status"][] = ["done", "exception"];

export const PROVIDER_RETENTION_EXCEPTION = `The preview provider (${PROVIDER_DISCLOSURE_VERSION}) holds its own copy under its retention terms. The house has recorded your deletion with it but cannot confirm the provider's deletion from here.`;
export const ACCESS_REVOCATION_EXCEPTION =
  "Sign-in is managed by the house's identity provider. A privacy staff member removes the account there and records it when they complete this request.";
export const RECORDS_EXCEPTION =
  "Your requests to the house and the record of this privacy request are kept as service and audit records.";

const OWNER_SCAN = 200;
const PHOTOS_SCAN = 100;
const SHARES_PER_DRAFT = 50;
const REVISIONS_PER_DRAFT = 200;
const JOBS_PER_DRAFT = 100;
const PROFILES_MAX = 50;
const QUEUE_MAX = 100;
export const AUDIT_LIMIT_MAX = 200;
/** An export still being written after this long is treated as abandoned and may be started again. */
const EXPORT_IN_FLIGHT_MS = 10 * 60_000;

export function planSteps(kind: PrivacyKind): Step[] {
  return PRIVACY_STEPS_BY_KIND[kind].map((key) => ({
    key,
    label: PRIVACY_STEP_LABELS[key],
    status: "pending" as const,
  }));
}

export function isSettled(step: Pick<Step, "status">): boolean {
  return SETTLED_STEP_STATUSES.includes(step.status);
}

/**
 * The status is a reading of the steps, never a promise: completed only when every step is settled;
 * "waiting on a provider" only when the provider notice is all that remains; deleted or revoked only
 * once such a step has actually finished. A failed step holds the status where it is.
 */
export function deriveStatus(steps: readonly Step[], current: PrivacyStatus): PrivacyStatus {
  if (current === "rejected") return current;
  if (steps.length > 0 && steps.every(isSettled)) return "completed";
  const unsettled = steps.filter((step) => !isSettled(step));
  if (unsettled.length === 1 && unsettled[0].key === "notify_provider") return "downstream_pending";
  const finished = new Set(steps.filter(isSettled).map((step) => step.key));
  if (DELETION_KEYS.some((key) => finished.has(key))) return "primary_deleted";
  if (REVOCATION_KEYS.some((key) => finished.has(key))) return "access_revoked";
  return "requested";
}

export function submissionKeyFor(requestId: Id<"atelierPrivacyRequests">): string {
  return `privacy:${requestId}`;
}

function ownerOf(doc: Owned): Owned {
  return doc.userId !== undefined
    ? { userId: doc.userId }
    : doc.guestKey !== undefined
      ? { guestKey: doc.guestKey }
      : {};
}

// ------------------------------------------------------------------------------------------------
// Owner-scoped reads (every one through an owner index; never another client's rows)
// ------------------------------------------------------------------------------------------------

async function ownerDrafts(ctx: Ctx, owner: Owned): Promise<Draft[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierDrafts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(OWNER_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierDrafts")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(OWNER_SCAN);
  }
  return [];
}

async function ownerOrders(ctx: Ctx, owner: Owned): Promise<Doc<"atelierOrders">[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierOrders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(OWNER_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierOrders")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(OWNER_SCAN);
  }
  return [];
}

async function ownerCases(ctx: Ctx, owner: Owned): Promise<Doc<"atelierCases">[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierCases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(OWNER_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierCases")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(OWNER_SCAN);
  }
  return [];
}

async function ownerJobs(ctx: Ctx, owner: Owned): Promise<Job[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierPreviewJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(OWNER_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierPreviewJobs")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(OWNER_SCAN);
  }
  return [];
}

async function ownerPhotos(ctx: Ctx, owner: Owned): Promise<Doc<"atelierPersonPhotos">[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierPersonPhotos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(PHOTOS_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierPersonPhotos")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(PHOTOS_SCAN);
  }
  return [];
}

async function ownerRequests(ctx: Ctx, owner: Owned): Promise<Request[]> {
  if (owner.userId !== undefined) {
    const userId = owner.userId;
    return ctx.db
      .query("atelierPrivacyRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(OWNER_SCAN);
  }
  if (owner.guestKey !== undefined) {
    const guestKey = owner.guestKey;
    return ctx.db
      .query("atelierPrivacyRequests")
      .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
      .order("desc")
      .take(OWNER_SCAN);
  }
  return [];
}

async function ownerProfiles(ctx: Ctx, owner: Owned): Promise<Doc<"atelierFitProfiles">[]> {
  if (owner.userId === undefined) return [];
  const userId = owner.userId;
  return ctx.db
    .query("atelierFitProfiles")
    .withIndex("by_user_version", (q) => q.eq("userId", userId))
    .order("desc")
    .take(PROFILES_MAX);
}

async function sharesForDraft(ctx: Ctx, draftId: Id<"atelierDrafts">): Promise<Doc<"atelierShares">[]> {
  return ctx.db
    .query("atelierShares")
    .withIndex("by_draft", (q) => q.eq("draftId", draftId))
    .take(SHARES_PER_DRAFT);
}

/** Deletes a stored file if it is still there; a file already gone is not an error. */
async function deleteFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<boolean> {
  const stored = await ctx.db.system.get("_storage", storageId);
  if (!stored) return false;
  await ctx.storage.delete(storageId);
  return true;
}

/**
 * Designs the house keeps: those a commission was cut from (any order, including a cancelled one, is a
 * commercial record) and those a request to the house refers to (the case keeps its immutable design).
 */
async function retainedDraftIds(ctx: Ctx, owner: Owned): Promise<Set<Id<"atelierDrafts">>> {
  const [orders, cases] = await Promise.all([ownerOrders(ctx, owner), ownerCases(ctx, owner)]);
  const retained = new Set<Id<"atelierDrafts">>();
  for (const order of orders) retained.add(order.draftId);
  for (const c of cases) if (c.draftId !== undefined) retained.add(c.draftId);
  return retained;
}

function plural(n: number, singular: string, pluralWord = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

/** What the client is told before anything runs: the records the house keeps, named truthfully. */
export async function retentionExceptions(ctx: Ctx, owner: Owned, kind: PrivacyKind): Promise<string[]> {
  if (kind === "export") return [];
  const lines: string[] = [];
  if (kind === "delete_designs" || kind === "close_account") {
    const orders = (await ownerOrders(ctx, owner)).filter((order) => order.status !== "cancelled");
    for (const order of orders.slice(0, 5)) {
      const cloth = await clothSummary(ctx, order.spec.clothCode);
      lines.push(
        `Your commission "${specSummary(order.spec, cloth?.name)}" (${ORDER_STATUS_LABELS[order.status].toLowerCase()}) keeps its specification and fit profile so the house can make and service the suit.`,
      );
    }
    if (orders.length > 5)
      lines.push(
        `${plural(orders.length - 5, "further commission")} keep their specification and fit profile for the same reason.`,
      );
    const requested = (await ownerCases(ctx, owner)).filter((c) => c.draftId !== undefined);
    if (requested.length > 0)
      lines.push(
        `${plural(requested.length, "design")} you sent the house stay with that request's record; their shared links are revoked.`,
      );
  }
  if (kind === "close_account") lines.push(RECORDS_EXCEPTION);
  return lines;
}

// ------------------------------------------------------------------------------------------------
// Reads and views
// ------------------------------------------------------------------------------------------------

export async function requireRequest(ctx: Ctx, requestId: Id<"atelierPrivacyRequests">): Promise<Request> {
  const request = await ctx.db.get(requestId);
  if (!request) throw appError("NOT_FOUND", "That privacy request doesn't exist.");
  return request;
}

export async function requireOwnedRequest(
  ctx: Ctx,
  requestId: Id<"atelierPrivacyRequests">,
  actor: Actor,
): Promise<Request> {
  return requireOwned(await ctx.db.get(requestId), actor, "privacy request");
}

export async function listMine(ctx: Ctx, actor: Actor): Promise<Request[]> {
  if (!actor.user && !actor.guestKey) return [];
  return ownerRequests(ctx, ownerFieldsFor(actor));
}

export async function caseFor(ctx: Ctx, request: Request): Promise<Doc<"atelierCases"> | null> {
  return findBySubmissionKey(ctx, submissionKeyFor(request._id));
}

/** "Completed with exceptions" is said when it is true; every other word comes from the label map. */
export function statusLabelFor(request: Pick<Request, "status" | "exceptions" | "steps">): string {
  if (
    request.status === "completed" &&
    (request.exceptions.length > 0 || request.steps.some((step) => step.status === "exception"))
  ) {
    return "Completed with exceptions";
  }
  return PRIVACY_STATUS_LABELS[request.status];
}

export function toStepView(step: Step): PrivacyStepView {
  return { key: step.key, label: step.label, status: step.status, at: step.at ?? null, note: step.note ?? null };
}

async function requestViewFields(ctx: Ctx, request: Request): Promise<Omit<PrivacyRequestView, "exportUrl">> {
  const caseDoc = await caseFor(ctx, request);
  return {
    _id: request._id,
    kind: request.kind,
    kindLabel: PRIVACY_KIND_LABELS[request.kind],
    status: request.status,
    statusLabel: statusLabelFor(request),
    steps: request.steps.map(toStepView),
    exceptions: request.exceptions,
    requestedAt: request.requestedAt,
    completedAt: request.completedAt ?? null,
    caseId: caseDoc?._id ?? null,
    hasFailedStep: request.steps.some((step) => step.status === "failed"),
    completedWithExceptions:
      request.status === "completed" &&
      (request.exceptions.length > 0 || request.steps.some((step) => step.status === "exception")),
  };
}

/** The owner's view: the signed export link is theirs to open. */
export async function toRequestView(ctx: Ctx, request: Request): Promise<PrivacyRequestView> {
  const [fields, exportUrl] = await Promise.all([
    requestViewFields(ctx, request),
    request.exportStorageId ? ctx.storage.getUrl(request.exportStorageId) : Promise.resolve(null),
  ]);
  return { ...fields, exportUrl };
}

/**
 * The staff view carries no export link: the file holds the client's name, email and measurements, so a
 * staff member opens it through `staffExportUrl`, which writes to the audit log first (O08, as O06 does for
 * a preview result).
 */
export async function toStaffRequestView(ctx: Ctx, request: Request): Promise<StaffPrivacyRequestView> {
  return { ...(await requestViewFields(ctx, request)), hasExport: request.exportStorageId !== undefined };
}

/** A mutation's work: the look is recorded under the staff member's name before the URL is signed. */
export async function staffExportUrl(
  ctx: MutationCtx,
  staff: User,
  request: Request,
  now: number = Date.now(),
): Promise<{ url: string | null }> {
  if (!request.exportStorageId) throw appError("INVALID_STATE", "This request has no export file to open.");
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "export.view",
      targetTable: "atelierPrivacyRequests",
      targetId: request._id,
      meta: { kind: request.kind },
    },
    now,
  );
  return { url: await ctx.storage.getUrl(request.exportStorageId) };
}

export function toRequestSummary(request: Request): PrivacyRequestSummary {
  return {
    _id: request._id,
    kind: request.kind,
    kindLabel: PRIVACY_KIND_LABELS[request.kind],
    status: request.status,
    statusLabel: statusLabelFor(request),
    requestedAt: request.requestedAt,
    completedAt: request.completedAt ?? null,
    pendingSteps: request.steps.filter((step) => step.status === "pending").length,
    failedSteps: request.steps.filter((step) => step.status === "failed").length,
  };
}

export async function toStaffRow(ctx: Ctx, request: Request): Promise<StaffPrivacyRow> {
  const [client, handler] = await Promise.all([
    request.userId ? ctx.db.get(request.userId) : Promise.resolve(null),
    request.handledByStaffId ? ctx.db.get(request.handledByStaffId) : Promise.resolve(null),
  ]);
  return {
    ...toRequestSummary(request),
    ownerKind: request.userId !== undefined ? "account" : "guest",
    clientName: clientDisplayName(client),
    exceptionCount: request.exceptions.length,
    handledBy: handler?.name ?? null,
  };
}

/** A08. Requests still in motion, oldest first, so nothing waits unseen. */
export async function queue(ctx: Ctx): Promise<Request[]> {
  const pages = await Promise.all(
    OPEN_PRIVACY_STATUSES.map((status) =>
      ctx.db
        .query("atelierPrivacyRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("asc")
        .take(QUEUE_MAX),
    ),
  );
  return pages.flat().sort((a, b) => a.requestedAt - b.requestedAt);
}

// ------------------------------------------------------------------------------------------------
// The client's request (C27, C11)
// ------------------------------------------------------------------------------------------------

export type RequestPrivacyResult = { requestId: Id<"atelierPrivacyRequests">; duplicate: boolean };

/**
 * One open request per kind per owner: asking again while one is in motion returns it rather than starting
 * another (scenario 8). The plan, its exceptions and a privacy case are written, then the first step is
 * scheduled; nothing is deleted inside this transaction.
 */
export async function requestPrivacy(
  ctx: MutationCtx,
  actor: Actor,
  kind: PrivacyKind,
  now: number = Date.now(),
): Promise<RequestPrivacyResult> {
  if (kind === "close_account" && !actor.user) {
    throw appError(
      "INVALID_INPUT",
      "There is no account to close in this browser. You can remove the designs and photographs this browser holds instead.",
      { kind },
    );
  }
  const owner = ownerFieldsFor(actor);
  const existing = (await ownerRequests(ctx, owner)).find(
    (request) => request.kind === kind && OPEN_PRIVACY_STATUSES.includes(request.status),
  );
  if (existing) return { requestId: existing._id, duplicate: true };

  const exceptions = await retentionExceptions(ctx, owner, kind);
  const requestId = await ctx.db.insert("atelierPrivacyRequests", {
    ...owner,
    kind,
    status: "requested",
    steps: planSteps(kind),
    exceptions,
    requestedAt: now,
  });
  // A guest has no address: the case records none, and the receipt on the case is what they read.
  const contact: CaseContactInput = {
    name: actor.user ? clientDisplayName(actor.user) : "Guest",
    ...(actor.user?.email ? { email: actor.user.email } : {}),
    channel: "email",
  };
  await createCase(
    ctx,
    {
      kind: "privacy",
      owner,
      actor,
      contact,
      submissionKey: submissionKeyFor(requestId),
      message: PRIVACY_KIND_LABELS[kind],
      receipt: `${PRIVACY_KIND_LABELS[kind]}: request received. Each step is recorded here as it completes, and nothing is called deleted before it is.${
        exceptions.length > 0 ? ` What the house keeps: ${exceptions.join(" ")}` : ""
      }`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "privacy.request",
      targetTable: "atelierPrivacyRequests",
      targetId: requestId,
      meta: { kind, steps: PRIVACY_STEPS_BY_KIND[kind].length },
    },
    now,
  );
  await ctx.scheduler.runAfter(0, internal.atelier.privacy.advance, { requestId });
  return { requestId, duplicate: false };
}

// ------------------------------------------------------------------------------------------------
// Steps
// ------------------------------------------------------------------------------------------------

type StepOutcome = { status: "done" | "exception"; note: string; exceptions?: string[] };

async function revokeShares(ctx: MutationCtx, owner: Owned, now: number): Promise<number> {
  let revoked = 0;
  for (const draft of await ownerDrafts(ctx, owner)) {
    for (const share of await sharesForDraft(ctx, draft._id)) {
      if (share.revokedAt !== undefined) continue;
      await ctx.db.patch(share._id, { revokedAt: now });
      revoked += 1;
    }
  }
  return revoked;
}

/** A finished result loses its file and reads "Expired"; the design it was made from is untouched. */
async function expireJob(ctx: MutationCtx, job: Job, now: number): Promise<void> {
  if (job.resultStorageId) await deleteFile(ctx, job.resultStorageId);
  await ctx.db.patch(job._id, { status: "expired", resultStorageId: undefined, expiresAt: now });
}

async function cancelJob(ctx: MutationCtx, job: Job, now: number): Promise<void> {
  await ctx.db.patch(job._id, { status: "cancelled", cancelledAt: now, error: "Cancelled by your privacy request." });
}

/** Removes a design nothing else refers to: its snapshots, links and preview jobs go with it. */
async function purgeDraft(ctx: MutationCtx, draft: Draft, now: number): Promise<void> {
  const revisions = await ctx.db
    .query("atelierRevisions")
    .withIndex("by_draft_revision", (q) => q.eq("draftId", draft._id))
    .take(REVISIONS_PER_DRAFT);
  for (const revision of revisions) await ctx.db.delete(revision._id);
  for (const share of await sharesForDraft(ctx, draft._id)) await ctx.db.delete(share._id);
  const jobs = await ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .take(JOBS_PER_DRAFT);
  for (const job of jobs) {
    if (job.resultStorageId) await deleteFile(ctx, job.resultStorageId);
    await ctx.db.delete(job._id);
  }
  void now;
  await ctx.db.delete(draft._id);
}

async function runStep(ctx: MutationCtx, request: Request, key: PrivacyStepKey, now: number): Promise<StepOutcome> {
  const owner = ownerOf(request);
  switch (key) {
    case "collect_designs": {
      const drafts = await ownerDrafts(ctx, owner);
      return { status: "done", note: plural(drafts.length, "design") };
    }
    case "collect_cases_orders": {
      const [cases, orders] = await Promise.all([ownerCases(ctx, owner), ownerOrders(ctx, owner)]);
      return { status: "done", note: `${plural(cases.length, "request")} · ${plural(orders.length, "commission")}` };
    }
    case "write_export":
      throw new Error("The export is written by the writeExport action, not inside a step.");
    case "revoke_shares": {
      const revoked = await revokeShares(ctx, owner, now);
      return { status: "done", note: `${plural(revoked, "shared link")} revoked` };
    }
    case "revoke_preview_links": {
      let withdrawn = 0;
      for (const job of await ownerJobs(ctx, owner)) {
        if (job.status !== "done") continue;
        await expireJob(ctx, job, now);
        withdrawn += 1;
      }
      return { status: "done", note: `${plural(withdrawn, "preview result")} withdrawn` };
    }
    case "cancel_preview_jobs": {
      let cancelled = 0;
      for (const job of await ownerJobs(ctx, owner)) {
        if (job.status !== "queued" && job.status !== "processing") continue;
        await cancelJob(ctx, job, now);
        cancelled += 1;
      }
      return { status: "done", note: `${plural(cancelled, "preview job")} cancelled` };
    }
    case "delete_photos": {
      let deleted = 0;
      const photos = await ownerPhotos(ctx, owner);
      const removedIds = new Set<Id<"atelierPersonPhotos">>();
      for (const photo of photos) {
        if (photo.status === "deleted") continue;
        await deleteFile(ctx, photo.storageId);
        await ctx.db.patch(photo._id, { status: "deleted", deletedAt: now });
        removedIds.add(photo._id);
        deleted += 1;
      }
      for (const draft of await ownerDrafts(ctx, owner)) {
        if (draft.personPhotoId !== undefined && removedIds.has(draft.personPhotoId))
          await ctx.db.patch(draft._id, { personPhotoId: undefined });
      }
      return { status: "done", note: `${plural(deleted, "photograph")} deleted` };
    }
    case "notify_provider": {
      const photos = await ownerPhotos(ctx, owner);
      if (photos.length === 0) return { status: "done", note: "No photograph was ever sent to the preview provider." };
      await audit(
        ctx,
        {
          actor: null,
          actorKind: "system",
          action: "privacy.providerNotice",
          targetTable: "atelierPrivacyRequests",
          targetId: request._id,
          meta: { photos: photos.length, disclosure: PROVIDER_DISCLOSURE_VERSION },
        },
        now,
      );
      return { status: "exception", note: PROVIDER_RETENTION_EXCEPTION, exceptions: [PROVIDER_RETENTION_EXCEPTION] };
    }
    case "archive_drafts": {
      const retained = await retainedDraftIds(ctx, owner);
      let archived = 0;
      let kept = 0;
      for (const draft of await ownerDrafts(ctx, owner)) {
        if (retained.has(draft._id)) {
          kept += 1;
          continue;
        }
        if (draft.status === "archived") continue;
        await ctx.db.patch(draft._id, { status: "archived", updatedAt: now });
        archived += 1;
      }
      const note =
        kept > 0
          ? `${plural(archived, "draft")} archived · ${kept} kept with a commission or a request`
          : `${plural(archived, "draft")} archived`;
      return { status: "done", note };
    }
    case "delete_unreferenced_drafts": {
      const retained = await retainedDraftIds(ctx, owner);
      let deleted = 0;
      let kept = 0;
      for (const draft of await ownerDrafts(ctx, owner)) {
        if (retained.has(draft._id)) {
          kept += 1;
          continue;
        }
        await purgeDraft(ctx, draft, now);
        deleted += 1;
      }
      if (kept === 0) return { status: "done", note: `${plural(deleted, "design")} deleted` };
      const exception = `${plural(kept, "design")} stay with a commission or a request to the house; they are archived and no longer shared.`;
      return {
        status: "exception",
        note: `${plural(deleted, "design")} deleted · ${kept} kept`,
        exceptions: [exception],
      };
    }
    case "revoke_access": {
      const revoked = await revokeShares(ctx, owner, now);
      return {
        status: "exception",
        note: `${plural(revoked, "remaining shared link")} revoked. ${ACCESS_REVOCATION_EXCEPTION}`,
        exceptions: [ACCESS_REVOCATION_EXCEPTION],
      };
    }
  }
}

function withStep(request: Request, index: number, patch: Partial<Step>): Step[] {
  return request.steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
}

/** Writes a step's outcome, re-reads the status from the steps, and tells the case when the status changed. */
async function recordStep(
  ctx: MutationCtx,
  request: Request,
  index: number,
  patch: Partial<Step>,
  newExceptions: readonly string[],
  actor: User | null,
  now: number,
): Promise<Request> {
  const steps = withStep(request, index, patch);
  const exceptions = [...request.exceptions];
  for (const line of newExceptions) if (!exceptions.includes(line)) exceptions.push(line);
  const status = deriveStatus(steps, request.status);
  const completedAt = status === "completed" ? (request.completedAt ?? now) : request.completedAt;
  await ctx.db.patch(request._id, { steps, exceptions, status, completedAt });
  const step = steps[index];
  await audit(
    ctx,
    {
      actor,
      actorKind: actor ? "staff" : "system",
      action: "privacy.step",
      targetTable: "atelierPrivacyRequests",
      targetId: request._id,
      meta: { key: step.key, stepStatus: step.status, status, note: step.note ?? null },
    },
    now,
  );
  const updated: Request = { ...request, steps, exceptions, status, completedAt };
  if (status !== request.status) {
    const caseDoc = await caseFor(ctx, request);
    if (caseDoc) {
      const label = statusLabelFor(updated);
      await appendMessage(
        ctx,
        caseDoc._id,
        { author: "system", body: `${label}. ${step.label}: ${step.note ?? step.status}.` },
        now,
      );
      if (status === "completed") await touchCase(ctx, caseDoc._id, { status: "completed", closedAt: now }, now);
    }
  }
  return updated;
}

function nextUnsettled(steps: readonly Step[]): number {
  return steps.findIndex((step) => !isSettled(step));
}

export type AdvanceOptions = { manual?: boolean; actor?: User | null };
export type AdvanceResult = { ran: string | null; status: PrivacyStatus; scheduled: boolean };

/**
 * Runs the next step in its own transaction and schedules the one after it. Automatic runs stop at a failed
 * step, which waits for staff (`manual: true` re-runs it). The export step is handed to the `writeExport`
 * action, since only an action can store a file; it reports back through `recordExport`.
 */
export async function advance(
  ctx: MutationCtx,
  requestId: Id<"atelierPrivacyRequests">,
  options: AdvanceOptions = {},
  now: number = Date.now(),
): Promise<AdvanceResult> {
  const request = await requireRequest(ctx, requestId);
  if (request.status === "completed" || request.status === "rejected")
    return { ran: null, status: request.status, scheduled: false };
  const index = nextUnsettled(request.steps);
  if (index < 0) {
    const status = deriveStatus(request.steps, request.status);
    await ctx.db.patch(request._id, { status, completedAt: request.completedAt ?? now });
    return { ran: null, status, scheduled: false };
  }
  const step = request.steps[index];
  if (step.status === "failed" && !options.manual) return { ran: null, status: request.status, scheduled: false };
  const key = step.key as PrivacyStepKey;

  if (key === "write_export") {
    const inFlight = step.status === "pending" && step.at !== undefined && now - step.at < EXPORT_IN_FLIGHT_MS;
    if (inFlight && !options.manual) return { ran: null, status: request.status, scheduled: false };
    await ctx.db.patch(request._id, {
      steps: withStep(request, index, { status: "pending", at: now, note: "Writing your export" }),
    });
    await ctx.scheduler.runAfter(0, internal.atelier.privacy.writeExport, { requestId });
    return { ran: key, status: request.status, scheduled: true };
  }

  let outcome: StepOutcome;
  try {
    outcome = await runStep(ctx, request, key, now);
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    await recordStep(ctx, request, index, { status: "failed", at: now, note }, [], options.actor ?? null, now);
    return { ran: key, status: request.status, scheduled: false };
  }
  const updated = await recordStep(
    ctx,
    request,
    index,
    { status: outcome.status, at: now, note: outcome.note },
    outcome.exceptions ?? [],
    options.actor ?? null,
    now,
  );
  const next = nextUnsettled(updated.steps);
  const scheduled = next >= 0 && updated.steps[next].status === "pending" && updated.status !== "completed";
  if (scheduled) await ctx.scheduler.runAfter(0, internal.atelier.privacy.advance, { requestId });
  return { ran: key, status: updated.status, scheduled };
}

/** The export action reports its file here; a late or repeated report deletes its own file rather than overwriting. */
export async function recordExport(
  ctx: MutationCtx,
  requestId: Id<"atelierPrivacyRequests">,
  storageId: Id<"_storage">,
  now: number = Date.now(),
): Promise<boolean> {
  const request = await ctx.db.get(requestId);
  const index = request?.steps.findIndex((step) => step.key === "write_export") ?? -1;
  if (!request || index < 0 || request.steps[index].status === "done" || request.status === "rejected") {
    await deleteFile(ctx, storageId);
    return false;
  }
  if (request.exportStorageId !== undefined && request.exportStorageId !== storageId)
    await deleteFile(ctx, request.exportStorageId);
  await ctx.db.patch(request._id, { exportStorageId: storageId });
  const updated = await recordStep(
    ctx,
    { ...request, exportStorageId: storageId },
    index,
    { status: "done", at: now, note: "Your export is ready to download from Privacy." },
    [],
    null,
    now,
  );
  const next = nextUnsettled(updated.steps);
  if (next >= 0 && updated.steps[next].status === "pending" && updated.status !== "completed") {
    await ctx.scheduler.runAfter(0, internal.atelier.privacy.advance, { requestId });
  }
  return true;
}

export async function markStepFailed(
  ctx: MutationCtx,
  requestId: Id<"atelierPrivacyRequests">,
  key: PrivacyStepKey,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const request = await requireRequest(ctx, requestId);
  const index = request.steps.findIndex((step) => step.key === key);
  if (index < 0 || isSettled(request.steps[index])) return;
  await recordStep(ctx, request, index, { status: "failed", at: now, note: note.slice(0, 500) }, [], null, now);
}

// ------------------------------------------------------------------------------------------------
// The export itself (read by the writeExport action, never by a client directly)
// ------------------------------------------------------------------------------------------------

/** Only the owner's rows, through the owner indexes: another client's data is never in reach of this read. */
export async function exportPayload(
  ctx: Ctx,
  requestId: Id<"atelierPrivacyRequests">,
  now: number = Date.now(),
): Promise<ExportPayload | null> {
  const request = await ctx.db.get(requestId);
  if (!request) return null;
  const owner = ownerOf(request);
  const [user, drafts, cases, orders, profiles] = await Promise.all([
    request.userId ? ctx.db.get(request.userId) : Promise.resolve(null),
    ownerDrafts(ctx, owner),
    ownerCases(ctx, owner),
    ownerOrders(ctx, owner),
    ownerProfiles(ctx, owner),
  ]);
  const designs = await Promise.all(
    drafts.map(async (draft) => ({
      id: draft._id,
      name: draft.name,
      status: draft.status,
      occasion: draft.occasion ?? null,
      eventDate: draft.eventDate ?? null,
      revision: draft.revision,
      spec: draft.spec,
      lines: describeSpec(draft.spec, await specNames(ctx, draft.spec)),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    })),
  );
  const commissions = await Promise.all(
    orders.map(async (order) => {
      const milestones = await ctx.db
        .query("atelierOrderMilestones")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .order("asc")
        .take(OWNER_SCAN);
      return {
        id: order._id,
        status: order.status,
        statusLabel: ORDER_STATUS_LABELS[order.status],
        spec: order.spec,
        lines: describeSpec(order.spec, await specNames(ctx, order.spec)),
        payment: {
          state: order.payment.state,
          stateLabel: PAYMENT_STATE_LABELS[order.payment.state],
          amountUsd: order.payment.amountUsd ?? null,
          confirmedAt: order.payment.confirmedAt ?? null,
        },
        milestones: milestones.map((m) => ({
          kind: m.kind,
          label: m.label,
          at: m.at,
          source: m.source,
          estimated: m.estimated,
        })),
        createdAt: order.createdAt,
      };
    }),
  );
  return {
    format: "nyoni-atelier-export/1",
    exportedAt: now,
    requestId,
    account: user ? { name: user.name ?? null, email: user.email ?? null } : null,
    designs,
    requests: cases.map((c) => ({
      id: c._id,
      kind: c.kind,
      kindLabel: CASE_KIND_LABELS[c.kind],
      status: c.status,
      statusLabel: CASE_STATUS_LABELS[c.status as CaseStatus],
      createdAt: c.createdAt,
      lastActivityAt: c.lastActivityAt,
      closedAt: c.closedAt ?? null,
    })),
    commissions,
    fitProfiles: profiles.map((profile) => ({
      version: profile.version,
      units: profile.units,
      measurements: profile.measurements,
      comfort: profile.comfort,
      status: profile.status,
      provenance: profile.provenance,
      createdAt: profile.createdAt,
    })),
  };
}

// ------------------------------------------------------------------------------------------------
// Staff (O08)
// ------------------------------------------------------------------------------------------------

/** Closes a request whose steps have all run; the note documents what the staff member did or reviewed. */
export async function complete(
  ctx: MutationCtx,
  staff: User,
  request: Request,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const body = note.trim();
  if (!body) throw appError("INVALID_INPUT", "A note on what was reviewed or done is needed.");
  if (request.status === "rejected")
    throw appError("INVALID_STATE", "This request was rejected; it cannot be completed.", { status: request.status });
  const unsettled = request.steps.filter((step) => !isSettled(step));
  if (unsettled.length > 0) {
    throw appError(
      "INVALID_STATE",
      `${plural(unsettled.length, "step")} still pending or failed: ${unsettled.map((step) => step.label).join(", ")}. Run them first.`,
      {
        steps: unsettled.map((step) => step.key),
      },
    );
  }
  if (request.status !== "completed" || request.handledByStaffId !== staff._id) {
    await ctx.db.patch(request._id, {
      status: "completed",
      completedAt: request.completedAt ?? now,
      handledByStaffId: staff._id,
    });
  }
  const caseDoc = await caseFor(ctx, request);
  if (caseDoc) {
    await appendMessage(ctx, caseDoc._id, { author: "staff", authorUserId: staff._id, body }, now);
    await touchCase(ctx, caseDoc._id, { status: "completed", closedAt: caseDoc.closedAt ?? now }, now);
  }
  await audit(
    ctx,
    {
      actor: staff,
      action: "privacy.complete",
      targetTable: "atelierPrivacyRequests",
      targetId: request._id,
      meta: { note: body },
    },
    now,
  );
}

/** A documented refusal (identity not verified, a legal hold): the client reads "Could not be completed" and why. */
export async function reject(
  ctx: MutationCtx,
  staff: User,
  request: Request,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const body = note.trim();
  if (!body) throw appError("INVALID_INPUT", "A note the client can read is needed.");
  if (request.status === "completed")
    throw appError("INVALID_STATE", "This request has completed; it cannot be rejected.", { status: request.status });
  if (request.status === "rejected") return;
  await ctx.db.patch(request._id, { status: "rejected", completedAt: now, handledByStaffId: staff._id });
  const caseDoc = await caseFor(ctx, request);
  if (caseDoc) {
    await appendMessage(
      ctx,
      caseDoc._id,
      { author: "staff", authorUserId: staff._id, body: `${PRIVACY_STATUS_LABELS.rejected}. ${body}` },
      now,
    );
    await touchCase(ctx, caseDoc._id, { status: "completed", closedAt: now }, now);
  }
  await audit(
    ctx,
    {
      actor: staff,
      action: "privacy.reject",
      targetTable: "atelierPrivacyRequests",
      targetId: request._id,
      meta: { note: body },
    },
    now,
  );
}

export type AuditFilter = { targetTable?: string; targetId?: string; limit?: number };

/** A08. The audit log by target or by time; never more than `AUDIT_LIMIT_MAX` rows at once. */
export async function listAudit(ctx: Ctx, filter: AuditFilter): Promise<AuditRow[]> {
  const limit = Math.max(1, Math.min(filter.limit ?? 50, AUDIT_LIMIT_MAX));
  const targetTable = filter.targetTable?.trim();
  const targetId = filter.targetId?.trim();
  const rows =
    targetTable && targetId
      ? await ctx.db
          .query("atelierAuditLog")
          .withIndex("by_target", (q) => q.eq("targetTable", targetTable).eq("targetId", targetId))
          .order("desc")
          .take(limit)
      : targetTable
        ? await ctx.db
            .query("atelierAuditLog")
            .withIndex("by_target", (q) => q.eq("targetTable", targetTable))
            .order("desc")
            .take(limit)
        : await ctx.db.query("atelierAuditLog").withIndex("by_at").order("desc").take(limit);
  const names = new Map<Id<"users">, string | null>();
  const nameOf = async (userId: Id<"users"> | undefined): Promise<string | null> => {
    if (userId === undefined) return null;
    if (!names.has(userId)) names.set(userId, (await ctx.db.get(userId))?.name ?? null);
    return names.get(userId) ?? null;
  };
  return Promise.all(
    rows.map(async (row) => ({
      _id: row._id,
      actorUserId: row.actorUserId ?? null,
      actorName: await nameOf(row.actorUserId),
      actorKind: row.actorKind,
      action: row.action,
      targetTable: row.targetTable,
      targetId: row.targetId,
      meta: row.meta ?? null,
      at: row.at,
    })),
  );
}
