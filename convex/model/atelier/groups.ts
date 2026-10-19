import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, clientDisplayName, isOwner, ownerFieldsFor, randomToken, type Actor } from "../../atelier/access";
import type {
  GroupParticipantView,
  GroupReviewStatus,
  GroupReviewView,
  GroupSummary,
  GroupView,
  InviteView,
  ParticipationView,
  PermittedIndividualPath,
} from "../../atelier/groups";
import { appError } from "../../lib/errors";
import {
  ATELIER_LIMITS,
  GROUP_STATUS_LABELS,
  isStudioStep,
  OCCASION_LABELS,
  PARTICIPANT_STATUS_LABELS,
  type GroupStatus,
  type Occasion,
  type ParticipantStatus,
} from "../../shared/atelier/enums";
import { GROUP_TRANSITIONS } from "../../shared/atelier/transitions";
import { completedStepsFor, describeSpec, validateSpec, type SuitSpec } from "../../shared/atelier/spec";
import { clothSummary, ensureCatalogueSeeded, getEntry, specNames } from "./catalogue";
import { cloneSpec, DRAFT_NAME_MAX } from "./drafts";
import { queueNotification } from "./notifications";

type Ctx = QueryCtx | MutationCtx;
type Group = Doc<"atelierGroups">;
type Participant = Doc<"atelierGroupParticipants">;
type User = Doc<"users">;
type Consent = Participant["consent"];

/**
 * Group commissions (contract §5.12; journey C28, screen S35). The organizer owns the brief: a shared
 * design, the details each participant may decide for themselves, and the list of names. Each
 * participant owns their design, their measurements and their photographs; the organizer learns only
 * what the participant has consented to share, and then only as a status, never as data.
 *
 *   draft ──▶ inviting ──▶ in_review ──▶ approved ──▶ closed
 *
 * `inviting` is reached by the first invitation; `in_review`, `approved` and `closed` are the house's
 * words, written by a concierge. Nothing in this module places an order or promises a fit.
 */

/** The spec fields a participant may set for themselves. Everything else follows the shared design. */
export const PERMITTED_INDIVIDUAL_PATHS = [
  "jacket.vents",
  "jacket.pockets",
  "jacket.ticketPocket",
  "jacket.sleeveButtons",
  "jacket.workingCuffs",
  "trousers.pleats",
  "trousers.hem",
  "trousers.waistband",
  "trousers.fit",
  "monogram",
  "liningCode",
] as const;

export function isPermittedIndividualPath(value: string): value is PermittedIndividualPath {
  return (PERMITTED_INDIVIDUAL_PATHS as readonly string[]).includes(value);
}

export { GROUP_STATUS_LABELS };

export { GROUP_TRANSITIONS };

export function canTransitionGroup(from: GroupStatus, to: GroupStatus): boolean {
  return GROUP_TRANSITIONS[from].includes(to);
}

/** While the house is reviewing or has approved the brief, the organizer may still write to it. */
const BRIEF_ONLY_STATUSES: readonly GroupStatus[] = ["in_review", "approved"];
/** Invitations go out until the house has approved the group. */
const INVITING_STATUSES: readonly GroupStatus[] = ["draft", "inviting", "in_review"];

export const GROUP_NAME_MAX = 80;
export const GROUP_BRIEF_MAX = 2000;
export const PARTICIPANT_NAME_MAX = 80;
export const REVIEW_NOTE_MAX = 2000;
/** Groups one organizer may hold at once. */
export const GROUPS_PER_ORGANIZER_MAX = 20;
/** Participant rows per group, declined ones included; the live cap is ATELIER_LIMITS.groupMaxParticipants. */
const PARTICIPANTS_READ_MAX = 100;
/** Fit profile versions read to find an approved one; a client holds a handful. */
const FIT_HISTORY_MAX = 20;
/** Groups the review desk lists: drafts nobody was invited to and closed groups are not the house's business. */
const REVIEW_QUEUE_STATUSES: readonly GroupStatus[] = ["inviting", "in_review", "approved"];
/** Groups of one status the review desk reads in one go, latest first. */
const REVIEW_READ_MAX = 200;
const DAY_MS = 86_400_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------------------------------------

/** Unknown paths are refused; duplicates collapse; the result keeps the allow-list's order. */
export function normalizePermittedIndividual(paths: readonly string[]): PermittedIndividualPath[] {
  for (const path of paths) {
    if (!isPermittedIndividualPath(path)) {
      throw appError("INVALID_INPUT", "That detail cannot be left to each participant.", { path });
    }
  }
  return PERMITTED_INDIVIDUAL_PATHS.filter((path) => paths.includes(path));
}

/** The shared design may leave the cloth open (each participant chooses); every other rule applies. */
export function validateSharedSpec(spec: SuitSpec): string[] {
  return validateSpec({ ...spec, clothCode: spec.clothCode ?? "shared-cloth-pending" });
}

function requireValidSharedSpec(spec: SuitSpec): SuitSpec {
  const errors = validateSharedSpec(spec);
  if (errors.length > 0) throw appError("INVALID_INPUT", errors[0], { errors });
  return cloneSpec(spec);
}

async function requireOfferedCloth(ctx: Ctx, clothCode: string | null): Promise<void> {
  if (!clothCode) return;
  const cloth = await getEntry(ctx, "cloth", clothCode);
  if (!cloth) throw appError("INVALID_INPUT", "That cloth is not in the house's range.", { clothCode });
  if (cloth.status !== "approved") {
    throw appError("INVALID_INPUT", `${cloth.name} is no longer offered. Choose another cloth for the group.`, {
      clothCode,
    });
  }
}

function normalizeText(value: string, what: string, max: number, required: boolean): string {
  const text = value.trim();
  if (required && text.length === 0) throw appError("INVALID_INPUT", `Give the ${what} a name.`);
  if (text.length > max) throw appError("INVALID_INPUT", `Keep the ${what} to ${max} characters.`, { max });
  return text;
}

function normalizeEventDate(eventDate: number | null | undefined, now: number): number | undefined {
  if (eventDate === null || eventDate === undefined) return undefined;
  if (!Number.isFinite(eventDate)) throw appError("INVALID_INPUT", "Choose a date for the event.");
  if (eventDate < now - DAY_MS) throw appError("INVALID_INPUT", "The event date has passed.");
  return eventDate;
}

function normalizeEmail(email: string | undefined): string | undefined {
  if (email === undefined) return undefined;
  const address = email.trim().toLowerCase();
  if (address.length === 0) return undefined;
  if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
    throw appError("INVALID_INPUT", "That email address does not look right.");
  }
  return address;
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

/** The group when the user organizes it, else NOT_FOUND: a foreign id reads as "no such group". */
export async function requireOrganizerGroup(ctx: Ctx, groupId: Id<"atelierGroups">, organizer: User): Promise<Group> {
  const group = await ctx.db.get(groupId);
  if (!group || group.organizerUserId !== organizer._id) throw appError("NOT_FOUND", "That group doesn't exist.");
  return group;
}

export async function listParticipants(ctx: Ctx, groupId: Id<"atelierGroups">): Promise<Participant[]> {
  return ctx.db
    .query("atelierGroupParticipants")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .take(PARTICIPANTS_READ_MAX);
}

export async function participantByToken(ctx: Ctx, token: string): Promise<Participant | null> {
  if (token.length === 0) return null;
  return ctx.db
    .query("atelierGroupParticipants")
    .withIndex("by_inviteToken", (q) => q.eq("inviteToken", token))
    .unique();
}

export async function listGroupsOf(ctx: Ctx, organizerUserId: Id<"users">): Promise<Group[]> {
  return ctx.db
    .query("atelierGroups")
    .withIndex("by_organizer", (q) => q.eq("organizerUserId", organizerUserId))
    .order("desc")
    .take(GROUPS_PER_ORGANIZER_MAX);
}

/** Reads only the status column of the client's fit history. Measurements never leave this function. */
async function hasApprovedFitProfile(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const history = await ctx.db
    .query("atelierFitProfiles")
    .withIndex("by_user_version", (q) => q.eq("userId", userId))
    .order("desc")
    .take(FIT_HISTORY_MAX);
  return history.some((profile) => profile.status === "approved");
}

/**
 * The status a participant is shown at. `declined` and `ordered` are recorded facts; the readiness
 * steps between are derived from what the participant consented to share, so they can never be
 * claimed without consent.
 */
export function effectiveStatus(
  stored: ParticipantStatus,
  readiness: { designReady: boolean; fitReady: boolean },
): ParticipantStatus {
  if (stored === "declined" || stored === "ordered" || stored === "invited") return stored;
  if (readiness.designReady && readiness.fitReady) return "fit_ready";
  if (readiness.designReady) return "design_ready";
  return "joined";
}

export async function participantView(ctx: Ctx, participant: Participant): Promise<GroupParticipantView> {
  const declined = participant.status === "declined";
  const hasDesign = !declined && participant.draftId !== undefined;
  const { shareStyleStatus, shareFitStatus } = participant.consent;
  // A guest who joined and later linked the design to an account has a row with no account; the design names it.
  const readDraft = hasDesign && (shareStyleStatus || (shareFitStatus && !participant.userId));
  const draft = readDraft && participant.draftId ? await ctx.db.get(participant.draftId) : null;
  const designReady =
    shareStyleStatus && draft !== null && draft.status !== "archived" && draft.spec.clothCode !== null;
  const fitUserId = participant.userId ?? (draft?.groupId === participant.groupId ? draft.userId : undefined);
  const fitReady =
    !declined && shareFitStatus && fitUserId !== undefined && (await hasApprovedFitProfile(ctx, fitUserId));
  const status = effectiveStatus(participant.status, { designReady, fitReady });
  return {
    participantId: participant._id,
    name: participant.name,
    status,
    statusLabel: PARTICIPANT_STATUS_LABELS[status],
    consent: participant.consent,
    hasDesign,
    designReady,
    fitReady,
    invitedAt: participant.createdAt,
    joinedAt: participant.joinedAt,
  };
}

async function participantViews(ctx: Ctx, groupId: Id<"atelierGroups">): Promise<GroupParticipantView[]> {
  const participants = await listParticipants(ctx, groupId);
  return Promise.all(participants.map((participant) => participantView(ctx, participant)));
}

export async function groupView(ctx: Ctx, group: Group): Promise<GroupView> {
  const [participants, names, cloth] = await Promise.all([
    participantViews(ctx, group._id),
    specNames(ctx, group.sharedSpec),
    clothSummary(ctx, group.sharedSpec.clothCode),
  ]);
  return {
    _id: group._id,
    name: group.name,
    occasion: group.occasion,
    occasionLabel: OCCASION_LABELS[group.occasion],
    eventDate: group.eventDate,
    brief: group.brief,
    sharedSpec: group.sharedSpec,
    sharedLines: describeSpec(group.sharedSpec, names),
    cloth,
    permittedIndividual: group.permittedIndividual.filter(isPermittedIndividualPath),
    status: group.status,
    statusLabel: GROUP_STATUS_LABELS[group.status],
    staffReviewNote: group.staffReviewNote,
    participants,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export async function groupSummary(ctx: Ctx, group: Group): Promise<GroupSummary> {
  const participants = await listParticipants(ctx, group._id);
  const live = participants.filter((participant) => participant.status !== "declined");
  return {
    _id: group._id,
    name: group.name,
    occasion: group.occasion,
    occasionLabel: OCCASION_LABELS[group.occasion],
    eventDate: group.eventDate,
    status: group.status,
    statusLabel: GROUP_STATUS_LABELS[group.status],
    participantCount: live.length,
    joinedCount: live.filter((participant) => participant.draftId !== undefined).length,
    updatedAt: group.updatedAt,
  };
}

export async function listGroupsForOrganizer(ctx: Ctx, organizer: User): Promise<GroupSummary[]> {
  const groups = await listGroupsOf(ctx, organizer._id);
  return Promise.all(groups.map((group) => groupSummary(ctx, group)));
}

function firstNameOf(user: User | null): string {
  const first = user?.name?.trim().split(/\s+/)[0];
  return first || "The organizer";
}

/** The invitee's view. Null for an unknown, declined or closed invitation: nothing to join. */
export async function inviteByToken(ctx: Ctx, token: string): Promise<InviteView | null> {
  const participant = await participantByToken(ctx, token);
  if (!participant || participant.status === "declined") return null;
  const group = await ctx.db.get(participant.groupId);
  if (!group || group.status === "closed") return null;
  const [organizer, names, cloth] = await Promise.all([
    ctx.db.get(group.organizerUserId),
    specNames(ctx, group.sharedSpec),
    clothSummary(ctx, group.sharedSpec.clothCode),
  ]);
  return {
    groupName: group.name,
    organizerFirstName: firstNameOf(organizer),
    occasion: group.occasion,
    occasionLabel: OCCASION_LABELS[group.occasion],
    eventDate: group.eventDate,
    sharedLines: describeSpec(group.sharedSpec, names),
    cloth,
    permittedIndividual: group.permittedIndividual.filter(isPermittedIndividualPath),
    participantName: participant.name,
  };
}

/** The participant row behind one of the actor's own designs, or null when the design is not in a group. */
export async function participationForDraft(ctx: Ctx, draft: Doc<"atelierDrafts">): Promise<ParticipationView | null> {
  if (!draft.groupId) return null;
  const participants = await listParticipants(ctx, draft.groupId);
  const participant = participants.find((row) => row.draftId === draft._id);
  const group = await ctx.db.get(draft.groupId);
  if (!participant || !group) return null;
  const organizer = await ctx.db.get(group.organizerUserId);
  return {
    participantId: participant._id,
    groupName: group.name,
    organizerFirstName: firstNameOf(organizer),
    status: participant.status,
    statusLabel: PARTICIPANT_STATUS_LABELS[participant.status],
    consent: participant.consent,
    permittedIndividual: group.permittedIndividual.filter(isPermittedIndividualPath),
    groupStatus: group.status,
    groupStatusLabel: GROUP_STATUS_LABELS[group.status],
  };
}

// ------------------------------------------------------------------------------------------------
// Organizer writes
// ------------------------------------------------------------------------------------------------

export type CreateGroupInput = {
  name: string;
  eventDate?: number;
  occasion: Occasion;
  brief: string;
  sharedSpec: SuitSpec;
  permittedIndividual: readonly string[];
};

export async function createGroup(
  ctx: MutationCtx,
  organizer: User,
  input: CreateGroupInput,
  now: number = Date.now(),
): Promise<Id<"atelierGroups">> {
  const existing = await listGroupsOf(ctx, organizer._id);
  if (existing.filter((group) => group.status !== "closed").length >= GROUPS_PER_ORGANIZER_MAX) {
    throw appError(
      "INVALID_INPUT",
      `You already organize ${GROUPS_PER_ORGANIZER_MAX} groups. Ask your concierge to close one.`,
      {
        max: GROUPS_PER_ORGANIZER_MAX,
      },
    );
  }
  const name = normalizeText(input.name, "group", GROUP_NAME_MAX, true);
  const brief = normalizeText(input.brief, "brief", GROUP_BRIEF_MAX, false);
  const eventDate = normalizeEventDate(input.eventDate, now);
  const sharedSpec = requireValidSharedSpec(input.sharedSpec);
  await requireOfferedCloth(ctx, sharedSpec.clothCode);
  const permittedIndividual = normalizePermittedIndividual(input.permittedIndividual);
  const groupId = await ctx.db.insert("atelierGroups", {
    organizerUserId: organizer._id,
    name,
    eventDate,
    occasion: input.occasion,
    brief,
    sharedSpec,
    permittedIndividual,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  await audit(ctx, { actor: organizer, action: "group.create", targetTable: "atelierGroups", targetId: groupId }, now);
  return groupId;
}

export type UpdateGroupInput = {
  name?: string;
  eventDate?: number | null;
  occasion?: Occasion;
  brief?: string;
  sharedSpec?: SuitSpec;
  permittedIndividual?: readonly string[];
};

/**
 * Edits the brief. Once the house is reviewing or has approved the group only the written brief may
 * change, because the shared design and the permitted details are what was reviewed. A closed group
 * does not change.
 */
export async function updateGroup(
  ctx: MutationCtx,
  organizer: User,
  groupId: Id<"atelierGroups">,
  input: UpdateGroupInput,
  now: number = Date.now(),
): Promise<void> {
  const group = await requireOrganizerGroup(ctx, groupId, organizer);
  if (group.status === "closed") {
    throw appError("INVALID_STATE", "This group has been closed by the house.", { status: group.status });
  }
  const changesDesign =
    input.name !== undefined ||
    input.eventDate !== undefined ||
    input.occasion !== undefined ||
    input.sharedSpec !== undefined ||
    input.permittedIndividual !== undefined;
  if (changesDesign && BRIEF_ONLY_STATUSES.includes(group.status)) {
    throw appError(
      "INVALID_STATE",
      `The house is ${group.status === "approved" ? "working from" : "reviewing"} this group's design. Add to the brief, or ask your concierge to reopen it.`,
      { status: group.status },
    );
  }
  const patch: Partial<Group> = {};
  if (input.name !== undefined) patch.name = normalizeText(input.name, "group", GROUP_NAME_MAX, true);
  if (input.brief !== undefined) patch.brief = normalizeText(input.brief, "brief", GROUP_BRIEF_MAX, false);
  if (input.eventDate !== undefined) patch.eventDate = normalizeEventDate(input.eventDate, now);
  if (input.occasion !== undefined) patch.occasion = input.occasion;
  if (input.sharedSpec !== undefined) {
    patch.sharedSpec = requireValidSharedSpec(input.sharedSpec);
    await requireOfferedCloth(ctx, patch.sharedSpec.clothCode);
  }
  if (input.permittedIndividual !== undefined) {
    patch.permittedIndividual = normalizePermittedIndividual(input.permittedIndividual);
  }
  if (Object.keys(patch).length === 0 && input.eventDate === undefined) return;
  await ctx.db.patch(group._id, { ...patch, updatedAt: now });
  await audit(
    ctx,
    {
      actor: organizer,
      action: "group.update",
      targetTable: "atelierGroups",
      targetId: group._id,
      meta: { fields: Object.keys(patch) },
    },
    now,
  );
}

export type InviteInput = { name: string; email?: string };

/**
 * Adds one person to the group. The token is the invitation and is returned to the organizer, who
 * passes it on; when an email is given a notification record is queued (recorded, not sent). The first
 * invitation moves the group from `draft` to `inviting`.
 */
export async function inviteParticipant(
  ctx: MutationCtx,
  organizer: User,
  groupId: Id<"atelierGroups">,
  input: InviteInput,
  now: number = Date.now(),
): Promise<{ participantId: Id<"atelierGroupParticipants">; inviteToken: string }> {
  const group = await requireOrganizerGroup(ctx, groupId, organizer);
  if (!INVITING_STATUSES.includes(group.status)) {
    throw appError(
      "INVALID_STATE",
      group.status === "approved"
        ? "The house has approved this group. Ask your concierge to add someone."
        : "This group has been closed by the house.",
      { status: group.status },
    );
  }
  const name = normalizeText(input.name, "participant", PARTICIPANT_NAME_MAX, true);
  const email = normalizeEmail(input.email);
  const participants = await listParticipants(ctx, group._id);
  const live = participants.filter((participant) => participant.status !== "declined");
  if (live.length >= ATELIER_LIMITS.groupMaxParticipants) {
    throw appError(
      "INVALID_INPUT",
      `A group holds up to ${ATELIER_LIMITS.groupMaxParticipants} participants. Ask your concierge about a larger party.`,
      { max: ATELIER_LIMITS.groupMaxParticipants },
    );
  }
  const inviteToken = randomToken();
  const participantId = await ctx.db.insert("atelierGroupParticipants", {
    groupId: group._id,
    inviteToken,
    name,
    email,
    status: "invited",
    consent: { shareStyleStatus: false, shareFitStatus: false },
    createdAt: now,
  });
  await ctx.db.patch(group._id, {
    ...(group.status === "draft" ? { status: "inviting" as const } : {}),
    updatedAt: now,
  });
  if (email) {
    await queueNotification(
      ctx,
      {
        owner: { userId: organizer._id },
        channel: "email",
        to: email,
        subject: `${firstNameOf(organizer)} has invited you to design with ${group.name}`,
        body: `${firstNameOf(organizer)} is coordinating ${group.name} with Nyoni Couture and has asked you to join. Open your invitation at /atelier/groups/join/${inviteToken} to see the shared design and begin your own.`,
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor: organizer,
      action: "group.invite",
      targetTable: "atelierGroupParticipants",
      targetId: participantId,
      meta: { groupId: group._id, notified: email !== undefined },
    },
    now,
  );
  return { participantId, inviteToken };
}

/** Marks a participant declined. Someone who has ordered is part of the house's records and stays. */
export async function removeParticipant(
  ctx: MutationCtx,
  organizer: User,
  participantId: Id<"atelierGroupParticipants">,
  now: number = Date.now(),
): Promise<void> {
  const participant = await ctx.db.get(participantId);
  if (!participant) throw appError("NOT_FOUND", "That participant doesn't exist.");
  const group = await requireOrganizerGroup(ctx, participant.groupId, organizer).catch(() => null);
  if (!group) throw appError("NOT_FOUND", "That participant doesn't exist.");
  if (participant.status === "declined") return;
  if (participant.status === "ordered") {
    throw appError("INVALID_STATE", `${participant.name} has placed a commission. Speak to your concierge.`, {
      status: participant.status,
    });
  }
  await ctx.db.patch(participant._id, { status: "declined" });
  await ctx.db.patch(group._id, { updatedAt: now });
  await audit(
    ctx,
    {
      actor: organizer,
      action: "group.participant.remove",
      targetTable: "atelierGroupParticipants",
      targetId: participant._id,
      meta: { groupId: group._id, from: participant.status },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Participant writes
// ------------------------------------------------------------------------------------------------

const ALREADY_ACCEPTED =
  "This invitation has already been accepted. Open the design from the browser or account that accepted it, or ask the organizer for a new invitation.";

/**
 * Accepts an invitation: a private design is created from the shared brief and handed to the actor.
 * Accepting twice from the same browser or account returns the same design; from anywhere else it is
 * refused, because the design belongs to whoever accepted first.
 */
export async function joinGroup(
  ctx: MutationCtx,
  actor: Actor,
  token: string,
  now: number = Date.now(),
): Promise<{ draftId: Id<"atelierDrafts"> }> {
  const owner = ownerFieldsFor(actor);
  const participant = await participantByToken(ctx, token);
  if (!participant || participant.status === "declined") {
    throw appError("NOT_FOUND", "This invitation is no longer open. Ask the organizer for a new one.");
  }
  const group = await ctx.db.get(participant.groupId);
  if (!group) throw appError("NOT_FOUND", "This invitation is no longer open. Ask the organizer for a new one.");
  if (group.status === "closed") {
    throw appError("INVALID_STATE", "This group has been closed by the house.", { status: group.status });
  }
  if (participant.draftId) {
    const draft = await ctx.db.get(participant.draftId);
    if (draft && isOwner(draft, actor)) return { draftId: draft._id };
    throw appError("INVALID_STATE", ALREADY_ACCEPTED, { status: participant.status });
  }
  if (participant.userId && participant.userId !== actor.user?._id) {
    throw appError("INVALID_STATE", ALREADY_ACCEPTED, { status: participant.status });
  }
  const spec = cloneSpec(group.sharedSpec);
  const catalogueVersion = await ensureCatalogueSeeded(ctx, now);
  const draftId = await ctx.db.insert("atelierDrafts", {
    ...owner,
    name: `${group.name} — ${participant.name}`.slice(0, DRAFT_NAME_MAX),
    occasion: group.occasion,
    eventDate: group.eventDate,
    spec,
    shortlist: [],
    stage: spec.clothCode ? "style" : "cloth",
    completedSteps: completedStepsFor(spec, { occasionSet: true, previewDone: false, fitRouteSet: false }).filter(
      isStudioStep,
    ),
    catalogueVersion,
    revision: 1,
    status: "draft",
    groupId: group._id,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
  });
  await ctx.db.patch(participant._id, {
    ...(actor.user ? { userId: actor.user._id } : {}),
    draftId,
    status: "joined",
    joinedAt: now,
  });
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "group.join",
      targetTable: "atelierGroupParticipants",
      targetId: participant._id,
      meta: { groupId: group._id },
    },
    now,
  );
  return { draftId };
}

/**
 * A participant row is theirs when it names their account or when the design it created is theirs
 * (a guest's only proof). Anything else reads as "no such participant".
 */
export async function requireParticipantAccess(
  ctx: Ctx,
  participantId: Id<"atelierGroupParticipants">,
  actor: Actor,
): Promise<{ participant: Participant; group: Group }> {
  const participant = await ctx.db.get(participantId);
  const notFound = () => appError("NOT_FOUND", "That participant doesn't exist.");
  if (!participant) throw notFound();
  let owned = actor.user !== null && participant.userId === actor.user._id;
  if (!owned && participant.draftId) {
    const draft = await ctx.db.get(participant.draftId);
    owned = draft !== null && isOwner(draft, actor);
  }
  if (!owned) throw notFound();
  const group = await ctx.db.get(participant.groupId);
  if (!group) throw notFound();
  return { participant, group };
}

export async function setParticipantConsent(
  ctx: MutationCtx,
  actor: Actor,
  participantId: Id<"atelierGroupParticipants">,
  consent: Consent,
  now: number = Date.now(),
): Promise<void> {
  const { participant, group } = await requireParticipantAccess(ctx, participantId, actor);
  if (participant.status === "declined") {
    throw appError("INVALID_STATE", "You have left this group; there is nothing to share.", {
      status: participant.status,
    });
  }
  const next: Consent = { shareStyleStatus: consent.shareStyleStatus, shareFitStatus: consent.shareFitStatus };
  if (
    next.shareStyleStatus === participant.consent.shareStyleStatus &&
    next.shareFitStatus === participant.consent.shareFitStatus
  )
    return;
  await ctx.db.patch(participant._id, { consent: next });
  await ctx.db.patch(group._id, { updatedAt: now });
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "group.consent",
      targetTable: "atelierGroupParticipants",
      targetId: participant._id,
      meta: { groupId: group._id, ...next },
    },
    now,
  );
}

/** Leaves the group: the participant is marked declined and their design, if any, leaves the group. */
export async function leaveGroup(
  ctx: MutationCtx,
  actor: Actor,
  participantId: Id<"atelierGroupParticipants">,
  now: number = Date.now(),
): Promise<void> {
  const { participant, group } = await requireParticipantAccess(ctx, participantId, actor);
  if (participant.status === "declined") return;
  if (participant.status === "ordered") {
    throw appError(
      "INVALID_STATE",
      "Your commission has been placed with the house. Speak to your concierge about it.",
      {
        status: participant.status,
      },
    );
  }
  await ctx.db.patch(participant._id, {
    status: "declined",
    consent: { shareStyleStatus: false, shareFitStatus: false },
  });
  if (participant.draftId) {
    const draft = await ctx.db.get(participant.draftId);
    if (draft && isOwner(draft, actor) && draft.groupId === group._id) {
      await ctx.db.patch(draft._id, { groupId: undefined, updatedAt: now });
    }
  }
  await ctx.db.patch(group._id, { updatedAt: now });
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "group.leave",
      targetTable: "atelierGroupParticipants",
      targetId: participant._id,
      meta: { groupId: group._id, from: participant.status },
    },
    now,
  );
}

/**
 * Records that a participant's design has become a commission, called where the order is created. From
 * then on neither the organizer nor the participant can take them out of the group. A design outside a
 * group, or one whose participant has left or was removed, changes nothing. Returns the row it marked.
 */
export async function markParticipantOrdered(
  ctx: MutationCtx,
  draftId: Id<"atelierDrafts">,
  now: number = Date.now(),
): Promise<Id<"atelierGroupParticipants"> | null> {
  const draft = await ctx.db.get(draftId);
  if (!draft?.groupId) return null;
  const participants = await listParticipants(ctx, draft.groupId);
  const participant = participants.find((row) => row.draftId === draft._id);
  if (!participant || participant.status === "declined") return null;
  if (participant.status === "ordered") return participant._id;
  await ctx.db.patch(participant._id, { status: "ordered" });
  await ctx.db.patch(participant.groupId, { updatedAt: now });
  await audit(
    ctx,
    {
      actor: null,
      action: "group.participant.ordered",
      targetTable: "atelierGroupParticipants",
      targetId: participant._id,
      meta: { groupId: participant.groupId, draftId: draft._id, from: participant.status },
    },
    now,
  );
  return participant._id;
}

// ------------------------------------------------------------------------------------------------
// Staff (concierge)
// ------------------------------------------------------------------------------------------------

export async function reviewView(ctx: Ctx, group: Group): Promise<GroupReviewView> {
  const [organizer, participants, names] = await Promise.all([
    ctx.db.get(group.organizerUserId),
    participantViews(ctx, group._id),
    specNames(ctx, group.sharedSpec),
  ]);
  const live = participants.filter((participant) => participant.status !== "declined");
  return {
    _id: group._id,
    name: group.name,
    organizerName: clientDisplayName(organizer),
    occasion: group.occasion,
    occasionLabel: OCCASION_LABELS[group.occasion],
    eventDate: group.eventDate,
    brief: group.brief,
    sharedLines: describeSpec(group.sharedSpec, names),
    status: group.status,
    statusLabel: GROUP_STATUS_LABELS[group.status],
    staffReviewNote: group.staffReviewNote,
    participantCount: live.length,
    joinedCount: live.filter((participant) => participant.hasDesign).length,
    designReadyCount: live.filter((participant) => participant.designReady).length,
    fitReadyCount: live.filter((participant) => participant.fitReady).length,
    participants,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export type ReviewInput = { note: string; status: GroupReviewStatus };

/** The house's word on the group. Only transitions in GROUP_TRANSITIONS are accepted; each is audited. */
export async function reviewGroup(
  ctx: MutationCtx,
  staff: User,
  groupId: Id<"atelierGroups">,
  input: ReviewInput,
  now: number = Date.now(),
): Promise<GroupReviewView> {
  const group = await ctx.db.get(groupId);
  if (!group) throw appError("NOT_FOUND", "That group doesn't exist.");
  if (!canTransitionGroup(group.status, input.status)) {
    throw appError(
      "INVALID_STATE",
      `A group that is ${GROUP_STATUS_LABELS[group.status].toLowerCase()} cannot be marked ${GROUP_STATUS_LABELS[input.status].toLowerCase()}.`,
      { from: group.status, to: input.status },
    );
  }
  const note = normalizeText(input.note, "review note", REVIEW_NOTE_MAX, false);
  await ctx.db.patch(group._id, {
    status: input.status,
    ...(note ? { staffReviewNote: note } : {}),
    updatedAt: now,
  });
  await audit(
    ctx,
    {
      actor: staff,
      action: "group.review",
      targetTable: "atelierGroups",
      targetId: group._id,
      meta: { from: group.status, to: input.status, noted: note.length > 0 },
    },
    now,
  );
  const updated = await ctx.db.get(group._id);
  return reviewView(ctx, updated ?? { ...group, status: input.status, updatedAt: now });
}

/** Groups awaiting or under the house's eye: everything an organizer has begun inviting to, latest first. */
export async function listGroupsForReview(ctx: Ctx): Promise<GroupReviewView[]> {
  const byStatus = await Promise.all(
    REVIEW_QUEUE_STATUSES.map((status) =>
      ctx.db
        .query("atelierGroups")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(REVIEW_READ_MAX),
    ),
  );
  const open = byStatus.flat().sort((a, b) => b.updatedAt - a.updatedAt);
  return Promise.all(open.map((group) => reviewView(ctx, group)));
}
