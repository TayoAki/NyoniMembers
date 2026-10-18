import { v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  assign as assignCase,
  escalateOverdue as escalateOverdueCases,
  findOwnedCase,
  listMessages as listCaseMessages,
  listMine as listMineCases,
  markSample as markCaseSample,
  nameCache,
  propose as proposeChange,
  queue as staffQueue,
  requireOwnedCase,
  respondToProposal as respondToCaseProposal,
  sendClientMessage,
  setNextAction as setCaseNextAction,
  setStatus as setCaseStatus,
  staffGet as staffGetCase,
  staffReply,
  submitCase,
  toCaseView,
  toMessageView,
  transfer as transferCase,
  withdrawProposal as withdrawCaseProposal,
} from "../model/atelier/cases";
import {
  vAppointmentService,
  vAppointmentStatus,
  vCaseKind,
  vCasePriority,
  vCaseStatus,
  vCommercialImpact,
  vContact,
  vDescribedLine,
  vDraftStatus,
  vMessageAuthor,
  vPostalAddress,
  vProposalStatus,
  vQuoteStatus,
  vSampleState,
  vSuitSpec,
} from "../shared/atelier/validators";
import { requireActor, requireStaff, resolveActor } from "./access";
import { ownerArgs, vRevisionSummary } from "./views";

/**
 * Atelier cases: service requests and the conversation around them (contract §5.6; journeys C04, C19,
 * C20, O01; screens S24–S26, A01). Thin wrappers: each resolves the actor or the staff member and
 * delegates to `convex/model/atelier/cases.ts`. A request is received, not booked; a proposal is
 * proposed, not applied; the client reads their own case and their concierge's first name only.
 */

export const vCaseMessageView = v.object({
  _id: v.id("atelierCaseMessages"),
  author: vMessageAuthor,
  /** The concierge's first name on staff messages; null for the client's own and the house's system notes. */
  authorName: v.union(v.string(), v.null()),
  body: v.string(),
  proposalId: v.union(v.id("atelierProposals"), v.null()),
  createdAt: v.number(),
});
export type CaseMessageView = Infer<typeof vCaseMessageView>;

export const vProposalChange = v.object({
  section: vDescribedLine.fields.section,
  label: v.string(),
  from: v.string(),
  to: v.string(),
  fromProductionId: v.union(v.string(), v.null()),
  toProductionId: v.union(v.string(), v.null()),
});
export type ProposalChange = Infer<typeof vProposalChange>;

export const vProposalView = v.object({
  _id: v.id("atelierProposals"),
  caseId: v.id("atelierCases"),
  baseRevision: v.number(),
  status: vProposalStatus,
  statusLabel: v.string(),
  rationale: v.string(),
  commercialImpact: vCommercialImpact,
  beforeSpec: vSuitSpec,
  afterSpec: vSuitSpec,
  /** The order-book lines for each side, and only the lines that differ. */
  before: v.array(vDescribedLine),
  after: v.array(vDescribedLine),
  changes: v.array(vProposalChange),
  /** True when the design moved on after this was proposed: it can be read but no longer accepted. */
  stale: v.boolean(),
  createdAt: v.number(),
  decidedAt: v.union(v.number(), v.null()),
});
export type ProposalView = Infer<typeof vProposalView>;

export const vSampleView = v.object({
  clothCode: v.string(),
  clothName: v.union(v.string(), v.null()),
  state: vSampleState,
  stateLabel: v.string(),
  address: vPostalAddress,
});

export const vCaseQuoteSummary = v.object({
  quoteId: v.id("atelierQuotes"),
  version: v.number(),
  status: vQuoteStatus,
  statusLabel: v.string(),
  totalUsd: v.number(),
  expiresAt: v.number(),
});

export const vCaseAppointmentSummary = v.object({
  appointmentId: v.id("atelierAppointments"),
  status: vAppointmentStatus,
  statusLabel: v.string(),
  service: vAppointmentService,
  serviceLabel: v.string(),
  showroomId: v.union(v.literal("charlotte"), v.literal("atlanta"), v.literal("houston"), v.literal("virtual")),
  confirmedStart: v.union(v.number(), v.null()),
});

export const vCaseView = v.object({
  _id: v.id("atelierCases"),
  kind: vCaseKind,
  kindLabel: v.string(),
  status: vCaseStatus,
  statusLabel: v.string(),
  open: v.boolean(),
  /** First name only, or null while the request awaits a concierge. */
  ownerFirstName: v.union(v.string(), v.null()),
  nextAction: v.union(v.string(), v.null()),
  nextActionDueAt: v.union(v.number(), v.null()),
  priority: vCasePriority,
  /** The client's own details, as they gave them. */
  contact: vContact,
  message: v.union(v.string(), v.null()),
  sample: v.union(vSampleView, v.null()),
  draftId: v.union(v.id("atelierDrafts"), v.null()),
  draftName: v.union(v.string(), v.null()),
  /** The draft's live revision; the submitted one is `revision.revision`. */
  draftRevision: v.union(v.number(), v.null()),
  revision: v.union(vRevisionSummary, v.null()),
  latestMessage: v.union(vCaseMessageView, v.null()),
  proposals: v.array(vProposalView),
  quote: v.union(vCaseQuoteSummary, v.null()),
  appointment: v.union(vCaseAppointmentSummary, v.null()),
  orderId: v.union(v.id("atelierOrders"), v.null()),
  overdue: v.boolean(),
  createdAt: v.number(),
  lastActivityAt: v.number(),
  closedAt: v.union(v.number(), v.null()),
});
export type CaseView = Infer<typeof vCaseView>;

export const vCaseSummary = v.object({
  _id: v.id("atelierCases"),
  kind: vCaseKind,
  kindLabel: v.string(),
  status: vCaseStatus,
  statusLabel: v.string(),
  open: v.boolean(),
  ownerFirstName: v.union(v.string(), v.null()),
  nextAction: v.union(v.string(), v.null()),
  draftId: v.union(v.id("atelierDrafts"), v.null()),
  draftName: v.union(v.string(), v.null()),
  sampleState: v.union(vSampleState, v.null()),
  sampleStateLabel: v.union(v.string(), v.null()),
  latestMessage: v.union(vCaseMessageView, v.null()),
  createdAt: v.number(),
  lastActivityAt: v.number(),
});
export type CaseSummary = Infer<typeof vCaseSummary>;

export const vQueueFilter = v.union(v.literal("unassigned"), v.literal("mine"), v.literal("overdue"), v.literal("awaiting_client"), v.literal("all"));
export type QueueFilter = Infer<typeof vQueueFilter>;

export const vStaffCaseRow = v.object({
  _id: v.id("atelierCases"),
  kind: vCaseKind,
  kindLabel: v.string(),
  status: vCaseStatus,
  statusLabel: v.string(),
  clientFirstName: v.string(),
  ownerStaffId: v.union(v.id("users"), v.null()),
  ownerFirstName: v.union(v.string(), v.null()),
  priority: vCasePriority,
  escalatedAt: v.union(v.number(), v.null()),
  overdue: v.boolean(),
  nextAction: v.union(v.string(), v.null()),
  nextActionDueAt: v.union(v.number(), v.null()),
  draftId: v.union(v.id("atelierDrafts"), v.null()),
  draftName: v.union(v.string(), v.null()),
  sampleState: v.union(vSampleState, v.null()),
  lastActivityAt: v.number(),
  createdAt: v.number(),
});
export type StaffCaseRow = Infer<typeof vStaffCaseRow>;

export const vStaffDraftSummary = v.object({
  _id: v.id("atelierDrafts"),
  name: v.string(),
  status: vDraftStatus,
  revision: v.number(),
  specHash: v.string(),
  spec: vSuitSpec,
  lines: v.array(vDescribedLine),
});

export const vStaffCaseView = vCaseView.extend({
  messages: v.array(vCaseMessageView),
  ownerStaffId: v.union(v.id("users"), v.null()),
  assignedAt: v.union(v.number(), v.null()),
  escalatedAt: v.union(v.number(), v.null()),
  submissionKey: v.string(),
  /** The design as it stands now, which a proposal is made against. */
  draft: v.union(vStaffDraftSummary, v.null()),
});
export type StaffCaseView = Infer<typeof vStaffCaseView>;

export const vSubmitKind = v.union(v.literal("design_review"), v.literal("quote"), v.literal("sample"), v.literal("support"));

export const vSubmitResult = v.object({
  caseId: v.id("atelierCases"),
  revisionId: v.union(v.id("atelierRevisions"), v.null()),
  /** True when this submission key had already been received: the first receipt is returned, nothing is written twice. */
  duplicate: v.boolean(),
});
export type SubmitResult = Infer<typeof vSubmitResult>;

const caseArgs = { ...ownerArgs, caseId: v.id("atelierCases") };

/**
 * C04, C19, S24/S25. One request per `submissionKey`. A design review or quote freezes the design
 * (`reason: "submitted"`) and marks the draft submitted; a sample needs a cloth the house can send and an
 * address; a question needs words. Nothing here orders, prices or books anything.
 */
export const submit = mutation({
  args: {
    ...ownerArgs,
    kind: vSubmitKind,
    draftId: v.optional(v.id("atelierDrafts")),
    contact: vContact,
    message: v.optional(v.string()),
    sample: v.optional(v.object({ clothCode: v.string(), address: vPostalAddress })),
    submissionKey: v.string(),
  },
  returns: vSubmitResult,
  handler: async (ctx, { guestKey, ...input }) => {
    const actor = await requireActor(ctx, guestKey);
    return submitCase(ctx, actor, input);
  },
});

/** S25/S26. The client's own request, or null when the id is malformed, unknown or someone else's. */
export const get = query({
  args: { ...ownerArgs, caseId: v.string(), now: v.optional(v.number()) },
  returns: v.union(vCaseView, v.null()),
  handler: async (ctx, { guestKey, caseId, now }) => {
    const id = ctx.db.normalizeId("atelierCases", caseId);
    if (!id) return null;
    const actor = await resolveActor(ctx, guestKey);
    const found = await findOwnedCase(ctx, id, actor);
    return found ? toCaseView(ctx, found, now ?? Date.now()) : null;
  },
});

/** The requests list, most recent activity first; a signed-out browser without a guest key has none. */
export const listMine = query({
  args: ownerArgs,
  returns: v.array(vCaseSummary),
  handler: async (ctx, { guestKey }) => {
    const actor = await resolveActor(ctx, guestKey);
    if (!actor.user && !actor.guestKey) return [];
    return listMineCases(ctx, actor);
  },
});

/** The conversation, oldest first. Staff messages carry the concierge's first name. */
export const listMessages = query({
  args: caseArgs,
  returns: v.array(vCaseMessageView),
  handler: async (ctx, { guestKey, caseId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const found = requireOwnedCase(await ctx.db.get(caseId), actor);
    const nameOf = nameCache(ctx);
    const messages = await listCaseMessages(ctx, found._id);
    return Promise.all(messages.map((message) => toMessageView(message, nameOf)));
  },
});

/** C20. The client's message; the case becomes "with the house". A closed request does not take replies. */
export const sendMessage = mutation({
  args: { ...caseArgs, body: v.string() },
  returns: v.id("atelierCaseMessages"),
  handler: async (ctx, { guestKey, caseId, body }) => {
    const actor = await resolveActor(ctx, guestKey);
    const found = requireOwnedCase(await ctx.db.get(caseId), actor);
    return sendClientMessage(ctx, actor, found, body);
  },
});

export const vRespondResult = v.object({
  status: vProposalStatus,
  revision: v.number(),
  revisionId: v.union(v.id("atelierRevisions"), v.null()),
});

/**
 * C20, S26. Accept writes the proposed design as a new revision (`proposal_accepted`) and supersedes an
 * offered quote when the change carries a price; decline keeps the design. A proposal made against an
 * earlier revision is refused with STALE_REVISION.
 */
export const respondToProposal = mutation({
  args: { ...ownerArgs, proposalId: v.id("atelierProposals"), accept: v.boolean() },
  returns: vRespondResult,
  handler: async (ctx, { guestKey, proposalId, accept }) => {
    const actor = await resolveActor(ctx, guestKey);
    return respondToCaseProposal(ctx, actor, proposalId, accept);
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (A01, O01)
// ------------------------------------------------------------------------------------------------

/** The queue, bounded. Open filters list the longest-waiting first with high priority on top; "all" is newest first. */
export const queue = query({
  args: { filter: vQueueFilter, now: v.optional(v.number()) },
  returns: v.array(vStaffCaseRow),
  handler: async (ctx, { filter, now }) => {
    const staff = await requireStaff(ctx, "concierge");
    return staffQueue(ctx, staff, filter, now ?? Date.now());
  },
});

export const staffGet = query({
  args: { caseId: v.id("atelierCases"), now: v.optional(v.number()) },
  returns: vStaffCaseView,
  handler: async (ctx, { caseId, now }) => {
    await requireStaff(ctx, "concierge");
    return staffGetCase(ctx, caseId, now ?? Date.now());
  },
});

/** A named owner. The client reads "<First name> has your request" and a notification is queued. */
export const assign = mutation({
  args: { caseId: v.id("atelierCases"), staffId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { caseId, staffId }) => {
    const staff = await requireStaff(ctx, "concierge");
    await assignCase(ctx, staff, caseId, staffId);
    return null;
  },
});

/** Hands the request to another concierge; the conversation and design history stay, the note goes to the audit log. */
export const transfer = mutation({
  args: { caseId: v.id("atelierCases"), staffId: v.id("users"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { caseId, staffId, note }) => {
    const staff = await requireStaff(ctx, "concierge");
    await transferCase(ctx, staff, caseId, staffId, note);
    return null;
  },
});

/** The traceable next action (O01). An empty action clears it and its date. */
export const setNextAction = mutation({
  args: { caseId: v.id("atelierCases"), nextAction: v.string(), dueAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { caseId, nextAction, dueAt }) => {
    const staff = await requireStaff(ctx, "concierge");
    await setCaseNextAction(ctx, staff, caseId, nextAction, dueAt);
    return null;
  },
});

/** Legal transitions only (INVALID_STATE otherwise); completing or cancelling closes the request. */
export const setStatus = mutation({
  args: { caseId: v.id("atelierCases"), status: vCaseStatus },
  returns: v.null(),
  handler: async (ctx, { caseId, status }) => {
    const staff = await requireStaff(ctx, "concierge");
    await setCaseStatus(ctx, staff, caseId, status);
    return null;
  },
});

/** The concierge's reply; the case becomes "waiting on you" for the client and a notification is queued. */
export const reply = mutation({
  args: { caseId: v.id("atelierCases"), body: v.string() },
  returns: v.id("atelierCaseMessages"),
  handler: async (ctx, { caseId, body }) => {
    const staff = await requireStaff(ctx, "concierge");
    return staffReply(ctx, staff, caseId, body);
  },
});

/**
 * C20. A proposed change to the design, pinned to its current revision. The after-design must be
 * complete and free of tailoring conflicts; nothing changes until the client accepts.
 */
export const propose = mutation({
  args: { caseId: v.id("atelierCases"), afterSpec: vSuitSpec, rationale: v.string(), commercialImpact: vCommercialImpact },
  returns: v.id("atelierProposals"),
  handler: async (ctx, { caseId, afterSpec, rationale, commercialImpact }) => {
    const staff = await requireStaff(ctx, "concierge");
    return proposeChange(ctx, staff, caseId, { afterSpec, rationale, commercialImpact });
  },
});

export const withdrawProposal = mutation({
  args: { proposalId: v.id("atelierProposals") },
  returns: v.null(),
  handler: async (ctx, { proposalId }) => {
    const staff = await requireStaff(ctx, "concierge");
    await withdrawCaseProposal(ctx, staff, proposalId);
    return null;
  },
});

/** C04. Requested → accepted → shipped, or declined; each step is a message the client reads. */
export const markSample = mutation({
  args: { caseId: v.id("atelierCases"), state: vSampleState },
  returns: v.null(),
  handler: async (ctx, { caseId, state }) => {
    const staff = await requireStaff(ctx, "concierge");
    await markCaseSample(ctx, staff, caseId, state);
    return null;
  },
});

/** Hourly (convex/crons.ts): unassigned past `assignWithinHours`, or a next action past due → high priority, once. */
export const escalateOverdue = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, { now }) => escalateOverdueCases(ctx, now ?? Date.now()),
});
