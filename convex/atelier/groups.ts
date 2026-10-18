import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../lib/auth";
import {
  createGroup,
  GROUP_STATUS_LABELS,
  groupView,
  inviteByToken,
  inviteParticipant,
  joinGroup,
  leaveGroup,
  listGroupsForOrganizer,
  listGroupsForReview,
  participationForDraft,
  PERMITTED_INDIVIDUAL_PATHS,
  removeParticipant as removeGroupParticipant,
  reviewGroup,
  reviewView,
  setParticipantConsent,
  updateGroup,
} from "../model/atelier/groups";
import { literals } from "../shared/validators";
import {
  vDescribedLine,
  vGroupStatus,
  vOccasion,
  vParticipantConsent,
  vParticipantStatus,
  vSuitSpec,
} from "../shared/atelier/validators";
import { requireActor, requireDraftAccess, requireStaff, resolveActor } from "./access";
import { ownerArgs, vClothSummary } from "./views";

/**
 * Atelier groups: a wedding party or another group commission (contract §5.12; journey C28, screen S35,
 * staff A01). An organizer writes the shared brief and invites each participant by name; every
 * participant designs and is fitted privately. The organizer sees consented status only — never a
 * participant's measurements, photographs, contact details or the contents of their design.
 */

export { GROUP_STATUS_LABELS, PERMITTED_INDIVIDUAL_PATHS };

export const vPermittedIndividualPath = literals(PERMITTED_INDIVIDUAL_PATHS);
export type PermittedIndividualPath = Infer<typeof vPermittedIndividualPath>;

/** What an organizer (or a reviewing concierge) sees of one participant: readiness, never data. */
export const vGroupParticipantView = v.object({
  participantId: v.id("atelierGroupParticipants"),
  name: v.string(),
  status: vParticipantStatus,
  statusLabel: v.string(),
  consent: vParticipantConsent,
  /** The participant has accepted and holds a design of their own. */
  hasDesign: v.boolean(),
  /** Consented to share style status, and their design names a cloth. */
  designReady: v.boolean(),
  /** Consented to share fit status, and a fitter has approved a fit profile. Never the measurements. */
  fitReady: v.boolean(),
  invitedAt: v.number(),
  joinedAt: v.optional(v.number()),
});
export type GroupParticipantView = Infer<typeof vGroupParticipantView>;

export const vGroupView = v.object({
  _id: v.id("atelierGroups"),
  name: v.string(),
  occasion: vOccasion,
  occasionLabel: v.string(),
  eventDate: v.optional(v.number()),
  brief: v.string(),
  sharedSpec: vSuitSpec,
  sharedLines: v.array(vDescribedLine),
  cloth: v.union(vClothSummary, v.null()),
  permittedIndividual: v.array(vPermittedIndividualPath),
  status: vGroupStatus,
  statusLabel: v.string(),
  participants: v.array(vGroupParticipantView),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type GroupView = Infer<typeof vGroupView>;

export const vGroupSummary = v.object({
  _id: v.id("atelierGroups"),
  name: v.string(),
  occasion: vOccasion,
  occasionLabel: v.string(),
  eventDate: v.optional(v.number()),
  status: vGroupStatus,
  statusLabel: v.string(),
  participantCount: v.number(),
  joinedCount: v.number(),
  updatedAt: v.number(),
});
export type GroupSummary = Infer<typeof vGroupSummary>;

/** What an invitee sees before accepting: the brief's design and who asked, nothing about anyone else. */
export const vInviteView = v.object({
  groupName: v.string(),
  organizerFirstName: v.string(),
  occasion: vOccasion,
  occasionLabel: v.string(),
  eventDate: v.optional(v.number()),
  sharedLines: v.array(vDescribedLine),
  cloth: v.union(vClothSummary, v.null()),
  permittedIndividual: v.array(vPermittedIndividualPath),
  participantName: v.string(),
});
export type InviteView = Infer<typeof vInviteView>;

/** A participant's own standing in a group, read from the design the invitation created. */
export const vParticipationView = v.object({
  participantId: v.id("atelierGroupParticipants"),
  groupName: v.string(),
  organizerFirstName: v.string(),
  status: vParticipantStatus,
  statusLabel: v.string(),
  consent: vParticipantConsent,
  permittedIndividual: v.array(vPermittedIndividualPath),
  groupStatus: vGroupStatus,
  groupStatusLabel: v.string(),
});
export type ParticipationView = Infer<typeof vParticipationView>;

/** The concierge's review row (A01): the organizer's first name, the brief and readiness counts. */
export const vGroupReviewView = v.object({
  _id: v.id("atelierGroups"),
  name: v.string(),
  organizerName: v.string(),
  occasion: vOccasion,
  occasionLabel: v.string(),
  eventDate: v.optional(v.number()),
  brief: v.string(),
  sharedLines: v.array(vDescribedLine),
  status: vGroupStatus,
  statusLabel: v.string(),
  staffReviewNote: v.optional(v.string()),
  participantCount: v.number(),
  joinedCount: v.number(),
  designReadyCount: v.number(),
  fitReadyCount: v.number(),
  participants: v.array(vGroupParticipantView),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type GroupReviewView = Infer<typeof vGroupReviewView>;

export const vGroupReviewStatus = v.union(v.literal("in_review"), v.literal("approved"), v.literal("closed"));
export type GroupReviewStatus = Infer<typeof vGroupReviewStatus>;

// ------------------------------------------------------------------------------------------------
// Organizer (an account is required: invitations are sent in someone's name)
// ------------------------------------------------------------------------------------------------

export const create = mutation({
  args: {
    name: v.string(),
    eventDate: v.optional(v.number()),
    occasion: vOccasion,
    brief: v.string(),
    sharedSpec: vSuitSpec,
    /** Dot paths from PERMITTED_INDIVIDUAL_PATHS; anything else is refused. */
    permittedIndividual: v.array(v.string()),
  },
  returns: v.id("atelierGroups"),
  handler: async (ctx, args) => {
    const organizer = await requireUser(ctx);
    return createGroup(ctx, organizer, args);
  },
});

/** Once the house is reviewing or has approved the group, only the brief may change. */
export const update = mutation({
  args: {
    groupId: v.id("atelierGroups"),
    name: v.optional(v.string()),
    eventDate: v.optional(v.union(v.number(), v.null())),
    occasion: v.optional(vOccasion),
    brief: v.optional(v.string()),
    sharedSpec: v.optional(vSuitSpec),
    permittedIndividual: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { groupId, ...patch }) => {
    const organizer = await requireUser(ctx);
    await updateGroup(ctx, organizer, groupId, patch);
    return null;
  },
});

/** Invites one person by name. The token is the invitation; the organizer passes it on themselves. */
export const invite = mutation({
  args: { groupId: v.id("atelierGroups"), name: v.string(), email: v.optional(v.string()) },
  returns: v.object({ participantId: v.id("atelierGroupParticipants"), inviteToken: v.string() }),
  handler: async (ctx, { groupId, name, email }) => {
    const organizer = await requireUser(ctx);
    return inviteParticipant(ctx, organizer, groupId, { name, email });
  },
});

/** The organizer's view. Null when the group is not theirs, so a foreign id reads as "no such group". */
export const get = query({
  args: { groupId: v.id("atelierGroups") },
  returns: v.union(vGroupView, v.null()),
  handler: async (ctx, { groupId }) => {
    const organizer = await requireUser(ctx);
    const group = await ctx.db.get(groupId);
    if (!group || group.organizerUserId !== organizer._id) return null;
    return groupView(ctx, group);
  },
});

export const listMine = query({
  args: {},
  returns: v.array(vGroupSummary),
  handler: async (ctx) => {
    const organizer = await requireUser(ctx);
    return listGroupsForOrganizer(ctx, organizer);
  },
});

/** Marks a participant declined. Their own design, if they made one, stays theirs. */
export const removeParticipant = mutation({
  args: { participantId: v.id("atelierGroupParticipants") },
  returns: v.null(),
  handler: async (ctx, { participantId }) => {
    const organizer = await requireUser(ctx);
    await removeGroupParticipant(ctx, organizer, participantId);
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Participant (a guest may join; a fit profile later needs an account)
// ------------------------------------------------------------------------------------------------

/** Public by token. Null when the invitation never existed, was declined or the group has closed. */
export const getInvite = query({
  args: { token: v.string() },
  returns: v.union(vInviteView, v.null()),
  handler: async (ctx, { token }) => inviteByToken(ctx, token),
});

/** Accepts the invitation: a private design is created from the shared brief and handed to the actor. */
export const join = mutation({
  args: { ...ownerArgs, token: v.string() },
  returns: v.object({ draftId: v.id("atelierDrafts") }),
  handler: async (ctx, { guestKey, token }) => {
    const actor = await requireActor(ctx, guestKey);
    return joinGroup(ctx, actor, token);
  },
});

/** The participant's standing for the design an invitation created; null for a design outside a group. */
export const myParticipation = query({
  args: { ...ownerArgs, draftId: v.id("atelierDrafts") },
  returns: v.union(vParticipationView, v.null()),
  handler: async (ctx, { guestKey, draftId }) => {
    const { draft } = await requireDraftAccess(ctx, draftId, guestKey);
    return participationForDraft(ctx, draft);
  },
});

/** What the organizer may learn: style status, fit status. Both default to off. */
export const setConsent = mutation({
  args: { ...ownerArgs, participantId: v.id("atelierGroupParticipants"), consent: vParticipantConsent },
  returns: v.null(),
  handler: async (ctx, { guestKey, participantId, consent }) => {
    const actor = await resolveActor(ctx, guestKey);
    await setParticipantConsent(ctx, actor, participantId, consent);
    return null;
  },
});

/** Declines or withdraws. The design stays with the participant and leaves the group. */
export const leave = mutation({
  args: { ...ownerArgs, participantId: v.id("atelierGroupParticipants") },
  returns: v.null(),
  handler: async (ctx, { guestKey, participantId }) => {
    const actor = await resolveActor(ctx, guestKey);
    await leaveGroup(ctx, actor, participantId);
    return null;
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (concierge)
// ------------------------------------------------------------------------------------------------

/** Records the house's review of the group's compatibility and readiness; every change is audited. */
export const review = mutation({
  args: { groupId: v.id("atelierGroups"), note: v.string(), status: vGroupReviewStatus },
  returns: vGroupReviewView,
  handler: async (ctx, { groupId, note, status }) => {
    const staff = await requireStaff(ctx, "concierge");
    return reviewGroup(ctx, staff, groupId, { note, status });
  },
});

export const listForReview = query({
  args: {},
  returns: v.array(vGroupReviewView),
  handler: async (ctx) => {
    await requireStaff(ctx, "concierge");
    return listGroupsForReview(ctx);
  },
});

/** A concierge's read of one group, with the same isolation the organizer gets. */
export const getForReview = query({
  args: { groupId: v.id("atelierGroups") },
  returns: v.union(vGroupReviewView, v.null()),
  handler: async (ctx, { groupId }) => {
    await requireStaff(ctx, "concierge");
    const group = await ctx.db.get(groupId);
    return group ? reviewView(ctx, group) : null;
  },
});
