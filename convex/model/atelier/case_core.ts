import type { Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, isOwner, type Actor, type Owned } from "../../atelier/access";
import { CASE_KIND_LABELS, type CaseKind, type CasePriority, type MessageAuthor } from "../../shared/atelier/enums";
import type { vContact, vSampleRequest } from "../../shared/atelier/validators";
import { queueNotification } from "./notifications";

type Ctx = QueryCtx | MutationCtx;
export type Contact = Infer<typeof vContact>;
export type SampleRequest = Infer<typeof vSampleRequest>;

/**
 * Case core: the one way a service request comes into being, shared by design review, quotes, samples,
 * fittings, aftercare, privacy and group commissions (O01). Idempotent on `submissionKey` so a retry on
 * poor connectivity produces one case and one receipt (cross-cutting scenario 8).
 */
export type CreateCaseInput = {
  kind: CaseKind;
  owner: Owned;
  actor: Actor | null;
  contact: Contact;
  submissionKey: string;
  message?: string;
  draftId?: Id<"atelierDrafts">;
  revisionId?: Id<"atelierRevisions">;
  orderId?: Id<"atelierOrders">;
  correctionId?: Id<"atelierCorrections">;
  appointmentId?: Id<"atelierAppointments">;
  groupId?: Id<"atelierGroups">;
  sample?: SampleRequest;
  priority?: CasePriority;
  /** The receipt line the client sees first; defaults to the kind's label. */
  receipt?: string;
};

export async function findBySubmissionKey(ctx: Ctx, submissionKey: string): Promise<Doc<"atelierCases"> | null> {
  return ctx.db
    .query("atelierCases")
    .withIndex("by_submissionKey", (q) => q.eq("submissionKey", submissionKey))
    .unique();
}

export async function createCase(
  ctx: MutationCtx,
  input: CreateCaseInput,
  now: number = Date.now(),
): Promise<{ caseId: Id<"atelierCases">; duplicate: boolean }> {
  const existing = await findBySubmissionKey(ctx, input.submissionKey);
  if (existing) {
    if (input.actor && !isOwner(existing, input.actor)) {
      // A foreign submission key must not reveal another client's case; treat it as a fresh key.
      return insertCase(ctx, { ...input, submissionKey: `${input.submissionKey}:${now}` }, now);
    }
    return { caseId: existing._id, duplicate: true };
  }
  return insertCase(ctx, input, now);
}

async function insertCase(
  ctx: MutationCtx,
  input: CreateCaseInput,
  now: number,
): Promise<{ caseId: Id<"atelierCases">; duplicate: boolean }> {
  const caseId = await ctx.db.insert("atelierCases", {
    kind: input.kind,
    ...input.owner,
    draftId: input.draftId,
    revisionId: input.revisionId,
    orderId: input.orderId,
    correctionId: input.correctionId,
    appointmentId: input.appointmentId,
    groupId: input.groupId,
    contact: input.contact,
    message: input.message,
    sample: input.sample,
    submissionKey: input.submissionKey,
    status: "received",
    priority: input.priority ?? "normal",
    lastActivityAt: now,
    createdAt: now,
  });
  await appendMessage(
    ctx,
    caseId,
    {
      author: "system",
      body:
        input.receipt ??
        `${CASE_KIND_LABELS[input.kind]} received. A concierge will take it up and you will see their name here.`,
    },
    now,
  );
  await queueNotification(
    ctx,
    {
      owner: input.owner,
      caseId,
      channel: input.contact.channel === "sms" && input.contact.phone ? "sms" : "email",
      to: input.contact.channel === "sms" && input.contact.phone ? input.contact.phone : input.contact.email,
      subject: `Nyoni Couture · ${CASE_KIND_LABELS[input.kind]} received`,
      body: `We have your ${CASE_KIND_LABELS[input.kind].toLowerCase()}. Your reference is ${caseId}.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: input.actor,
      action: "case.create",
      targetTable: "atelierCases",
      targetId: caseId,
      meta: { kind: input.kind },
    },
    now,
  );
  return { caseId, duplicate: false };
}

export type MessageInput = {
  author: MessageAuthor;
  authorUserId?: Id<"users">;
  body: string;
  proposalId?: Id<"atelierProposals">;
};

/** Adds a message and moves the case's activity clock; status changes are the caller's decision. */
export async function appendMessage(
  ctx: MutationCtx,
  caseId: Id<"atelierCases">,
  message: MessageInput,
  now: number = Date.now(),
): Promise<Id<"atelierCaseMessages">> {
  const id = await ctx.db.insert("atelierCaseMessages", {
    caseId,
    author: message.author,
    authorUserId: message.authorUserId,
    body: message.body,
    proposalId: message.proposalId,
    createdAt: now,
  });
  await ctx.db.patch(caseId, { lastActivityAt: now });
  return id;
}

export async function touchCase(
  ctx: MutationCtx,
  caseId: Id<"atelierCases">,
  patch: Partial<
    Pick<
      Doc<"atelierCases">,
      | "status"
      | "ownerStaffId"
      | "assignedAt"
      | "nextAction"
      | "nextActionDueAt"
      | "priority"
      | "escalatedAt"
      | "closedAt"
    >
  >,
  now: number = Date.now(),
): Promise<void> {
  await ctx.db.patch(caseId, { ...patch, lastActivityAt: now });
}

export async function requireCase(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Doc<"atelierCases">> {
  const doc = await ctx.db.get(caseId);
  if (!doc) throw new Error("Case not found");
  return doc;
}
