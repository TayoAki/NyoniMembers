import type { Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  audit,
  hasStaffRole,
  isOwner,
  ownerFieldsFor,
  requireOwned,
  staffDisplayName,
  type Actor,
  type Owned,
} from "../../atelier/access";
import type {
  CaseMessageView,
  CaseSummary,
  CaseView,
  ProposalChange,
  ProposalView,
  QueueFilter,
  StaffCaseRow,
  StaffCaseView,
} from "../../atelier/cases";
import { appError } from "../../lib/errors";
import {
  APPOINTMENT_SERVICE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  ATELIER_LIMITS,
  CASE_KIND_LABELS,
  CASE_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  type CaseStatus,
  type CommercialImpact,
  type ProposalStatus,
  type SampleState,
} from "../../shared/atelier/enums";
import { HOUSE_POLICY } from "../../shared/atelier/policy";
import { applyChange, describeSpec, specHash, validateSpec, type DescribedLine, type SuitSpec } from "../../shared/atelier/spec";
import type { vContact, vPostalAddress } from "../../shared/atelier/validators";
import { getEntry, specNames } from "./catalogue";
import { appendMessage, createCase, findBySubmissionKey, touchCase, type Contact } from "./case_core";
import { queueNotification } from "./notifications";
import { createRevision, toRevisionSummary } from "./revisions";

type Ctx = QueryCtx | MutationCtx;
type Case = Doc<"atelierCases">;
type Message = Doc<"atelierCaseMessages">;
type Proposal = Doc<"atelierProposals">;
type User = Doc<"users">;
type PostalAddress = Infer<typeof vPostalAddress>;
type ContactInput = Infer<typeof vContact>;

/**
 * Cases: every service request a client sends the house and the conversation around it (contract §5.6;
 * journeys C04, C19, C20, O01). The rules here keep the words truthful: a saved design is not a
 * submitted one, a received request is not an assigned one, a proposed change is not an accepted one,
 * and nothing changes a design through chat alone. Staff writes are audited; clients only ever see their
 * own case and their concierge's first name.
 */

export const CASE_TEXT_MAX = 2000;
export const SUBMISSION_KEY_MAX = 128;
export const CASE_LIST_MAX = 50;
export const MESSAGES_MAX = 200;
export const PROPOSALS_MAX = 50;
export const QUEUE_MAX = 100;
export const QUOTES_MAX = 20;
export const ESCALATE_BATCH = 100;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const OPEN_CASE_STATUSES: readonly CaseStatus[] = ["received", "assigned", "awaiting_client", "awaiting_staff"];
export const CLOSED_CASE_STATUSES: readonly CaseStatus[] = ["completed", "cancelled"];

/** Service state machine (SCREENS-AND-STATES): received → assigned → awaiting client/staff → completed/cancelled. */
export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  received: ["assigned", "awaiting_client", "awaiting_staff", "completed", "cancelled"],
  assigned: ["awaiting_client", "awaiting_staff", "completed", "cancelled"],
  awaiting_client: ["assigned", "awaiting_staff", "completed", "cancelled"],
  awaiting_staff: ["assigned", "awaiting_client", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Sample fulfilment (C04): requested → accepted → shipped, or declined at either step. */
export const SAMPLE_TRANSITIONS: Record<SampleState, readonly SampleState[]> = {
  requested: ["accepted", "declined"],
  accepted: ["shipped", "declined"],
  shipped: [],
  declined: [],
};

export const SAMPLE_STATE_LABELS: Record<SampleState, string> = {
  requested: "Requested · awaiting the house",
  accepted: "Accepted · being prepared",
  shipped: "Shipped",
  declined: "Not available",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  proposed: "Proposed · awaiting your decision",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Withdrawn by the house",
};

export function isOpen(c: Pick<Case, "status">): boolean {
  return OPEN_CASE_STATUSES.includes(c.status);
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

export function startOfUtcDay(now: number): number {
  return now - (now % DAY_MS);
}

function requireOpen(c: Case, verb: string): Case {
  if (!isOpen(c)) {
    throw appError("INVALID_STATE", `This request is ${CASE_STATUS_LABELS[c.status].toLowerCase()}; it cannot be ${verb}.`, {
      status: c.status,
    });
  }
  return c;
}

function cleanText(value: string | null | undefined, what: string, max: number = CASE_TEXT_MAX): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw appError("INVALID_INPUT", `Keep ${what} under ${max} characters.`, { max });
  return trimmed;
}

function requireText(value: string | null | undefined, what: string, max: number = CASE_TEXT_MAX): string {
  const cleaned = cleanText(value, what, max);
  if (!cleaned) throw appError("INVALID_INPUT", `Add ${what}.`);
  return cleaned;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims, lowercases the address and insists on a name and a reachable email; the phone is optional unless SMS is asked for. */
export function normalizeContact(contact: ContactInput): Contact {
  const name = requireText(contact.name, "your name", 120);
  const email = contact.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw appError("INVALID_INPUT", "Enter an email address the house can reply to.");
  const phone = cleanText(contact.phone, "your phone number", 40);
  if (contact.channel === "sms" && !phone) {
    throw appError("INVALID_INPUT", "Add a phone number to be reached by text, or choose email.");
  }
  return {
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(contact.preferredShowroom ? { preferredShowroom: contact.preferredShowroom } : {}),
    channel: contact.channel,
  };
}

function normalizeAddress(address: PostalAddress): PostalAddress {
  const line1 = requireText(address.line1, "the first line of the address", 200);
  const line2 = cleanText(address.line2, "the second line of the address", 200);
  const city = requireText(address.city, "the city", 120);
  const region = requireText(address.region, "the state or region", 120);
  const postalCode = requireText(address.postalCode, "the postal code", 20);
  const country = requireText(address.country, "the country", 80);
  return { line1, ...(line2 ? { line2 } : {}), city, region, postalCode, country };
}

/** Who a notification reaches: the phone when the client asked for texts and gave one, else the email. */
export function notificationTarget(contact: Contact): { channel: "email" | "sms"; to: string } {
  if (contact.channel === "sms" && contact.phone) return { channel: "sms", to: contact.phone };
  return { channel: "email", to: contact.email };
}

export function caseOwner(c: Owned): Owned {
  if (c.userId !== undefined) return { userId: c.userId };
  if (c.guestKey !== undefined) return { guestKey: c.guestKey };
  return {};
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

// ------------------------------------------------------------------------------------------------
// Submission (C04, C19)
// ------------------------------------------------------------------------------------------------

export type SubmitKind = "design_review" | "quote" | "sample" | "support";

export type SubmitInput = {
  kind: SubmitKind;
  draftId?: Id<"atelierDrafts">;
  contact: ContactInput;
  message?: string;
  sample?: { clothCode: string; address: PostalAddress };
  submissionKey: string;
};

export type SubmitResult = { caseId: Id<"atelierCases">; revisionId: Id<"atelierRevisions"> | null; duplicate: boolean };

const RECEIPTS: Record<SubmitKind, string> = {
  design_review: `Design review received. A concierge will look over your design as submitted and reply here. ${HOUSE_POLICY.proposed.responseTime} Nothing is ordered and no price is set until you approve a quote.`,
  quote: `Quote request received. A concierge will price your design as submitted and offer a quote here for your approval. ${HOUSE_POLICY.proposed.responseTime} A quote request is not a purchase and not a booking.`,
  sample: `Cloth sample requested. A concierge will confirm the sample and you will see here when it ships. A sample does not order a suit.`,
  support: `Question received. A concierge will reply here. ${HOUSE_POLICY.proposed.responseTime}`,
};

function ownerCasesSince(ctx: Ctx, owner: Owned, since: number) {
  const userId = owner.userId;
  if (userId !== undefined) {
    return ctx.db
      .query("atelierCases")
      .withIndex("by_user", (q) => q.eq("userId", userId).gte("lastActivityAt", since));
  }
  const guestKey = owner.guestKey;
  return ctx.db
    .query("atelierCases")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey).gte("lastActivityAt", since));
}

/** `casesPerDay` new requests per owner per UTC day. A case made today has activity today, so the range covers it. */
export async function assertDailyCaseBudget(ctx: Ctx, owner: Owned, now: number): Promise<void> {
  const limit = ATELIER_LIMITS.casesPerDay;
  const since = startOfUtcDay(now);
  const today = await ownerCasesSince(ctx, owner, since)
    .filter((q) => q.gte(q.field("createdAt"), since))
    .take(limit + 1);
  if (today.length >= limit) {
    throw appError(
      "RATE_LIMITED",
      `You have sent ${limit} requests today. Your designs are saved; your concierge will reply to what you have sent before you need to send more.`,
      { limit, resetsAt: since + DAY_MS },
    );
  }
}

/**
 * One request, once. A repeated `submissionKey` from the same owner returns the first receipt and writes
 * nothing (cross-cutting scenario 8). A design review or quote freezes the design as a revision and marks
 * the draft submitted; a sample names a cloth the house can send and where to; a question needs words.
 * No address is ever asked for anything but a sample.
 */
export async function submitCase(ctx: MutationCtx, actor: Actor, input: SubmitInput, now: number = Date.now()): Promise<SubmitResult> {
  const owner = ownerFieldsFor(actor);
  const submissionKey = requireText(input.submissionKey, "a submission key", SUBMISSION_KEY_MAX);
  const existing = await findBySubmissionKey(ctx, submissionKey);
  if (existing && isOwner(existing, actor)) {
    return { caseId: existing._id, revisionId: existing.revisionId ?? null, duplicate: true };
  }

  const contact = normalizeContact(input.contact);
  const message = cleanText(input.message, "your message");
  const draft = input.draftId !== undefined ? requireOwned(await ctx.db.get(input.draftId), actor, "design") : null;

  let revisionId: Id<"atelierRevisions"> | undefined;
  let sample: Doc<"atelierCases">["sample"];
  if (input.kind === "design_review" || input.kind === "quote") {
    if (!draft) throw appError("INVALID_INPUT", "Choose the design you would like the house to look at.");
    if (draft.status === "archived") {
      throw appError("INVALID_STATE", "This design has been archived. Duplicate it to send it to the house.", { status: draft.status });
    }
    const errors = validateSpec(draft.spec);
    if (errors.length > 0) throw appError("INVALID_INPUT", errors.join(" "), { errors });
    const cloth = draft.spec.clothCode ? await getEntry(ctx, "cloth", draft.spec.clothCode) : null;
    if (!cloth) throw appError("INVALID_INPUT", "The cloth on this design is no longer in the catalogue. Choose another before sending it.");
    await assertDailyCaseBudget(ctx, owner, now);
    const revision = await createRevision(ctx, draft, "submitted", now);
    revisionId = revision._id;
    if (draft.status !== "submitted") await ctx.db.patch(draft._id, { status: "submitted", updatedAt: now, lastSavedAt: now });
  } else if (input.kind === "sample") {
    if (!input.sample) throw appError("INVALID_INPUT", "Tell us which cloth to send and where.");
    const cloth = await getEntry(ctx, "cloth", input.sample.clothCode.trim());
    if (!cloth || cloth.status !== "approved") throw appError("INVALID_INPUT", "That cloth is not in the catalogue.");
    if (!cloth.sampleAvailable) {
      throw appError("INVALID_INPUT", `A sample of ${cloth.name} is not available right now. Your concierge can suggest something close.`, {
        clothCode: cloth.code,
      });
    }
    await assertDailyCaseBudget(ctx, owner, now);
    sample = { clothCode: cloth.code, address: normalizeAddress(input.sample.address), state: "requested" };
  } else {
    if (!message) throw appError("INVALID_INPUT", "Tell us how the house can help.");
    await assertDailyCaseBudget(ctx, owner, now);
  }

  const created = await createCase(
    ctx,
    {
      kind: input.kind,
      owner,
      actor,
      contact,
      submissionKey,
      message,
      draftId: draft?._id,
      revisionId,
      sample,
      receipt: RECEIPTS[input.kind],
    },
    now,
  );
  return { caseId: created.caseId, revisionId: revisionId ?? null, duplicate: created.duplicate };
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function findOwnedCase(ctx: Ctx, caseId: Id<"atelierCases">, actor: Actor): Promise<Case | null> {
  const c = await ctx.db.get(caseId);
  return c && isOwner(c, actor) ? c : null;
}

export function requireOwnedCase(c: Case | null, actor: Actor): Case {
  return requireOwned(c, actor, "request");
}

async function staffCase(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Case> {
  const c = await ctx.db.get(caseId);
  if (!c) throw appError("NOT_FOUND", "That request doesn't exist.");
  return c;
}

/** Looks each staff member up once per read. */
export function nameCache(ctx: Ctx): (userId: Id<"users"> | undefined) => Promise<string | null> {
  const cache = new Map<string, Promise<string | null>>();
  return (userId) => {
    if (userId === undefined) return Promise.resolve(null);
    const cached = cache.get(userId);
    if (cached) return cached;
    const lookup = ctx.db.get(userId).then((user) => staffDisplayName(user));
    cache.set(userId, lookup);
    return lookup;
  };
}

export async function listMessages(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Message[]> {
  return ctx.db
    .query("atelierCaseMessages")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .order("asc")
    .take(MESSAGES_MAX);
}

export async function latestMessage(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Message | null> {
  return ctx.db
    .query("atelierCaseMessages")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .order("desc")
    .first();
}

export async function listProposals(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Proposal[]> {
  return ctx.db
    .query("atelierProposals")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .order("asc")
    .take(PROPOSALS_MAX);
}

async function latestQuote(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Doc<"atelierQuotes"> | null> {
  return ctx.db
    .query("atelierQuotes")
    .withIndex("by_case_version", (q) => q.eq("caseId", caseId))
    .order("desc")
    .first();
}

async function linkedAppointment(ctx: Ctx, c: Case): Promise<Doc<"atelierAppointments"> | null> {
  if (c.appointmentId !== undefined) return ctx.db.get(c.appointmentId);
  return ctx.db
    .query("atelierAppointments")
    .withIndex("by_case", (q) => q.eq("caseId", c._id))
    .order("desc")
    .first();
}

export async function toMessageView(
  message: Message,
  nameOf: (userId: Id<"users"> | undefined) => Promise<string | null>,
): Promise<CaseMessageView> {
  return {
    _id: message._id,
    author: message.author,
    authorName: message.author === "staff" ? await nameOf(message.authorUserId) : null,
    body: message.body,
    proposalId: message.proposalId ?? null,
    createdAt: message.createdAt,
  };
}

/** Lines that differ between two designs, keyed by section and label; a line only one side has shows "—" on the other. */
export function diffLines(before: DescribedLine[], after: DescribedLine[]): ProposalChange[] {
  const key = (line: DescribedLine) => `${line.section}\u0000${line.label}`;
  const afterByKey = new Map(after.map((line) => [key(line), line]));
  const changes: ProposalChange[] = [];
  for (const line of before) {
    const next = afterByKey.get(key(line));
    afterByKey.delete(key(line));
    if (next && next.value === line.value && next.productionId === line.productionId) continue;
    changes.push({
      section: line.section,
      label: line.label,
      from: line.value,
      to: next?.value ?? "—",
      fromProductionId: line.productionId ?? null,
      toProductionId: next?.productionId ?? null,
    });
  }
  for (const line of afterByKey.values()) {
    changes.push({
      section: line.section,
      label: line.label,
      from: "—",
      to: line.value,
      fromProductionId: null,
      toProductionId: line.productionId ?? null,
    });
  }
  return changes;
}

export async function toProposalView(ctx: Ctx, proposal: Proposal, draftRevision: number | null): Promise<ProposalView> {
  const [namesBefore, namesAfter] = await Promise.all([specNames(ctx, proposal.beforeSpec), specNames(ctx, proposal.afterSpec)]);
  const before = describeSpec(proposal.beforeSpec, namesBefore);
  const after = describeSpec(proposal.afterSpec, namesAfter);
  return {
    _id: proposal._id,
    caseId: proposal.caseId,
    baseRevision: proposal.baseRevision,
    status: proposal.status,
    statusLabel: PROPOSAL_STATUS_LABELS[proposal.status],
    rationale: proposal.rationale,
    commercialImpact: proposal.commercialImpact,
    beforeSpec: proposal.beforeSpec,
    afterSpec: proposal.afterSpec,
    before,
    after,
    changes: diffLines(before, after),
    stale: proposal.status === "proposed" && draftRevision !== null && draftRevision !== proposal.baseRevision,
    createdAt: proposal.createdAt,
    decidedAt: proposal.decidedAt ?? null,
  };
}

export async function toCaseView(ctx: Ctx, c: Case, now: number = Date.now()): Promise<CaseView> {
  const nameOf = nameCache(ctx);
  const [draft, revision, last, proposals, quote, appointment, ownerFirstName, sampleCloth] = await Promise.all([
    c.draftId !== undefined ? ctx.db.get(c.draftId) : null,
    c.revisionId !== undefined ? ctx.db.get(c.revisionId) : null,
    latestMessage(ctx, c._id),
    listProposals(ctx, c._id),
    latestQuote(ctx, c._id),
    linkedAppointment(ctx, c),
    nameOf(c.ownerStaffId),
    c.sample ? getEntry(ctx, "cloth", c.sample.clothCode) : null,
  ]);
  const draftRevision = draft?.revision ?? null;
  return {
    _id: c._id,
    kind: c.kind,
    kindLabel: CASE_KIND_LABELS[c.kind],
    status: c.status,
    statusLabel: CASE_STATUS_LABELS[c.status],
    open: isOpen(c),
    ownerFirstName,
    nextAction: c.nextAction ?? null,
    nextActionDueAt: c.nextActionDueAt ?? null,
    priority: c.priority,
    contact: c.contact,
    message: c.message ?? null,
    sample: c.sample
      ? {
          clothCode: c.sample.clothCode,
          clothName: sampleCloth?.name ?? null,
          state: c.sample.state,
          stateLabel: SAMPLE_STATE_LABELS[c.sample.state],
          address: c.sample.address,
        }
      : null,
    draftId: c.draftId ?? null,
    draftName: draft?.name ?? null,
    draftRevision,
    revision: revision ? await toRevisionSummary(ctx, revision) : null,
    latestMessage: last ? await toMessageView(last, nameOf) : null,
    proposals: await Promise.all(proposals.map((proposal) => toProposalView(ctx, proposal, draftRevision))),
    quote: quote
      ? {
          quoteId: quote._id,
          version: quote.version,
          status: quote.status,
          statusLabel: QUOTE_STATUS_LABELS[quote.status],
          totalUsd: quote.totalUsd,
          expiresAt: quote.expiresAt,
        }
      : null,
    appointment: appointment
      ? {
          appointmentId: appointment._id,
          status: appointment.status,
          statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status],
          service: appointment.service,
          serviceLabel: APPOINTMENT_SERVICE_LABELS[appointment.service],
          showroomId: appointment.showroomId,
          confirmedStart: appointment.confirmedStart ?? null,
        }
      : null,
    orderId: c.orderId ?? null,
    overdue: isOverdue(c, now),
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    closedAt: c.closedAt ?? null,
  };
}

export async function toCaseSummary(ctx: Ctx, c: Case): Promise<CaseSummary> {
  const nameOf = nameCache(ctx);
  const [draft, last, ownerFirstName] = await Promise.all([
    c.draftId !== undefined ? ctx.db.get(c.draftId) : null,
    latestMessage(ctx, c._id),
    nameOf(c.ownerStaffId),
  ]);
  return {
    _id: c._id,
    kind: c.kind,
    kindLabel: CASE_KIND_LABELS[c.kind],
    status: c.status,
    statusLabel: CASE_STATUS_LABELS[c.status],
    open: isOpen(c),
    ownerFirstName,
    nextAction: c.nextAction ?? null,
    draftId: c.draftId ?? null,
    draftName: draft?.name ?? null,
    sampleState: c.sample?.state ?? null,
    sampleStateLabel: c.sample ? SAMPLE_STATE_LABELS[c.sample.state] : null,
    latestMessage: last ? await toMessageView(last, nameOf) : null,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
  };
}

/** The account's requests and, when this browser still holds a guest key, the guest ones too (S16 continuity). */
export async function listMine(ctx: Ctx, actor: Actor): Promise<CaseSummary[]> {
  const rows: Case[] = [];
  if (actor.user) {
    const userId = actor.user._id;
    rows.push(
      ...(await ctx.db
        .query("atelierCases")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(CASE_LIST_MAX)),
    );
  }
  if (actor.guestKey) {
    const guestKey = actor.guestKey;
    rows.push(
      ...(await ctx.db
        .query("atelierCases")
        .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
        .order("desc")
        .take(CASE_LIST_MAX)),
    );
  }
  const seen = new Set<string>();
  const unique = rows.filter((row) => (seen.has(row._id) ? false : (seen.add(row._id), true)));
  unique.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return Promise.all(unique.slice(0, CASE_LIST_MAX).map((row) => toCaseSummary(ctx, row)));
}

// ------------------------------------------------------------------------------------------------
// Conversation (C20)
// ------------------------------------------------------------------------------------------------

/** A client's words. The house's clock starts: an assigned or waiting case becomes "with the house". */
export async function sendClientMessage(ctx: MutationCtx, actor: Actor, c: Case, body: string, now: number = Date.now()): Promise<Id<"atelierCaseMessages">> {
  requireOwnedCase(c, actor);
  requireOpen(c, "replied to. Start a new request and the house will pick it up");
  const text = requireText(body, "your message");
  const id = await appendMessage(ctx, c._id, { author: "client", authorUserId: actor.user?._id, body: text }, now);
  if (c.status === "assigned" || c.status === "awaiting_client") await touchCase(ctx, c._id, { status: "awaiting_staff" }, now);
  return id;
}

/** A concierge's words. The client's clock starts. */
export async function staffReply(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, body: string, now: number = Date.now()): Promise<Id<"atelierCaseMessages">> {
  const c = requireOpen(await staffCase(ctx, caseId), "replied to");
  const text = requireText(body, "your reply");
  const id = await appendMessage(ctx, c._id, { author: "staff", authorUserId: staff._id, body: text }, now);
  await touchCase(ctx, c._id, { status: "awaiting_client" }, now);
  const target = notificationTarget(c.contact);
  await queueNotification(
    ctx,
    {
      owner: caseOwner(c),
      caseId: c._id,
      ...target,
      subject: `Nyoni Couture · A reply on your ${CASE_KIND_LABELS[c.kind].toLowerCase()}`,
      body: `${staffDisplayName(staff) ?? "Your concierge"} has replied on your ${CASE_KIND_LABELS[c.kind].toLowerCase()}. Read and answer it in your Atelier requests.`,
    },
    now,
  );
  await audit(ctx, { actor: staff, actorKind: "staff", action: "case.reply", targetTable: "atelierCases", targetId: c._id }, now);
  return id;
}

// ------------------------------------------------------------------------------------------------
// Proposals (C20)
// ------------------------------------------------------------------------------------------------

export type ProposeInput = { afterSpec: SuitSpec; rationale: string; commercialImpact: CommercialImpact };

/**
 * Staff propose a change; nothing moves on the design until the client accepts (C20 acceptance: no
 * change through chat alone). The proposal is pinned to the draft's revision so a later edit makes it
 * stale rather than silently landing on a different design.
 */
export async function propose(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, input: ProposeInput, now: number = Date.now()): Promise<Id<"atelierProposals">> {
  const c = requireOpen(await staffCase(ctx, caseId), "changed");
  if (c.draftId === undefined) throw appError("INVALID_STATE", "Only a request about a design can carry a proposed change.");
  const draft = await ctx.db.get(c.draftId);
  if (!draft) throw appError("NOT_FOUND", "The design this request is about no longer exists.");
  const before = draft.spec;
  const baseline = applyChange(before, {});
  if (baseline.conflicts.length > 0 || specHash(baseline.spec) !== specHash(before)) {
    throw appError("INVALID_STATE", "The current design is not self-consistent; ask the client to review it before proposing a change.", {
      conflicts: baseline.conflicts.map((conflict) => conflict.field),
    });
  }
  const errors = validateSpec(input.afterSpec);
  if (errors.length > 0) throw appError("INVALID_INPUT", errors.join(" "), { errors });
  const resolved = applyChange(input.afterSpec, {});
  if (resolved.conflicts.length > 0) {
    throw appError("INVALID_INPUT", "The proposed design has tailoring conflicts; resolve them before proposing it.", {
      conflicts: resolved.conflicts.map((conflict) => `${conflict.field}: ${conflict.reason}`),
    });
  }
  if (specHash(input.afterSpec) === specHash(before)) throw appError("INVALID_INPUT", "The proposed design is the same as the current one.");
  const [cloth, button, lining] = await Promise.all([
    input.afterSpec.clothCode ? getEntry(ctx, "cloth", input.afterSpec.clothCode) : null,
    input.afterSpec.buttonCode ? getEntry(ctx, "button", input.afterSpec.buttonCode) : null,
    input.afterSpec.liningCode ? getEntry(ctx, "lining", input.afterSpec.liningCode) : null,
  ]);
  if (input.afterSpec.clothCode && !cloth) throw appError("INVALID_INPUT", "That cloth is not in the catalogue.");
  if (input.afterSpec.buttonCode && !button) throw appError("INVALID_INPUT", "Those buttons are not in the catalogue.");
  if (input.afterSpec.liningCode && !lining) throw appError("INVALID_INPUT", "That lining is not in the catalogue.");
  const rationale = requireText(input.rationale, "the reason for the change");

  const proposalId = await ctx.db.insert("atelierProposals", {
    caseId: c._id,
    draftId: draft._id,
    baseRevision: draft.revision,
    beforeSpec: before,
    afterSpec: input.afterSpec,
    rationale,
    commercialImpact: input.commercialImpact,
    status: "proposed",
    createdByStaffId: staff._id,
    createdAt: now,
  });
  const first = staffDisplayName(staff) ?? "Your concierge";
  await appendMessage(
    ctx,
    c._id,
    {
      author: "staff",
      authorUserId: staff._id,
      body: `${first} proposed a change to your design: ${rationale}${input.commercialImpact === "new_quote" ? " If you accept, a new quote will follow for your approval." : ""} Compare the two and accept or decline below; nothing changes until you do.`,
      proposalId,
    },
    now,
  );
  await touchCase(ctx, c._id, { status: "awaiting_client" }, now);
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "proposal.create",
      targetTable: "atelierProposals",
      targetId: proposalId,
      meta: { caseId: c._id, baseRevision: draft.revision, commercialImpact: input.commercialImpact },
    },
    now,
  );
  return proposalId;
}

export async function withdrawProposal(ctx: MutationCtx, staff: User, proposalId: Id<"atelierProposals">, now: number = Date.now()): Promise<void> {
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) throw appError("NOT_FOUND", "That proposal doesn't exist.");
  if (proposal.status !== "proposed") {
    throw appError("INVALID_STATE", `This proposal is already ${PROPOSAL_STATUS_LABELS[proposal.status].toLowerCase()}.`, { status: proposal.status });
  }
  await ctx.db.patch(proposal._id, { status: "withdrawn", decidedAt: now });
  await appendMessage(ctx, proposal.caseId, { author: "system", body: "The house withdrew the proposed change. Your design stays as it is.", proposalId }, now);
  await audit(ctx, { actor: staff, actorKind: "staff", action: "proposal.withdraw", targetTable: "atelierProposals", targetId: proposal._id, meta: { caseId: proposal.caseId } }, now);
}

export type RespondResult = { status: ProposalStatus; revision: number; revisionId: Id<"atelierRevisions"> | null };

/**
 * The client decides. Accepting writes the proposed design to the draft as a new revision
 * (`reason: "proposal_accepted"`), moves the case to that revision and, when the change has a price,
 * supersedes the quote on offer. A proposal made against an older revision is refused (STALE_REVISION).
 */
export async function respondToProposal(ctx: MutationCtx, actor: Actor, proposalId: Id<"atelierProposals">, accept: boolean, now: number = Date.now()): Promise<RespondResult> {
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) throw appError("NOT_FOUND", "That proposal doesn't exist.");
  const c = requireOwnedCase(await ctx.db.get(proposal.caseId), actor);
  if (proposal.status !== "proposed") {
    throw appError("INVALID_STATE", `This proposal is already ${PROPOSAL_STATUS_LABELS[proposal.status].toLowerCase()}.`, { status: proposal.status });
  }
  const draft = requireOwned(await ctx.db.get(proposal.draftId), actor, "design");
  if (draft.revision !== proposal.baseRevision) {
    throw appError("STALE_REVISION", "Your design has changed since this was proposed. Ask your concierge to propose it again against the current design.", {
      baseRevision: proposal.baseRevision,
      currentRevision: draft.revision,
    });
  }
  requireOpen(c, "decided");

  if (!accept) {
    await ctx.db.patch(proposal._id, { status: "rejected", decidedAt: now });
    await appendMessage(
      ctx,
      c._id,
      { author: "system", body: `You declined the proposed change. Your design stays as submitted (revision ${draft.revision}).`, proposalId },
      now,
    );
    await touchCase(ctx, c._id, { status: "awaiting_staff" }, now);
    await audit(ctx, { actor, actorKind: "client", action: "proposal.reject", targetTable: "atelierProposals", targetId: proposal._id, meta: { caseId: c._id } }, now);
    return { status: "rejected", revision: draft.revision, revisionId: c.revisionId ?? null };
  }

  const errors = validateSpec(proposal.afterSpec);
  if (errors.length > 0) throw appError("INVALID_STATE", `The proposed design can no longer be accepted: ${errors.join(" ")}`, { errors });
  const revisionNumber = draft.revision + 1;
  await ctx.db.patch(draft._id, { spec: proposal.afterSpec, revision: revisionNumber, updatedAt: now, lastSavedAt: now });
  const updated = await ctx.db.get(draft._id);
  if (!updated) throw appError("NOT_FOUND", "That design doesn't exist.");
  const revision = await createRevision(ctx, updated, "proposal_accepted", now);
  await ctx.db.patch(proposal._id, { status: "accepted", decidedAt: now });
  await ctx.db.patch(c._id, { revisionId: revision._id });

  let superseded = 0;
  if (proposal.commercialImpact === "new_quote") {
    const quotes = await ctx.db
      .query("atelierQuotes")
      .withIndex("by_case_version", (q) => q.eq("caseId", c._id))
      .order("desc")
      .take(QUOTES_MAX);
    for (const quote of quotes) {
      if (quote.status !== "offered") continue;
      await ctx.db.patch(quote._id, { status: "superseded" });
      superseded += 1;
    }
  }
  await appendMessage(
    ctx,
    c._id,
    {
      author: "system",
      body: `You accepted the proposed change. Your design is now revision ${revisionNumber}.${
        proposal.commercialImpact === "new_quote"
          ? superseded > 0
            ? " The quote you were offered no longer matches this design and has been set aside; your concierge will offer a new one."
            : " Your concierge will offer a quote for the agreed design."
          : ""
      }`,
      proposalId,
    },
    now,
  );
  await touchCase(ctx, c._id, { status: "awaiting_staff" }, now);
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "proposal.accept",
      targetTable: "atelierProposals",
      targetId: proposal._id,
      meta: { caseId: c._id, revision: revisionNumber, revisionId: revision._id, supersededQuotes: superseded },
    },
    now,
  );
  return { status: "accepted", revision: revisionNumber, revisionId: revision._id };
}

// ------------------------------------------------------------------------------------------------
// Staff queue and ownership (O01)
// ------------------------------------------------------------------------------------------------

/** Unassigned past the house's window, or a next action whose date has passed. */
export function isOverdue(c: Case, now: number): boolean {
  if (!isOpen(c)) return false;
  if (c.ownerStaffId === undefined && c.createdAt + ATELIER_LIMITS.assignWithinHours * HOUR_MS <= now) return true;
  return c.nextActionDueAt !== undefined && c.nextActionDueAt <= now;
}

async function byStatus(ctx: Ctx, status: CaseStatus, descending = false): Promise<Case[]> {
  const base = ctx.db.query("atelierCases").withIndex("by_status_lastActivity", (q) => q.eq("status", status));
  return (descending ? base.order("desc") : base.order("asc")).take(QUEUE_MAX);
}

async function byOwner(ctx: Ctx, ownerStaffId: Id<"users">, status: CaseStatus): Promise<Case[]> {
  return ctx.db
    .query("atelierCases")
    .withIndex("by_owner_status", (q) => q.eq("ownerStaffId", ownerStaffId).eq("status", status))
    .take(QUEUE_MAX);
}

export async function queueRows(ctx: Ctx, staff: User, filter: QueueFilter, now: number = Date.now()): Promise<Case[]> {
  let rows: Case[];
  switch (filter) {
    case "unassigned": {
      const pages = await Promise.all(["received", "awaiting_staff", "awaiting_client"].map((status) => byStatus(ctx, status as CaseStatus)));
      rows = pages.flat().filter((c) => c.ownerStaffId === undefined);
      break;
    }
    case "mine": {
      const pages = await Promise.all(OPEN_CASE_STATUSES.map((status) => byOwner(ctx, staff._id, status)));
      rows = pages.flat();
      break;
    }
    case "overdue": {
      const pages = await Promise.all(OPEN_CASE_STATUSES.map((status) => byStatus(ctx, status)));
      rows = pages.flat().filter((c) => isOverdue(c, now) || c.priority === "high");
      break;
    }
    case "awaiting_client":
      rows = await byStatus(ctx, "awaiting_client");
      break;
    case "all": {
      const pages = await Promise.all([...OPEN_CASE_STATUSES, ...CLOSED_CASE_STATUSES].map((status) => byStatus(ctx, status, true)));
      rows = pages.flat();
      rows.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      return rows.slice(0, QUEUE_MAX);
    }
  }
  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return a.lastActivityAt - b.lastActivityAt;
  });
  return rows.slice(0, QUEUE_MAX);
}

export async function toStaffRow(ctx: Ctx, c: Case, nameOf: (userId: Id<"users"> | undefined) => Promise<string | null>, now: number): Promise<StaffCaseRow> {
  const [draft, ownerFirstName] = await Promise.all([c.draftId !== undefined ? ctx.db.get(c.draftId) : null, nameOf(c.ownerStaffId)]);
  return {
    _id: c._id,
    kind: c.kind,
    kindLabel: CASE_KIND_LABELS[c.kind],
    status: c.status,
    statusLabel: CASE_STATUS_LABELS[c.status],
    clientFirstName: firstNameOf(c.contact.name) ?? "Client",
    ownerStaffId: c.ownerStaffId ?? null,
    ownerFirstName,
    priority: c.priority,
    escalatedAt: c.escalatedAt ?? null,
    overdue: isOverdue(c, now),
    nextAction: c.nextAction ?? null,
    nextActionDueAt: c.nextActionDueAt ?? null,
    draftId: c.draftId ?? null,
    draftName: draft?.name ?? null,
    sampleState: c.sample?.state ?? null,
    lastActivityAt: c.lastActivityAt,
    createdAt: c.createdAt,
  };
}

export async function queue(ctx: Ctx, staff: User, filter: QueueFilter, now: number = Date.now()): Promise<StaffCaseRow[]> {
  const rows = await queueRows(ctx, staff, filter, now);
  const nameOf = nameCache(ctx);
  return Promise.all(rows.map((c) => toStaffRow(ctx, c, nameOf, now)));
}

/** The whole case for the staff detail: the client view plus the conversation, the owner and the live design. */
export async function toStaffCaseView(ctx: Ctx, c: Case, now: number = Date.now()): Promise<StaffCaseView> {
  const nameOf = nameCache(ctx);
  const [view, messages, draft] = await Promise.all([toCaseView(ctx, c, now), listMessages(ctx, c._id), c.draftId !== undefined ? ctx.db.get(c.draftId) : null]);
  return {
    ...view,
    messages: await Promise.all(messages.map((message) => toMessageView(message, nameOf))),
    ownerStaffId: c.ownerStaffId ?? null,
    assignedAt: c.assignedAt ?? null,
    escalatedAt: c.escalatedAt ?? null,
    submissionKey: c.submissionKey,
    draft: draft
      ? {
          _id: draft._id,
          name: draft.name,
          status: draft.status,
          revision: draft.revision,
          specHash: specHash(draft.spec),
          spec: draft.spec,
          lines: describeSpec(draft.spec, await specNames(ctx, draft.spec)),
        }
      : null,
  };
}

export async function staffGet(ctx: Ctx, caseId: Id<"atelierCases">, now: number = Date.now()): Promise<StaffCaseView> {
  return toStaffCaseView(ctx, await staffCase(ctx, caseId), now);
}

async function requireConcierge(ctx: Ctx, staffId: Id<"users">): Promise<User> {
  const target = await ctx.db.get(staffId);
  if (!target || !hasStaffRole(target, "concierge")) throw appError("INVALID_INPUT", "Only a concierge can own a request.");
  return target;
}

/** A named owner; the client sees the first name and the case leaves the unassigned queue. */
export async function assign(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, staffId: Id<"users">, now: number = Date.now()): Promise<void> {
  const c = requireOpen(await staffCase(ctx, caseId), "assigned");
  if (c.ownerStaffId !== undefined && c.ownerStaffId !== staffId) {
    throw appError("INVALID_STATE", "This request already has an owner. Transfer it to hand it over.", { ownerStaffId: c.ownerStaffId });
  }
  if (c.ownerStaffId === staffId) return;
  const target = await requireConcierge(ctx, staffId);
  const first = staffDisplayName(target) ?? "Your concierge";
  await touchCase(
    ctx,
    c._id,
    { ownerStaffId: target._id, assignedAt: now, status: c.status === "received" || c.status === "awaiting_staff" ? "assigned" : c.status },
    now,
  );
  await appendMessage(ctx, c._id, { author: "system", body: `${first} has your request.` }, now);
  await queueNotification(
    ctx,
    {
      owner: caseOwner(c),
      caseId: c._id,
      ...notificationTarget(c.contact),
      subject: "Nyoni Couture · Your request has a concierge",
      body: `${first} at Nyoni Couture has your ${CASE_KIND_LABELS[c.kind].toLowerCase()} and will reply in your Atelier requests.`,
    },
    now,
  );
  await audit(ctx, { actor: staff, actorKind: "staff", action: "case.assign", targetTable: "atelierCases", targetId: c._id, meta: { ownerStaffId: target._id } }, now);
}

/** Hands a case to another concierge. The conversation and every revision stay; the handover is recorded for the client and in the audit log. */
export async function transfer(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, staffId: Id<"users">, note: string, now: number = Date.now()): Promise<void> {
  const c = requireOpen(await staffCase(ctx, caseId), "transferred");
  const target = await requireConcierge(ctx, staffId);
  if (c.ownerStaffId === target._id) throw appError("INVALID_INPUT", "That concierge already has this request.");
  const handoverNote = requireText(note, "a handover note", 500);
  const previous = c.ownerStaffId !== undefined ? staffDisplayName(await ctx.db.get(c.ownerStaffId)) : null;
  const first = staffDisplayName(target) ?? "Your concierge";
  await touchCase(
    ctx,
    c._id,
    { ownerStaffId: target._id, assignedAt: now, status: c.status === "received" || c.status === "awaiting_staff" ? "assigned" : c.status },
    now,
  );
  await appendMessage(
    ctx,
    c._id,
    {
      author: "system",
      body: previous
        ? `${first} now has your request, taking over from ${previous}. Your conversation and design history stay here.`
        : `${first} has your request.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      actorKind: "staff",
      action: "case.transfer",
      targetTable: "atelierCases",
      targetId: c._id,
      meta: { from: c.ownerStaffId ?? null, to: target._id, note: handoverNote },
    },
    now,
  );
}

export async function setNextAction(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, nextAction: string, dueAt: number | undefined, now: number = Date.now()): Promise<void> {
  const c = requireOpen(await staffCase(ctx, caseId), "planned");
  const text = cleanText(nextAction, "the next action", 300);
  if (!text && dueAt !== undefined) throw appError("INVALID_INPUT", "Name the next action before giving it a date.");
  await touchCase(ctx, c._id, { nextAction: text, nextActionDueAt: text ? dueAt : undefined }, now);
  await audit(ctx, { actor: staff, actorKind: "staff", action: "case.next_action", targetTable: "atelierCases", targetId: c._id, meta: { nextAction: text ?? null, dueAt: dueAt ?? null } }, now);
}

const STATUS_MESSAGES: Partial<Record<CaseStatus, string>> = {
  completed: "Your request is complete. The house is here whenever you need it again.",
  cancelled: "Your request was closed by the house. Reply on a new request if there is more we can do.",
};

/** Legal transitions only; `assigned` needs an owner, and closing stamps `closedAt`. */
export async function setStatus(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, status: CaseStatus, now: number = Date.now()): Promise<void> {
  const c = await staffCase(ctx, caseId);
  if (c.status === status) return;
  if (!canTransition(c.status, status)) {
    throw appError("INVALID_STATE", `A request that is ${CASE_STATUS_LABELS[c.status].toLowerCase()} cannot become ${CASE_STATUS_LABELS[status].toLowerCase()}.`, {
      from: c.status,
      to: status,
    });
  }
  if (status === "assigned" && c.ownerStaffId === undefined) {
    throw appError("INVALID_STATE", "Assign a concierge to mark this request as with one.", { from: c.status, to: status });
  }
  const closing = CLOSED_CASE_STATUSES.includes(status);
  await touchCase(ctx, c._id, { status, ...(closing ? { closedAt: now } : {}) }, now);
  const message = STATUS_MESSAGES[status];
  if (message) await appendMessage(ctx, c._id, { author: "system", body: message }, now);
  await audit(ctx, { actor: staff, actorKind: "staff", action: "case.status", targetTable: "atelierCases", targetId: c._id, meta: { from: c.status, to: status } }, now);
}

/** Sample fulfilment words the client reads (C04 acceptance: requested, accepted and shipped are distinct). */
export async function markSample(ctx: MutationCtx, staff: User, caseId: Id<"atelierCases">, state: SampleState, now: number = Date.now()): Promise<void> {
  const c = requireOpen(await staffCase(ctx, caseId), "updated");
  if (c.kind !== "sample" || !c.sample) throw appError("INVALID_STATE", "This request is not for a cloth sample.", { kind: c.kind });
  const from = c.sample.state;
  if (from === state) return;
  if (!SAMPLE_TRANSITIONS[from].includes(state)) {
    throw appError("INVALID_STATE", `A sample that is ${SAMPLE_STATE_LABELS[from].toLowerCase()} cannot become ${SAMPLE_STATE_LABELS[state].toLowerCase()}.`, { from, to: state });
  }
  const cloth = await getEntry(ctx, "cloth", c.sample.clothCode);
  const name = cloth?.name ?? c.sample.clothCode;
  await ctx.db.patch(c._id, { sample: { ...c.sample, state }, lastActivityAt: now });
  const words: Record<SampleState, string> = {
    requested: `Your sample of ${name} is requested.`,
    accepted: `Your sample of ${name} is being prepared. You will see here when it ships.`,
    shipped: `Your sample of ${name} has shipped to ${c.sample.address.city}.`,
    declined: `The house cannot send a sample of ${name} at the moment. Your concierge will explain here and can suggest something close.`,
  };
  await appendMessage(ctx, c._id, { author: "system", body: words[state] }, now);
  await audit(ctx, { actor: staff, actorKind: "staff", action: "case.sample", targetTable: "atelierCases", targetId: c._id, meta: { from, to: state } }, now);
}

const ESCALATION_MESSAGE = "Your request has been raised with the concierge team so it is picked up promptly.";

/**
 * The cron's rule (O01): a request nobody has taken within `assignWithinHours`, or a next action whose
 * date has passed, is marked high priority once. A case escalates again only for a later due date.
 */
export async function escalateOverdue(ctx: MutationCtx, now: number = Date.now()): Promise<number> {
  const pages = await Promise.all(
    OPEN_CASE_STATUSES.map((status) =>
      ctx.db
        .query("atelierCases")
        .withIndex("by_status_lastActivity", (q) => q.eq("status", status))
        .order("asc")
        .take(ESCALATE_BATCH),
    ),
  );
  let escalated = 0;
  for (const c of pages.flat()) {
    const unassignedTooLong = c.ownerStaffId === undefined && c.createdAt + ATELIER_LIMITS.assignWithinHours * HOUR_MS <= now;
    const actionLate = c.nextActionDueAt !== undefined && c.nextActionDueAt <= now;
    if (!unassignedTooLong && !actionLate) continue;
    const alreadyFlagged =
      c.escalatedAt !== undefined && (!actionLate || c.nextActionDueAt === undefined || c.escalatedAt >= c.nextActionDueAt);
    if (alreadyFlagged) continue;
    await touchCase(ctx, c._id, { priority: "high", escalatedAt: now }, now);
    await appendMessage(ctx, c._id, { author: "system", body: ESCALATION_MESSAGE }, now);
    await audit(
      ctx,
      {
        actor: null,
        actorKind: "system",
        action: "case.escalate",
        targetTable: "atelierCases",
        targetId: c._id,
        meta: { reason: unassignedTooLong ? "unassigned" : "next_action_due", nextActionDueAt: c.nextActionDueAt ?? null },
      },
      now,
    );
    escalated += 1;
  }
  return escalated;
}
