import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  audit,
  clientDisplayName,
  isOwner,
  requireOwned,
  staffDisplayName,
  type Actor,
  type Owned,
} from "../../atelier/access";
import type {
  CorrectionOrderView,
  CorrectionSummary,
  CorrectionView,
  RefundView,
  RemedyInput,
  RemedyView,
  StaffCorrectionRow,
  StaffCorrectionView,
} from "../../atelier/corrections";
import { appError } from "../../lib/errors";
import {
  ATELIER_LIMITS,
  CORRECTION_KIND_LABELS,
  CORRECTION_STATUS_LABELS,
  CORRECTION_STATUSES,
  FIT_REGION_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  REFUND_STATE_LABELS,
  REMEDY_COVERAGE_LABELS,
  type CorrectionKind,
  type CorrectionStatus,
  type FitRegion,
  type OrderStatus,
  type ReassessmentOutcome,
  type PaymentState,
} from "../../shared/atelier/enums";
import { HOUSE_POLICY } from "../../shared/atelier/policy";
import { describeSpec, specSummary } from "../../shared/atelier/spec";
import { clothSummary, specNames } from "./catalogue";
import { appendMessage, createCase, touchCase, type Contact } from "./case_core";
import { PAYMENT_TRANSITIONS, recordPayment } from "./orders";

type Ctx = QueryCtx | MutationCtx;
type Correction = Doc<"atelierCorrections">;
type Order = Doc<"atelierOrders">;
type User = Doc<"users">;

/**
 * Aftercare (contract §5.10; journeys C23, C24, C25, O07; screens S30, S31, S32, A07): alterations,
 * remakes, returns, exchanges, refunds and cancellations on a released commission. One correction is one
 * issue on one order, with its own aftercare case for the conversation. The words are truthful by
 * construction: a remedy is proposed, then accepted; a refund is approved, then confirmed only from the
 * house's payment system with a reference; "completed" asks the client to reassess, and only the client's
 * "resolved" closes it. The original specification and the fit profile the suit was cut against stay
 * inspectable on every correction (cross-cutting scenario 11).
 *
 *   requested ─▶ triaged ─▶ remedy_proposed ─▶ accepted ─▶ in_progress ─▶ received ─▶ completed ─▶ closed
 *       │           │               │              │             │             │             │
 *       └───────────┴───────────────┴──────────────┴─────────────┴─────────────┴─────────────┴──▶ escalated
 *                   └──▶ declined ──▶ closed
 */

export const CORRECTION_TEXT_MAX = 2000;
export const CORRECTION_PHOTOS_MAX = 6;
export const SUBMISSION_KEY_MAX = 128;
const CORRECTIONS_PER_ORDER_MAX = 50;
const CORRECTIONS_PER_STATUS_MAX = 100;
const PROFILES_MAX = 50;

/** A fit, detail or garment issue can be raised once the suit is in the client's hands. */
export const IN_HAND_ORDER_STATUSES: readonly OrderStatus[] = [
  "shipped",
  "collected",
  "fit_review",
  "accepted",
  "correction_open",
];
/** A cancellation may be asked for at any point before the commission is cancelled; after release the house reviews it. */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "preflight",
  "released",
  "making",
  "quality_review",
  ...IN_HAND_ORDER_STATUSES,
];

export const OPEN_CORRECTION_STATUSES: readonly CorrectionStatus[] = [
  "requested",
  "triaged",
  "remedy_proposed",
  "accepted",
  "in_progress",
  "received",
  "completed",
  "escalated",
];
export const TERMINAL_CORRECTION_STATUSES: readonly CorrectionStatus[] = ["declined", "closed"];

export const CORRECTION_TRANSITIONS: Record<CorrectionStatus, readonly CorrectionStatus[]> = {
  requested: ["triaged", "escalated"],
  triaged: ["remedy_proposed", "declined", "escalated"],
  remedy_proposed: ["remedy_proposed", "accepted", "escalated"],
  accepted: ["in_progress", "escalated"],
  in_progress: ["received", "completed", "escalated"],
  received: ["completed", "escalated"],
  completed: ["closed", "escalated"],
  escalated: ["triaged", "remedy_proposed", "declined", "closed"],
  declined: ["closed"],
  closed: [],
};

/** What `setStatus` may set directly; the other words have a function of their own or belong to the client. */
export const STAFF_SETTABLE_STATUSES: readonly CorrectionStatus[] = [
  "in_progress",
  "received",
  "completed",
  "declined",
  "closed",
];
/** Statuses that need a note the client can read. */
const NOTE_REQUIRED_STATUSES: readonly CorrectionStatus[] = ["declined", "closed"];

export function canTransition(from: CorrectionStatus, to: CorrectionStatus): boolean {
  return CORRECTION_TRANSITIONS[from].includes(to);
}

export function isOpen(c: Pick<Correction, "status">): boolean {
  return OPEN_CORRECTION_STATUSES.includes(c.status);
}

export function isCorrectionStatus(value: string): value is CorrectionStatus {
  return (CORRECTION_STATUSES as readonly string[]).includes(value);
}

function assertTransition(c: Correction, to: CorrectionStatus): void {
  if (canTransition(c.status, to)) return;
  throw appError(
    "INVALID_STATE",
    `This correction is "${CORRECTION_STATUS_LABELS[c.status]}" and cannot become "${CORRECTION_STATUS_LABELS[to]}".`,
    { from: c.status, to },
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    amount,
  );
}

function formatDay(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(ms),
  );
}

function requireText(value: string, what: string, max = CORRECTION_TEXT_MAX): string {
  const trimmed = value.trim();
  if (!trimmed) throw appError("INVALID_INPUT", `${what} is needed.`);
  if (trimmed.length > max) throw appError("INVALID_INPUT", `${what} is too long (up to ${max} characters).`, { max });
  return trimmed;
}

function ownerOf(doc: Owned): Owned {
  return doc.userId !== undefined
    ? { userId: doc.userId }
    : doc.guestKey !== undefined
      ? { guestKey: doc.guestKey }
      : {};
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function requireCorrection(ctx: Ctx, correctionId: Id<"atelierCorrections">): Promise<Correction> {
  const c = await ctx.db.get(correctionId);
  if (!c) throw appError("NOT_FOUND", "That correction doesn't exist.");
  return c;
}

/** The client's own correction, or "not found": another client's aftercare is never acknowledged. */
export async function requireOwnedCorrection(
  ctx: Ctx,
  correctionId: Id<"atelierCorrections">,
  actor: Actor,
): Promise<Correction> {
  return requireOwned(await ctx.db.get(correctionId), actor, "correction");
}

export async function correctionsForOrder(ctx: Ctx, orderId: Id<"atelierOrders">): Promise<Correction[]> {
  return ctx.db
    .query("atelierCorrections")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(CORRECTIONS_PER_ORDER_MAX);
}

/** A07. One status, or every open status with the most recent activity first. */
export async function listByStatus(ctx: Ctx, status?: CorrectionStatus): Promise<Correction[]> {
  if (status) {
    return ctx.db
      .query("atelierCorrections")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(CORRECTIONS_PER_STATUS_MAX);
  }
  const pages = await Promise.all(
    OPEN_CORRECTION_STATUSES.map((candidate) =>
      ctx.db
        .query("atelierCorrections")
        .withIndex("by_status", (q) => q.eq("status", candidate))
        .order("desc")
        .take(CORRECTIONS_PER_STATUS_MAX),
    ),
  );
  return pages.flat().sort((a, b) => b.updatedAt - a.updatedAt);
}

async function fitProfileVersion(ctx: Ctx, profileId: Id<"atelierFitProfiles"> | undefined): Promise<number | null> {
  if (profileId === undefined) return null;
  const profile = await ctx.db.get(profileId);
  return profile?.version ?? null;
}

/** The client's newest fitter-approved profile, recorded on a completed correction as `fitProfileVersionAfter`. */
async function latestApprovedProfileVersion(ctx: Ctx, userId: Id<"users"> | undefined): Promise<number | null> {
  if (userId === undefined) return null;
  const profiles = await ctx.db
    .query("atelierFitProfiles")
    .withIndex("by_user_version", (q) => q.eq("userId", userId))
    .order("desc")
    .take(PROFILES_MAX);
  return profiles.find((profile) => profile.status === "approved")?.version ?? null;
}

// ------------------------------------------------------------------------------------------------
// Views
// ------------------------------------------------------------------------------------------------

export async function toRemedyView(ctx: Ctx, remedy: NonNullable<Correction["remedy"]>): Promise<RemedyView> {
  const approver = await ctx.db.get(remedy.approvedByStaffId);
  return {
    kind: remedy.kind,
    kindLabel: CORRECTION_KIND_LABELS[remedy.kind],
    coverage: remedy.coverage,
    coverageLabel: REMEDY_COVERAGE_LABELS[remedy.coverage],
    amountUsd: remedy.amountUsd ?? null,
    logistics: remedy.logistics,
    deadline: remedy.deadline ?? null,
    approvedBy: staffDisplayName(approver),
  };
}

export function toRefundView(refund: Correction["refund"]): RefundView | null {
  if (!refund) return null;
  return {
    state: refund.state,
    stateLabel: REFUND_STATE_LABELS[refund.state],
    amountUsd: refund.amountUsd ?? null,
    confirmedAt: refund.confirmedAt ?? null,
    reference: refund.reference ?? null,
  };
}

/** The commission as the correction saw it: the frozen specification and the fit profile it was cut against. */
export async function toCorrectionOrderView(ctx: Ctx, order: Order): Promise<CorrectionOrderView> {
  const [names, cloth, version] = await Promise.all([
    specNames(ctx, order.spec),
    clothSummary(ctx, order.spec.clothCode),
    fitProfileVersion(ctx, order.fitProfileId),
  ]);
  return {
    orderId: order._id,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    spec: order.spec,
    specHash: order.specHash,
    lines: describeSpec(order.spec, names),
    summary: specSummary(order.spec, cloth?.name),
    fitProfileVersion: version,
    releasedAt: order.releasedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
  };
}

export function requiresHouseReview(order: Pick<Order, "status" | "releasedAt">, kind: CorrectionKind): boolean {
  return kind === "cancellation" && (order.releasedAt !== undefined || order.status !== "preflight");
}

export async function toCorrectionView(ctx: Ctx, c: Correction): Promise<CorrectionView> {
  const order = await ctx.db.get(c.orderId);
  if (!order) throw appError("NOT_FOUND", "That commission doesn't exist.");
  const [orderView, remedy, urls] = await Promise.all([
    toCorrectionOrderView(ctx, order),
    c.remedy ? toRemedyView(ctx, c.remedy) : Promise.resolve(null),
    Promise.all(c.photoStorageIds.map((storageId) => ctx.storage.getUrl(storageId))),
  ]);
  return {
    _id: c._id,
    orderId: c.orderId,
    caseId: c.caseId,
    kind: c.kind,
    kindLabel: CORRECTION_KIND_LABELS[c.kind],
    region: c.region ?? null,
    regionLabel: c.region ? FIT_REGION_LABELS[c.region] : null,
    isDetailMismatch: c.region === "detail_mismatch",
    description: c.description,
    status: c.status,
    statusLabel: CORRECTION_STATUS_LABELS[c.status],
    open: isOpen(c),
    remedy,
    refund: toRefundView(c.refund),
    reassessment: c.reassessment ?? null,
    order: orderView,
    fitProfileVersionBefore: c.fitProfileVersionBefore ?? null,
    fitProfileVersionAfter: c.fitProfileVersionAfter ?? null,
    photoUrls: urls.filter((url): url is string => url !== null),
    requiresHouseReview: requiresHouseReview(order, c.kind),
    escalatedAt: c.escalatedAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function toCorrectionSummary(c: Correction): CorrectionSummary {
  return {
    _id: c._id,
    orderId: c.orderId,
    caseId: c.caseId,
    kind: c.kind,
    kindLabel: CORRECTION_KIND_LABELS[c.kind],
    region: c.region ?? null,
    regionLabel: c.region ? FIT_REGION_LABELS[c.region] : null,
    status: c.status,
    statusLabel: CORRECTION_STATUS_LABELS[c.status],
    open: isOpen(c),
    refundStateLabel: c.refund ? REFUND_STATE_LABELS[c.refund.state] : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function toStaffRow(ctx: Ctx, c: Correction): Promise<StaffCorrectionRow> {
  const [client, caseDoc] = await Promise.all([
    c.userId ? ctx.db.get(c.userId) : Promise.resolve(null),
    ctx.db.get(c.caseId),
  ]);
  const owner = caseDoc?.ownerStaffId ? await ctx.db.get(caseDoc.ownerStaffId) : null;
  return {
    ...toCorrectionSummary(c),
    clientName: clientDisplayName(client),
    ownerKind: c.userId !== undefined ? "account" : "guest",
    caseOwner: owner?.name ?? null,
    casePriority: caseDoc?.priority ?? "normal",
    escalatedAt: c.escalatedAt ?? null,
  };
}

export async function toStaffView(ctx: Ctx, c: Correction): Promise<StaffCorrectionView> {
  const [view, row, order] = await Promise.all([toCorrectionView(ctx, c), toStaffRow(ctx, c), ctx.db.get(c.orderId)]);
  return {
    ...view,
    clientName: row.clientName,
    ownerKind: row.ownerKind,
    caseOwner: row.caseOwner,
    casePriority: row.casePriority,
    payment: order
      ? {
          state: order.payment.state,
          stateLabel: PAYMENT_STATE_LABELS[order.payment.state],
          amountUsd: order.payment.amountUsd ?? null,
          reference: order.payment.reference ?? null,
        }
      : null,
    priorCorrections: (await correctionsForOrder(ctx, c.orderId))
      .filter((other) => other._id !== c._id)
      .map(toCorrectionSummary),
  };
}

// ------------------------------------------------------------------------------------------------
// The client's request (C23, C24, C25)
// ------------------------------------------------------------------------------------------------

export type RequestCorrectionInput = {
  kind: CorrectionKind;
  region?: FitRegion;
  description: string;
  photoStorageIds?: Id<"_storage">[];
  submissionKey: string;
};

export type RequestCorrectionResult = {
  correctionId: Id<"atelierCorrections">;
  caseId: Id<"atelierCases">;
  duplicate: boolean;
};

/** Every supporting photograph must be a stored image within the house's size limit; nothing else is signed later. */
async function validatePhotos(ctx: Ctx, storageIds: readonly Id<"_storage">[]): Promise<Id<"_storage">[]> {
  if (storageIds.length > CORRECTION_PHOTOS_MAX) {
    throw appError("INVALID_INPUT", `Up to ${CORRECTION_PHOTOS_MAX} photographs can accompany a correction.`, {
      max: CORRECTION_PHOTOS_MAX,
    });
  }
  const unique = [...new Set(storageIds)];
  for (const storageId of unique) {
    const stored = await ctx.db.system.get("_storage", storageId);
    if (!stored) throw appError("INVALID_INPUT", "One of the photographs did not finish saving. Add it again.");
    if (stored.contentType !== undefined && !stored.contentType.startsWith("image/")) {
      throw appError("INVALID_INPUT", "Only photographs can accompany a correction.", {
        contentType: stored.contentType,
      });
    }
    if (stored.size > ATELIER_LIMITS.maxPhotoBytes) {
      throw appError("INVALID_INPUT", "One of the photographs is larger than the house accepts.", {
        maxBytes: ATELIER_LIMITS.maxPhotoBytes,
      });
    }
  }
  return unique;
}

function assertOrderAllows(order: Order, kind: CorrectionKind): void {
  const allowed = kind === "cancellation" ? CANCELLABLE_ORDER_STATUSES : IN_HAND_ORDER_STATUSES;
  if (allowed.includes(order.status)) return;
  if (order.status === "cancelled")
    throw appError("INVALID_STATE", "This commission was cancelled.", { status: order.status });
  throw appError(
    "INVALID_STATE",
    "Your suit has not arrived yet. For anything before delivery, write to your concierge on your request; a fit or detail issue can be raised once the suit is with you.",
    { status: order.status },
  );
}

/** The first thing the client reads on the new case: what kind of review the house makes of this request. */
export function receiptFor(
  order: Pick<Order, "status" | "releasedAt">,
  input: Pick<RequestCorrectionInput, "kind" | "region">,
  fitProfileVersion: number | null,
): string {
  if (input.kind === "cancellation") {
    return requiresHouseReview(order, input.kind)
      ? `Your commission has been released to the cutter. ${HOUSE_POLICY.verified.finalSale} A member of the house reviews every cancellation after release and replies here; nothing is cancelled until they confirm it.`
      : "Your commission has not been released yet. The house will confirm the cancellation here before anything else happens.";
  }
  if (input.kind === "return" || input.kind === "exchange" || input.kind === "refund") {
    return `The house's published policy: ${HOUSE_POLICY.verified.refunds} Your concierge will tell you what applies to this commission before anything is arranged.`;
  }
  if (input.region === "detail_mismatch") {
    return "You reported a detail that does not match the design. The house checks the garment against the specification you approved, line by line. This is a manufacturing check, not a fit correction, and your fit profile is unchanged.";
  }
  if (input.region) {
    const against = fitProfileVersion !== null ? ` against fit profile v${fitProfileVersion}` : "";
    return `You reported a fit concern: ${FIT_REGION_LABELS[input.region].toLowerCase()}. The house reviews it as a fit correction${against}. ${HOUSE_POLICY.verified.alterations}`;
  }
  return `${HOUSE_POLICY.verified.alterations} A member of the house will reply here.`;
}

export async function requestCorrection(
  ctx: MutationCtx,
  actor: Actor,
  orderId: Id<"atelierOrders">,
  input: RequestCorrectionInput,
  now: number = Date.now(),
): Promise<RequestCorrectionResult> {
  const order = requireOwned(await ctx.db.get(orderId), actor, "commission");
  const description = requireText(input.description, "A description of the issue");
  const submissionKey = requireText(input.submissionKey, "A submission key", SUBMISSION_KEY_MAX);
  assertOrderAllows(order, input.kind);
  const photoStorageIds = await validatePhotos(ctx, input.photoStorageIds ?? []);

  const orderCase = await ctx.db.get(order.caseId);
  const contact: Contact = orderCase?.contact ?? {
    name: clientDisplayName(actor.user),
    email: actor.user?.email ?? "guest",
    channel: "email",
  };
  const owner = ownerOf(order);
  const versionBefore = await fitProfileVersion(ctx, order.fitProfileId);
  const regionLabel = input.region ? ` · ${FIT_REGION_LABELS[input.region]}` : "";

  const { caseId, duplicate } = await createCase(
    ctx,
    {
      kind: "aftercare",
      owner,
      actor,
      contact,
      submissionKey,
      message: description,
      orderId: order._id,
      receipt: `Aftercare request received: ${CORRECTION_KIND_LABELS[input.kind]}${regionLabel}. A member of the house will take it up and you will see their name here.`,
    },
    now,
  );
  if (duplicate) {
    const existing = await ctx.db.get(caseId);
    if (existing?.correctionId) return { correctionId: existing.correctionId, caseId, duplicate: true };
    if (existing && existing.kind !== "aftercare") {
      throw appError("CONFLICT", "That reference was already used for another request.", { caseId });
    }
  }

  const prior = await correctionsForOrder(ctx, order._id);
  const repeated = prior.some((other) => other.reassessment?.outcome === "still_issue");

  const correctionId = await ctx.db.insert("atelierCorrections", {
    orderId: order._id,
    ...owner,
    caseId,
    kind: input.kind,
    region: input.region,
    description,
    photoStorageIds,
    status: repeated ? "escalated" : "requested",
    fitProfileVersionBefore: versionBefore ?? undefined,
    escalatedAt: repeated ? now : undefined,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(caseId, { correctionId });

  if (IN_HAND_ORDER_STATUSES.includes(order.status) && order.status !== "correction_open") {
    await ctx.db.patch(order._id, { status: "correction_open", updatedAt: now });
  }

  await appendMessage(ctx, caseId, { author: "system", body: receiptFor(order, input, versionBefore) }, now);
  if (repeated) {
    await touchCase(ctx, caseId, { priority: "high", escalatedAt: now, status: "awaiting_staff" }, now);
    await appendMessage(
      ctx,
      caseId,
      {
        author: "system",
        body: "An earlier correction on this suit did not resolve the issue, so this request has gone straight to a senior member of the house for a decision. You will not be asked to describe it again.",
      },
      now,
    );
    await audit(
      ctx,
      {
        actor: null,
        actorKind: "system",
        action: "correction.autoEscalate",
        targetTable: "atelierCorrections",
        targetId: correctionId,
        meta: { orderId: order._id, reason: "repeated_still_issue" },
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "correction.request",
      targetTable: "atelierCorrections",
      targetId: correctionId,
      meta: {
        orderId: order._id,
        caseId,
        kind: input.kind,
        region: input.region ?? null,
        photos: photoStorageIds.length,
      },
    },
    now,
  );
  return { correctionId, caseId, duplicate: false };
}

// ------------------------------------------------------------------------------------------------
// The client's decisions
// ------------------------------------------------------------------------------------------------

/** C24 step 3: the client accepts the proposed remedy; nothing proceeds until they do. Running twice is harmless. */
export async function acceptRemedy(
  ctx: MutationCtx,
  actor: Actor,
  c: Correction,
  now: number = Date.now(),
): Promise<void> {
  if (!isOwner(c, actor)) throw appError("NOT_FOUND", "That correction doesn't exist.");
  if (c.status === "accepted") return;
  if (c.status !== "remedy_proposed" || !c.remedy) {
    throw appError("INVALID_STATE", "There is no remedy to accept yet. The house will propose one here.", {
      status: c.status,
    });
  }
  assertTransition(c, "accepted");
  await ctx.db.patch(c._id, { status: "accepted", updatedAt: now });
  await touchCase(ctx, c.caseId, { status: "awaiting_staff" }, now);
  await appendMessage(
    ctx,
    c.caseId,
    {
      author: "system",
      body: `Remedy accepted on ${formatDay(now)}: ${CORRECTION_KIND_LABELS[c.remedy.kind].toLowerCase()}, ${REMEDY_COVERAGE_LABELS[c.remedy.coverage].toLowerCase()}. ${c.remedy.logistics}`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "correction.acceptRemedy",
      targetTable: "atelierCorrections",
      targetId: c._id,
    },
    now,
  );
}

export type ReassessInput = { outcome: ReassessmentOutcome; note: string };

/**
 * C24 acceptance: the follow-up checks the actual fit before anyone calls the correction a success. "Resolved"
 * closes it and settles the commission; "still an issue" escalates it with the case marked high priority,
 * and a second unsuccessful correction on the same suit is named as such for a human decision (O07).
 */
export async function reassess(
  ctx: MutationCtx,
  actor: Actor,
  c: Correction,
  input: ReassessInput,
  now: number = Date.now(),
): Promise<void> {
  if (!isOwner(c, actor)) throw appError("NOT_FOUND", "That correction doesn't exist.");
  if (c.status !== "completed") {
    throw appError(
      "INVALID_STATE",
      c.reassessment
        ? "You have already told the house how this correction turned out."
        : "The house has not finished this correction yet; you will be asked to reassess the fit when it has.",
      { status: c.status },
    );
  }
  const note =
    input.outcome === "still_issue"
      ? requireText(input.note, "A few words on what is still wrong")
      : input.note.trim().slice(0, CORRECTION_TEXT_MAX) || "Fit confirmed by the client.";
  const reassessment = { at: now, outcome: input.outcome, note };
  if (input.outcome === "resolved") {
    assertTransition(c, "closed");
    await ctx.db.patch(c._id, { status: "closed", reassessment, updatedAt: now });
    await touchCase(ctx, c.caseId, { status: "completed", closedAt: now }, now);
    await appendMessage(
      ctx,
      c.caseId,
      { author: "system", body: `Reassessed on ${formatDay(now)}: resolved. ${note}` },
      now,
    );
    await settleOrder(ctx, { ...c, status: "closed" }, true, now);
  } else {
    assertTransition(c, "escalated");
    const earlier = (await correctionsForOrder(ctx, c.orderId)).filter(
      (other) => other._id !== c._id && other.reassessment?.outcome === "still_issue",
    );
    const repeated = earlier.length > 0;
    await ctx.db.patch(c._id, { status: "escalated", escalatedAt: now, reassessment, updatedAt: now });
    await touchCase(ctx, c.caseId, { status: "awaiting_staff", priority: "high", escalatedAt: now }, now);
    await appendMessage(
      ctx,
      c.caseId,
      {
        author: "system",
        body: repeated
          ? `Reassessed on ${formatDay(now)}: still an issue, for the second time on this suit. ${note} This has gone to a senior member of the house for a decision; you will not be asked to describe it again.`
          : `Reassessed on ${formatDay(now)}: still an issue. ${note} This has been escalated to a senior member of the house, who will reply here.`,
      },
      now,
    );
    await audit(
      ctx,
      {
        actor: null,
        actorKind: "system",
        action: "correction.autoEscalate",
        targetTable: "atelierCorrections",
        targetId: c._id,
        meta: { orderId: c.orderId, reason: repeated ? "repeated_still_issue" : "still_issue" },
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "correction.reassess",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { outcome: input.outcome },
    },
    now,
  );
}

/**
 * When the last open correction on a commission ends, the commission's status stops saying "a correction is
 * open". A resolved reassessment is a fit acceptance; anything else returns the suit to the state the
 * client left it in. Milestones belong to the orders domain and are not written here.
 */
async function settleOrder(ctx: MutationCtx, c: Correction, resolved: boolean, now: number): Promise<void> {
  const order = await ctx.db.get(c.orderId);
  if (!order || order.status !== "correction_open") return;
  const stillOpen = (await correctionsForOrder(ctx, order._id)).filter((other) => other._id !== c._id && isOpen(other));
  if (stillOpen.length > 0) return;
  const next: OrderStatus = resolved || order.fitAcceptedAt !== undefined ? "accepted" : "fit_review";
  await ctx.db.patch(order._id, { status: next, updatedAt: now });
}

// ------------------------------------------------------------------------------------------------
// Staff (O07)
// ------------------------------------------------------------------------------------------------

/** Takes the correction up: acknowledges it, asks any clarifying question, and makes the case the triager's. */
export async function triage(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const body = requireText(note, "A note to the client");
  assertTransition(c, "triaged");
  await ctx.db.patch(c._id, { status: "triaged", updatedAt: now });
  const caseDoc = await ctx.db.get(c.caseId);
  await touchCase(
    ctx,
    c.caseId,
    {
      status: "assigned",
      ...(caseDoc?.ownerStaffId === undefined ? { ownerStaffId: staff._id, assignedAt: now } : {}),
    },
    now,
  );
  await appendMessage(ctx, c.caseId, { author: "staff", authorUserId: staff._id, body }, now);
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.triage",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { from: c.status },
    },
    now,
  );
}

function validateRemedy(remedy: RemedyInput, now: number): RemedyInput {
  const logistics = requireText(remedy.logistics, "Logistics the client can follow");
  if (remedy.amountUsd !== undefined && (!Number.isFinite(remedy.amountUsd) || remedy.amountUsd < 0)) {
    throw appError("INVALID_INPUT", "The amount must be zero or more.");
  }
  if (remedy.coverage === "quoted" && (remedy.amountUsd === undefined || remedy.amountUsd <= 0)) {
    throw appError("INVALID_INPUT", "A remedy quoted separately needs its amount.");
  }
  if (remedy.deadline !== undefined && remedy.deadline <= now) {
    throw appError("INVALID_INPUT", "The target date has to be in the future.");
  }
  return { ...remedy, logistics };
}

/** O07 step 2: a remedy with real coverage, logistics, timing and an approval owner. The client accepts it on S31. */
export async function proposeRemedy(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  input: RemedyInput,
  now: number = Date.now(),
): Promise<void> {
  const remedy = validateRemedy(input, now);
  assertTransition(c, "remedy_proposed");
  await ctx.db.patch(c._id, {
    status: "remedy_proposed",
    remedy: { ...remedy, approvedByStaffId: staff._id },
    updatedAt: now,
  });
  await touchCase(ctx, c.caseId, { status: "awaiting_client" }, now);
  const amount = remedy.amountUsd !== undefined && remedy.amountUsd > 0 ? ` (${formatUsd(remedy.amountUsd)})` : "";
  const target = remedy.deadline !== undefined ? ` Target: ${formatDay(remedy.deadline)}, an estimate.` : "";
  await appendMessage(
    ctx,
    c.caseId,
    {
      author: "staff",
      authorUserId: staff._id,
      body: `Proposed remedy: ${CORRECTION_KIND_LABELS[remedy.kind].toLowerCase()} · ${REMEDY_COVERAGE_LABELS[remedy.coverage]}${amount}. ${remedy.logistics}${target} Accept it here when you are ready; nothing proceeds until you do.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.proposeRemedy",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { from: c.status, kind: remedy.kind, coverage: remedy.coverage, amountUsd: remedy.amountUsd ?? null },
    },
    now,
  );
}

/**
 * The staff-settable words along the line: accepted → in_progress → received → completed, declined from a
 * triaged request with a note, closed from an escalated or declined one with a note. A completed
 * cancellation cancels the commission; a completed correction records the client's current approved fit
 * profile version and asks them to reassess.
 */
export async function setStatus(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  status: CorrectionStatus,
  note: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  if (!STAFF_SETTABLE_STATUSES.includes(status)) {
    throw appError(
      "INVALID_STATE",
      `"${CORRECTION_STATUS_LABELS[status]}" is not set directly; use the action that moves a correction there.`,
      { status },
    );
  }
  if (c.status === status) return;
  assertTransition(c, status);
  const body = NOTE_REQUIRED_STATUSES.includes(status)
    ? requireText(note ?? "", "A note the client can read")
    : note?.trim() || undefined;
  const patch: Partial<Correction> = { status, updatedAt: now };
  if (status === "completed") {
    const after = await latestApprovedProfileVersion(ctx, c.userId);
    if (after !== null) patch.fitProfileVersionAfter = after;
  }
  await ctx.db.patch(c._id, patch);

  if (status === "completed") {
    await touchCase(ctx, c.caseId, { status: "awaiting_client" }, now);
    if (c.kind === "cancellation") {
      const order = await ctx.db.get(c.orderId);
      if (order && order.status !== "cancelled") await ctx.db.patch(order._id, { status: "cancelled", updatedAt: now });
    }
  } else if (status === "declined" || status === "closed") {
    await touchCase(ctx, c.caseId, { status: "completed", closedAt: now }, now);
    await settleOrder(ctx, { ...c, status }, false, now);
  } else {
    await touchCase(ctx, c.caseId, { status: "awaiting_staff" }, now);
  }

  const line =
    status === "completed"
      ? c.kind === "cancellation"
        ? "Your commission has been cancelled. Any refund is recorded here separately, from the house's payment system, when it is made."
        : `${CORRECTION_STATUS_LABELS.completed}. Tell the house whether the fit is right now, or what is still wrong.`
      : `${CORRECTION_STATUS_LABELS[status]}.`;
  await appendMessage(ctx, c.caseId, { author: "system", body: body ? `${line} ${body}` : line }, now);
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.setStatus",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { from: c.status, to: status },
    },
    now,
  );
}

/** Finance approves an amount. Approved is not refunded: the client reads "Refund approved · not yet returned to you". */
export async function approveRefund(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  amountUsd: number,
  now: number = Date.now(),
): Promise<void> {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0)
    throw appError("INVALID_INPUT", "The refund amount must be more than zero.");
  if (!isOpen(c))
    throw appError("INVALID_STATE", "This correction is closed; open a new one to refund against it.", {
      status: c.status,
    });
  const state = c.refund?.state ?? "none";
  if (state !== "none") {
    throw appError(
      "INVALID_STATE",
      `A refund is already ${REFUND_STATE_LABELS[state].toLowerCase()} on this correction.`,
      { state },
    );
  }
  await ctx.db.patch(c._id, { refund: { state: "approved", amountUsd }, updatedAt: now });
  await appendMessage(
    ctx,
    c.caseId,
    {
      author: "system",
      body: `${REFUND_STATE_LABELS.approved}: ${formatUsd(amountUsd)}. The house records it here when the payment system confirms it.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.approveRefund",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { amountUsd },
    },
    now,
  );
}

export type ConfirmRefundInput = { amountUsd: number; reference: string };

/**
 * The only way `refund.state` becomes "refunded": finance records the payment system's reference. Idempotent
 * on that reference, so a duplicate callback or a double click records one refund (scenario 10); a second,
 * different reference is refused rather than overwriting the first.
 */
export async function confirmRefund(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  input: ConfirmRefundInput,
  now: number = Date.now(),
): Promise<{ duplicate: boolean }> {
  const reference = requireText(input.reference, "The payment system's reference", 200);
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0)
    throw appError("INVALID_INPUT", "The refund amount must be more than zero.");
  const refund = c.refund;
  if (refund?.state === "refunded") {
    if (refund.reference === reference) return { duplicate: true };
    throw appError(
      "INVALID_STATE",
      `This refund was already confirmed under reference ${refund.reference ?? "unknown"}.`,
      { reference: refund.reference ?? null },
    );
  }
  if (!refund || (refund.state !== "approved" && refund.state !== "processing")) {
    throw appError(
      "INVALID_STATE",
      "Approve the refund before confirming it; confirmation records the payment system's reference.",
      { state: refund?.state ?? "none" },
    );
  }
  await ctx.db.patch(c._id, {
    refund: { state: "refunded", amountUsd: input.amountUsd, confirmedAt: now, reference },
    updatedAt: now,
  });
  await appendMessage(
    ctx,
    c.caseId,
    {
      author: "system",
      body: `${REFUND_STATE_LABELS.refunded}: ${formatUsd(input.amountUsd)} on ${formatDay(now)}, reference ${reference}.`,
    },
    now,
  );
  const orderPaymentState = await reflectRefundOnOrder(ctx, staff, c, input.amountUsd, reference, now);
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.confirmRefund",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { amountUsd: input.amountUsd, reference, approvedUsd: refund.amountUsd ?? null, orderPaymentState },
    },
    now,
  );
  return { duplicate: false };
}

/**
 * A confirmed refund is also a payment fact about the commission, so the order's payment record moves to
 * "refunded" (the whole confirmed amount came back) or "refunded_partial" (less did). An order whose payment
 * was never confirmed has nothing to refund against; the correction keeps the record on its own and the
 * order is left as it is.
 */
async function reflectRefundOnOrder(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  amountUsd: number,
  reference: string,
  now: number,
): Promise<PaymentState | null> {
  const order = await ctx.db.get(c.orderId);
  if (!order) return null;
  const paid = order.payment.amountUsd ?? 0;
  const next: PaymentState = amountUsd >= paid ? "refunded" : "refunded_partial";
  if (!PAYMENT_TRANSITIONS[order.payment.state].includes(next)) return null;
  const { payment } = await recordPayment(
    ctx,
    staff,
    order,
    { state: next, amountUsd, reference, provider: order.payment.provider ?? "refund" },
    now,
  );
  return payment.state;
}

/** Scenario 12: a failed label or an unresolved refund gets a person with authority, named on the case. */
export async function escalate(
  ctx: MutationCtx,
  staff: User,
  c: Correction,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  const body = requireText(note, "Why this needs a senior decision");
  if (c.status === "escalated") {
    await appendMessage(ctx, c.caseId, { author: "staff", authorUserId: staff._id, body }, now);
    return;
  }
  assertTransition(c, "escalated");
  await ctx.db.patch(c._id, { status: "escalated", escalatedAt: now, updatedAt: now });
  const caseDoc = await ctx.db.get(c.caseId);
  await touchCase(
    ctx,
    c.caseId,
    {
      status: "awaiting_staff",
      priority: "high",
      escalatedAt: now,
      ...(caseDoc?.ownerStaffId === undefined ? { ownerStaffId: staff._id, assignedAt: now } : {}),
    },
    now,
  );
  await appendMessage(
    ctx,
    c.caseId,
    { author: "staff", authorUserId: staff._id, body: `${CORRECTION_STATUS_LABELS.escalated}. ${body}` },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "correction.escalate",
      targetTable: "atelierCorrections",
      targetId: c._id,
      meta: { from: c.status },
    },
    now,
  );
}
