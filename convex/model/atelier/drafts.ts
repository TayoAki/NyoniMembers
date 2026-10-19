import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, isOwner, ownerFieldsFor, type Actor } from "../../atelier/access";
import type { CommitResult, DraftExport, DraftSummary, DraftView } from "../../atelier/drafts";
import type { ClothSummary, DraftWarning } from "../../atelier/views";
import { appError } from "../../lib/errors";
import {
  ATELIER_LIMITS,
  isStudioStep,
  type FitRoute,
  type Occasion,
  type StudioStep,
} from "../../shared/atelier/enums";
import { lookByKey } from "../../shared/atelier/looks";
import { MONOGRAM_RULES, normalizeMonogramText } from "../../shared/atelier/materials";
import { eventReadiness } from "../../shared/atelier/policy";
import {
  applyChange,
  completedStepsFor,
  DEFAULT_SPEC,
  describeSpec,
  specDifferences,
  specHash,
  specPathLabel,
  specSummary,
  type Monogram,
  type SpecPatch,
  type SuitSpec,
} from "../../shared/atelier/spec";
import { clothSummary, currentCatalogueVersion, ensureCatalogueSeeded, getEntry, specNames } from "./catalogue";

type Ctx = QueryCtx | MutationCtx;
type Draft = Doc<"atelierDrafts">;

/**
 * The working design (contract §5.2; journeys C01–C03, C05–C07, C12, C13, C15, C26). A draft is saved,
 * never submitted, by anything in this module: submission is the cases domain's `submit`, which freezes
 * a revision and moves the draft to `submitted`. Every write here refuses a draft that is no longer
 * `draft`, so a design the house is reviewing cannot change underneath it.
 */

export const DEFAULT_DRAFT_NAME = "Your suit";
export const DRAFT_NAME_MAX = 80;
export const SHARE_AUDIENCE_MAX = 80;

/** Rows moved by `linkDraft` per table; a guest browser holds at most a few of each. */
const LINK_BATCH = 200;

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

/** The draft when the actor owns it, else null: a foreign or unknown id reads as "no such design". */
export async function findAccessible(ctx: Ctx, draftId: Id<"atelierDrafts">, actor: Actor): Promise<Draft | null> {
  const draft = await ctx.db.get(draftId);
  if (!draft || !isOwner(draft, actor)) return null;
  return draft;
}

/** Drafts owned by the account, newest first, archived ones left out. */
export async function listForUser(ctx: Ctx, userId: Id<"users">): Promise<Draft[]> {
  return ctx.db
    .query("atelierDrafts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .filter((q) => q.neq(q.field("status"), "archived"))
    .take(ATELIER_LIMITS.draftsPerOwner);
}

/** Drafts this browser holds as a guest, newest first, archived ones left out. */
export async function listForGuest(ctx: Ctx, guestKey: string): Promise<Draft[]> {
  return ctx.db
    .query("atelierDrafts")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .order("desc")
    .filter((q) => q.neq(q.field("status"), "archived"))
    .take(ATELIER_LIMITS.draftsPerOwner);
}

/**
 * S15 / S16: the account's drafts and, when a signed-in client also carries a guest key, that browser's
 * guest drafts, flagged `linkable` so the link screen can offer each one.
 */
export async function listMine(ctx: Ctx, actor: Actor): Promise<DraftSummary[]> {
  const [own, guest] = await Promise.all([
    actor.user ? listForUser(ctx, actor.user._id) : Promise.resolve([]),
    actor.guestKey ? listForGuest(ctx, actor.guestKey) : Promise.resolve([]),
  ]);
  const rows = [...own, ...guest].sort((a, b) => b.updatedAt - a.updatedAt);
  return Promise.all(
    rows.map((draft) => toDraftSummary(ctx, draft, { linkable: actor.user !== null && draft.userId === undefined })),
  );
}

export async function toDraftSummary(ctx: Ctx, draft: Draft, flags: { linkable: boolean }): Promise<DraftSummary> {
  const cloth = await clothSummary(ctx, draft.spec.clothCode);
  return {
    _id: draft._id,
    name: draft.name,
    occasion: draft.occasion,
    eventDate: draft.eventDate,
    stage: draft.stage,
    status: draft.status,
    revision: draft.revision,
    summary: specSummary(draft.spec, cloth?.name ?? null),
    cloth,
    lookKey: draft.lookKey,
    sourceOrderId: draft.sourceOrderId,
    updatedAt: draft.updatedAt,
    savedAt: draft.lastSavedAt,
    ownedByAccount: draft.userId !== undefined,
    linkable: flags.linkable,
  };
}

export async function toDraftView(ctx: Ctx, draft: Draft, now: number): Promise<DraftView> {
  const hash = specHash(draft.spec);
  const [cloth, shortlistCloths, warnings, names, photo, job, profile] = await Promise.all([
    clothSummary(ctx, draft.spec.clothCode),
    Promise.all(draft.shortlist.map((code) => clothSummary(ctx, code))),
    revalidate(ctx, draft, now),
    specNames(ctx, draft.spec),
    draft.personPhotoId ? ctx.db.get(draft.personPhotoId) : Promise.resolve(null),
    draft.currentPreviewJobId ? ctx.db.get(draft.currentPreviewJobId) : Promise.resolve(null),
    draft.fitProfileId ? ctx.db.get(draft.fitProfileId) : Promise.resolve(null),
  ]);
  return {
    _id: draft._id,
    name: draft.name,
    occasion: draft.occasion,
    eventDate: draft.eventDate,
    intendedUse: draft.intendedUse,
    spec: draft.spec,
    shortlist: draft.shortlist,
    stage: draft.stage,
    completedSteps: draft.completedSteps,
    revision: draft.revision,
    specHash: hash,
    status: draft.status,
    catalogueVersion: draft.catalogueVersion,
    lookKey: draft.lookKey,
    sourceOrderId: draft.sourceOrderId,
    groupId: draft.groupId,
    cloth,
    shortlistCloths: shortlistCloths.filter((entry): entry is ClothSummary => entry !== null),
    warnings,
    hasPhoto: photo !== null && photo.status === "active",
    currentPreview: job
      ? { jobId: job._id, status: job.status, specHash: job.specHash, isCurrent: job.specHash === hash }
      : null,
    fitRoute: draft.fitRoute ?? null,
    fitProfile: profile ? { version: profile.version, status: profile.status } : null,
    lines: describeSpec(draft.spec, names),
    savedAt: draft.lastSavedAt,
    ownedByAccount: draft.userId !== undefined,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/** The printable record (C19 export): the same lines the review and the staff view read. */
export async function toDraftExport(ctx: Ctx, draft: Draft): Promise<DraftExport> {
  return {
    name: draft.name,
    spec: draft.spec,
    lines: describeSpec(draft.spec, await specNames(ctx, draft.spec)),
    revision: draft.revision,
    specHash: specHash(draft.spec),
    exportedAt: null,
  };
}

/**
 * What needs the client's attention before this design can be sent or quoted: a cloth the house has
 * withdrawn or run out of, a catalogue that moved since the draft was saved, an event date inside the
 * making time, a personal preview of an earlier design (C03, C12, C19, C26; contract §3 rule 7). Nothing
 * is replaced on the client's behalf.
 */
export async function revalidate(ctx: Ctx, draft: Draft, now: number): Promise<DraftWarning[]> {
  const warnings: DraftWarning[] = [];
  const [version, entry, job] = await Promise.all([
    currentCatalogueVersion(ctx),
    draft.spec.clothCode ? getEntry(ctx, "cloth", draft.spec.clothCode) : Promise.resolve(null),
    draft.currentPreviewJobId ? ctx.db.get(draft.currentPreviewJobId) : Promise.resolve(null),
  ]);
  if (draft.spec.clothCode) {
    if (!entry || entry.status === "withdrawn") {
      warnings.push({
        code: "cloth_withdrawn",
        message: `${entry?.name ?? draft.spec.clothCode} is no longer offered by the house. Choose another cloth before this design is sent for review.`,
      });
    } else if (!entry.inStock) {
      warnings.push({
        code: "cloth_out_of_stock",
        message: `${entry.name} is not in stock at the moment. Your concierge will confirm whether it can be sourced, or help you choose another cloth.`,
      });
    }
  }
  if (version !== draft.catalogueVersion) {
    warnings.push({
      code: "catalogue_changed",
      message:
        "The catalogue has changed since this design was last saved. Look over the cloth and details before sending it to the house.",
    });
  }
  const readiness = eventReadiness(draft.eventDate, now);
  if (readiness.state === "tight") warnings.push({ code: "event_tight", message: readiness.copy });
  if (readiness.state === "unlikely") warnings.push({ code: "event_unlikely", message: readiness.copy });
  if (job && job.status === "done" && job.specHash !== specHash(draft.spec)) {
    warnings.push({ code: "preview_stale", message: "Your personal preview shows a previous design." });
  }
  return warnings;
}

// ------------------------------------------------------------------------------------------------
// Create, duplicate, link
// ------------------------------------------------------------------------------------------------

export type CreateDraftInput = { lookKey?: string; occasion?: Occasion };

export async function createDraft(
  ctx: MutationCtx,
  actor: Actor,
  input: CreateDraftInput,
  now: number = Date.now(),
): Promise<Id<"atelierDrafts">> {
  const owner = ownerFieldsFor(actor);
  const catalogueVersion = await ensureCatalogueSeeded(ctx, now);
  await assertBelowDraftCap(ctx, actor);
  const look = input.lookKey ? lookByKey(input.lookKey) : undefined;
  if (input.lookKey && !look)
    throw appError("INVALID_INPUT", "That look is no longer offered. Start designing, or choose another.");
  const spec: SuitSpec = look ? cloneSpec(look.spec) : cloneSpec(DEFAULT_SPEC);
  const occasion = input.occasion;
  return ctx.db.insert("atelierDrafts", {
    ...owner,
    name: look ? look.name : DEFAULT_DRAFT_NAME,
    occasion,
    spec,
    shortlist: [],
    stage: look || occasion ? "cloth" : "occasion",
    completedSteps: stepsFor(spec, { occasionSet: occasion !== undefined, previewDone: false, fitRouteSet: false }),
    catalogueVersion,
    revision: 1,
    status: "draft",
    lookKey: look?.key,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
  });
}

/**
 * C26: a new draft from a proven design. The source draft and its order stay as they were; the copy
 * carries the source's catalogue version so `revalidate` says truthfully what has changed since.
 */
export async function duplicateDraft(
  ctx: MutationCtx,
  actor: Actor,
  source: Draft,
  sourceOrderId: Id<"atelierOrders"> | undefined,
  now: number = Date.now(),
): Promise<Id<"atelierDrafts">> {
  const owner = ownerFieldsFor(actor);
  if (sourceOrderId) {
    const order = await ctx.db.get(sourceOrderId);
    if (!order || !isOwner(order, actor)) throw appError("NOT_FOUND", "That commission doesn't exist.");
  }
  await assertBelowDraftCap(ctx, actor);
  const spec = cloneSpec(source.spec);
  const id = await ctx.db.insert("atelierDrafts", {
    ...owner,
    name: `${source.name} (again)`,
    occasion: source.occasion,
    eventDate: source.eventDate,
    intendedUse: source.intendedUse,
    spec,
    shortlist: [...source.shortlist],
    fitRoute: source.fitRoute,
    fitProfileId: source.fitProfileId,
    stage: "review",
    completedSteps: stepsFor(spec, {
      occasionSet: source.occasion !== undefined,
      previewDone: false,
      fitRouteSet: source.fitRoute !== undefined,
    }),
    catalogueVersion: source.catalogueVersion,
    revision: 1,
    status: "draft",
    lookKey: source.lookKey,
    sourceOrderId,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
  });
  await audit(
    ctx,
    {
      actor,
      action: "draft.duplicate",
      targetTable: "atelierDrafts",
      targetId: id,
      meta: { sourceDraftId: source._id, sourceOrderId: sourceOrderId ?? null },
    },
    now,
  );
  return id;
}

/**
 * C13: moves a guest draft, and everything that hangs off it, to the signed-in account. The guest key
 * must match the draft's own: a key alone never reaches another browser's work. Idempotent when the
 * draft already belongs to this account.
 */
export async function linkDraft(
  ctx: MutationCtx,
  user: Doc<"users">,
  draftId: Id<"atelierDrafts">,
  guestKey: string,
  now: number = Date.now(),
): Promise<void> {
  const draft = await ctx.db.get(draftId);
  if (!draft) throw appError("NOT_FOUND", "That design doesn't exist.");
  if (draft.userId === user._id && draft.guestKey === undefined) return;
  if (draft.userId !== undefined || draft.guestKey !== guestKey)
    throw appError("NOT_FOUND", "That design doesn't exist.");

  const claim = { userId: user._id, guestKey: undefined };
  await ctx.db.patch(draft._id, { ...claim, updatedAt: now, lastSavedAt: now });

  const photos = await ctx.db
    .query("atelierPersonPhotos")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .take(LINK_BATCH);
  for (const photo of photos) await ctx.db.patch(photo._id, claim);

  const jobs = await ctx.db
    .query("atelierPreviewJobs")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .filter((q) => q.eq(q.field("draftId"), draft._id))
    .take(LINK_BATCH);
  for (const job of jobs) await ctx.db.patch(job._id, claim);

  const cases = await ctx.db
    .query("atelierCases")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .filter((q) => q.eq(q.field("draftId"), draft._id))
    .take(LINK_BATCH);
  for (const row of cases) await ctx.db.patch(row._id, claim);

  const appointments = await ctx.db
    .query("atelierAppointments")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .filter((q) => q.eq(q.field("draftId"), draft._id))
    .take(LINK_BATCH);
  for (const row of appointments) await ctx.db.patch(row._id, claim);

  const orders = await ctx.db
    .query("atelierOrders")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .filter((q) => q.eq(q.field("draftId"), draft._id))
    .take(LINK_BATCH);
  const orderIds = new Set<Id<"atelierOrders">>(orders.map((order) => order._id));
  for (const order of orders) await ctx.db.patch(order._id, claim);

  const corrections = await ctx.db
    .query("atelierCorrections")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .take(LINK_BATCH);
  for (const row of corrections) if (orderIds.has(row.orderId)) await ctx.db.patch(row._id, claim);

  const privacyRequests = await ctx.db
    .query("atelierPrivacyRequests")
    .withIndex("by_guestKey", (q) => q.eq("guestKey", guestKey))
    .take(LINK_BATCH);
  for (const row of privacyRequests) await ctx.db.patch(row._id, claim);

  const shares = await ctx.db
    .query("atelierShares")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .take(LINK_BATCH);
  for (const share of shares) if (share.guestKey === guestKey) await ctx.db.patch(share._id, claim);

  // C28: a guest who joined a group holds a participant row with no account; once the design is the
  // account's, so is the participation, or the fit readiness the participant consented to share would
  // never be read from the account's approved profile.
  const groupId = draft.groupId;
  const participants = groupId
    ? await ctx.db
        .query("atelierGroupParticipants")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .filter((q) => q.eq(q.field("draftId"), draft._id))
        .take(LINK_BATCH)
    : [];
  for (const participant of participants) await ctx.db.patch(participant._id, { userId: user._id });

  await audit(
    ctx,
    {
      actor: user,
      actorKind: "client",
      action: "draft.link",
      targetTable: "atelierDrafts",
      targetId: draft._id,
      meta: {
        photos: photos.length,
        previewJobs: jobs.length,
        cases: cases.length,
        appointments: appointments.length,
        orders: orders.length,
        shares: shares.length,
        participants: participants.length,
      },
    },
    now,
  );
}

// ------------------------------------------------------------------------------------------------
// Edits
// ------------------------------------------------------------------------------------------------

/** A design the house is reviewing, or one the client has put away, does not change underneath them. */
export function requireEditable(draft: Draft): Draft {
  if (draft.status === "submitted") {
    throw appError(
      "INVALID_STATE",
      "This design has been sent to the house. To change it, reply on your request or start a new design from it.",
      {
        status: draft.status,
      },
    );
  }
  if (draft.status === "archived") {
    throw appError("INVALID_STATE", "This design has been archived. Duplicate it to work on it again.", {
      status: draft.status,
    });
  }
  return draft;
}

function requireNotArchived(draft: Draft): Draft {
  if (draft.status === "archived") {
    throw appError("INVALID_STATE", "This design has been archived. Duplicate it to work on it again.", {
      status: draft.status,
    });
  }
  return draft;
}

export function isEmptyPatch(patch: SpecPatch): boolean {
  const defined = (value: object | undefined) =>
    value !== undefined && Object.values(value).some((entry) => entry !== undefined);
  return (
    patch.garment === undefined &&
    patch.clothCode === undefined &&
    patch.buttonCode === undefined &&
    patch.liningCode === undefined &&
    patch.monogram === undefined &&
    !defined(patch.jacket) &&
    !defined(patch.trousers) &&
    !(patch.waistcoat === null || defined(patch.waistcoat ?? undefined))
  );
}

export type CommitOptions = {
  acceptedConflicts: boolean;
  /** The revision the client previewed and confirmed against; the write is refused when the draft has moved on. */
  baseRevision?: number;
};

/**
 * S07/S08: applies a change through the dependency engine. Conflicts the client has not accepted are
 * returned with the proposed spec and nothing is written (cross-cutting scenario 2). An accepted change
 * is written whole, as a new revision; the current preview job stays where it is and the preview domain
 * reads `isCurrent` from the hashes. Accepted conflicts were confirmed against one revision of the
 * design: when `baseRevision` names an older one (another tab or window wrote first), the change is
 * refused with STALE_REVISION and the current design so the client can preview it again. A bare
 * boolean is `{ acceptedConflicts }` with no revision guard.
 */
export async function commitChange(
  ctx: MutationCtx,
  draft: Draft,
  patch: SpecPatch,
  options: boolean | CommitOptions,
  now: number = Date.now(),
): Promise<CommitResult> {
  const { acceptedConflicts, baseRevision } = typeof options === "boolean" ? { acceptedConflicts: options } : options;
  if (isEmptyPatch(patch)) return { revision: draft.revision, conflicts: [], spec: draft.spec, applied: false };
  requireEditable(draft);
  if (baseRevision !== undefined && baseRevision !== draft.revision) {
    throw appError(
      "STALE_REVISION",
      "This design changed in another window since this screen last saw it. The latest version is shown here; make your change again.",
      { baseRevision, currentRevision: draft.revision, spec: draft.spec },
    );
  }
  const normalized: SpecPatch = patch.monogram ? { ...patch, monogram: normalizeMonogram(patch.monogram) } : patch;
  await assertMaterialsExist(ctx, normalized);
  const { spec, conflicts } = applyChange(draft.spec, normalized);
  await requireWithinGroupBrief(ctx, draft, spec);
  if (conflicts.length > 0 && !acceptedConflicts) return { revision: draft.revision, conflicts, spec, applied: false };
  if (specHash(spec) === specHash(draft.spec)) return { revision: draft.revision, conflicts, spec, applied: false };
  const revision = await writeSpec(ctx, draft, spec, now);
  return { revision, conflicts, spec, applied: true };
}

/** C02: a recommended look replaces the design whole; the client confirmed that before calling. */
export async function applyLook(
  ctx: MutationCtx,
  draft: Draft,
  lookKey: string,
  now: number = Date.now(),
): Promise<CommitResult> {
  requireEditable(draft);
  const look = lookByKey(lookKey);
  if (!look) throw appError("INVALID_INPUT", "That look is no longer offered. Choose another, or keep designing.");
  const spec = cloneSpec(look.spec);
  if (specHash(spec) === specHash(draft.spec) && draft.lookKey === look.key) {
    return { revision: draft.revision, conflicts: [], spec, applied: false };
  }
  await requireWithinGroupBrief(ctx, draft, spec);
  const revision = await writeSpec(ctx, draft, spec, now, { lookKey: look.key });
  return { revision, conflicts: [], spec, applied: true };
}

export type OccasionInput = { occasion: Occasion; eventDate?: number; intendedUse?: string };

export async function setOccasion(
  ctx: MutationCtx,
  draft: Draft,
  input: OccasionInput,
  now: number = Date.now(),
): Promise<void> {
  requireEditable(draft);
  if (input.eventDate !== undefined && !Number.isFinite(input.eventDate))
    throw appError("INVALID_INPUT", "Choose a date for your event, or leave it open.");
  const intendedUse = input.intendedUse?.trim();
  await ctx.db.patch(draft._id, {
    occasion: input.occasion,
    eventDate: input.eventDate,
    intendedUse: intendedUse ? intendedUse.slice(0, 280) : undefined,
    completedSteps: await stepsForDraft(ctx, { ...draft, occasion: input.occasion }),
    updatedAt: now,
    lastSavedAt: now,
  });
}

/** C05: up to `shortlistMax` cloths the client is weighing; every code must name a catalogue entry. */
export async function setShortlist(
  ctx: MutationCtx,
  draft: Draft,
  clothCodes: string[],
  now: number = Date.now(),
): Promise<string[]> {
  requireEditable(draft);
  const codes = [...new Set(clothCodes.map((code) => code.trim()).filter(Boolean))];
  if (codes.length > ATELIER_LIMITS.shortlistMax) {
    throw appError(
      "INVALID_INPUT",
      `Your shortlist holds ${ATELIER_LIMITS.shortlistMax} cloths. Take one out to add another.`,
      {
        max: ATELIER_LIMITS.shortlistMax,
      },
    );
  }
  const entries = await Promise.all(codes.map((code) => getEntry(ctx, "cloth", code)));
  const missing = codes.filter((_, index) => entries[index] === null);
  if (missing.length > 0)
    throw appError("INVALID_INPUT", "That cloth is not in the house's catalogue.", { codes: missing });
  await ctx.db.patch(draft._id, { shortlist: codes, updatedAt: now, lastSavedAt: now });
  return codes;
}

/** Where the client is in the studio; part of what resume restores (C12). Allowed on a submitted draft, which is still read. */
export async function setStage(
  ctx: MutationCtx,
  draft: Draft,
  step: StudioStep,
  now: number = Date.now(),
): Promise<void> {
  requireNotArchived(draft);
  if (draft.stage === step) return;
  await ctx.db.patch(draft._id, { stage: step, updatedAt: now, lastSavedAt: now });
}

/** C15: a preference linked to the design; not an appointment and not a fit profile. */
export async function setFitRoute(
  ctx: MutationCtx,
  draft: Draft,
  fitRoute: FitRoute,
  now: number = Date.now(),
): Promise<void> {
  requireEditable(draft);
  await ctx.db.patch(draft._id, {
    fitRoute,
    completedSteps: await stepsForDraft(ctx, { ...draft, fitRoute }),
    updatedAt: now,
    lastSavedAt: now,
  });
}

export async function renameDraft(
  ctx: MutationCtx,
  draft: Draft,
  name: string,
  now: number = Date.now(),
): Promise<void> {
  requireNotArchived(draft);
  const trimmed = name.trim();
  if (trimmed.length === 0) throw appError("INVALID_INPUT", "Give the design a name.");
  if (trimmed.length > DRAFT_NAME_MAX)
    throw appError("INVALID_INPUT", `A name is at most ${DRAFT_NAME_MAX} characters.`, { max: DRAFT_NAME_MAX });
  await ctx.db.patch(draft._id, { name: trimmed, updatedAt: now, lastSavedAt: now });
}

/** Puts a design away. A submitted design stays with its request and cannot be archived from here. */
export async function archiveDraft(
  ctx: MutationCtx,
  draft: Draft,
  actor: Actor,
  now: number = Date.now(),
): Promise<void> {
  if (draft.status === "archived") return;
  if (draft.status === "submitted") {
    throw appError("INVALID_STATE", "This design has been sent to the house and stays with your request.", {
      status: draft.status,
    });
  }
  await ctx.db.patch(draft._id, { status: "archived", updatedAt: now });
  await audit(ctx, { actor, action: "draft.archive", targetTable: "atelierDrafts", targetId: draft._id }, now);
}

// ------------------------------------------------------------------------------------------------
// Internals
// ------------------------------------------------------------------------------------------------

async function writeSpec(
  ctx: MutationCtx,
  draft: Draft,
  spec: SuitSpec,
  now: number,
  extra: { lookKey?: string } = {},
): Promise<number> {
  const revision = draft.revision + 1;
  await ctx.db.patch(draft._id, {
    spec,
    revision,
    completedSteps: await stepsForDraft(ctx, { ...draft, spec }),
    catalogueVersion: await currentCatalogueVersion(ctx),
    ...(extra.lookKey !== undefined ? { lookKey: extra.lookKey } : {}),
    updatedAt: now,
    lastSavedAt: now,
  });
  return revision;
}

/**
 * C28: a design made from a group's brief keeps to it. A change may move only the lines the organizer
 * left to each participant (`permittedIndividual`), and the cloth when the brief leaves it open; any
 * other line this change moves away from the shared design is refused, naming the line, before anything
 * is proposed or written. Lines already apart from the brief are not re-litigated, so a permitted change
 * always goes through and a line can be brought back into agreement. A design that has left its group
 * carries no `groupId` and is private again, as is one whose participation the organizer removed.
 */
async function requireWithinGroupBrief(ctx: Ctx, draft: Draft, next: SuitSpec): Promise<void> {
  const groupId = draft.groupId;
  if (!groupId) return;
  const [group, participant] = await Promise.all([
    ctx.db.get(groupId),
    ctx.db
      .query("atelierGroupParticipants")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .filter((q) => q.eq(q.field("draftId"), draft._id))
      .first(),
  ]);
  if (!group || !participant || participant.status === "declined") return;
  const permitted = new Set<string>(group.permittedIndividual);
  if (group.sharedSpec.clothCode === null) permitted.add("clothCode");
  const apartFromBrief = new Set<string>(specDifferences(group.sharedSpec, next));
  const offending = specDifferences(draft.spec, next).find((path) => !permitted.has(path) && apartFromBrief.has(path));
  if (!offending) return;
  throw appError(
    "INVALID_STATE",
    `${specPathLabel(offending)} follows the shared design for ${group.name} and is not yours to change here. Ask the organizer to change it for the whole group, or to leave it to each participant.`,
    { field: offending, groupId: group._id },
  );
}

/** The client may hold `draftsPerOwner` live designs; archived ones do not count. */
async function assertBelowDraftCap(ctx: Ctx, actor: Actor): Promise<void> {
  const live = actor.user
    ? await listForUser(ctx, actor.user._id)
    : actor.guestKey
      ? await listForGuest(ctx, actor.guestKey)
      : [];
  if (live.length >= ATELIER_LIMITS.draftsPerOwner) {
    throw appError(
      "INVALID_INPUT",
      `You can keep up to ${ATELIER_LIMITS.draftsPerOwner} designs. Archive one to start another.`,
      {
        max: ATELIER_LIMITS.draftsPerOwner,
      },
    );
  }
}

/** Cloth, button and lining codes in a change must name catalogue entries; a withdrawn one is a warning, never a substitution. */
async function assertMaterialsExist(ctx: Ctx, patch: SpecPatch): Promise<void> {
  const checks: Promise<void>[] = [];
  const check = (kind: "cloth" | "button" | "lining", code: string | null | undefined, what: string) => {
    if (!code) return;
    checks.push(
      getEntry(ctx, kind, code).then((entry) => {
        if (!entry) throw appError("INVALID_INPUT", `That ${what} is not in the house's catalogue.`, { kind, code });
      }),
    );
  };
  check("cloth", patch.clothCode, "cloth");
  check("button", patch.buttonCode, "button");
  check("lining", patch.liningCode, "lining");
  await Promise.all(checks);
}

/** Rule 6: monogram text is a field error, not a conflict. Letters are kept as the client typed them, upper-cased. */
function normalizeMonogram(monogram: Monogram): Monogram {
  const text = normalizeMonogramText(monogram.text);
  if (text.length === 0)
    throw appError("INVALID_INPUT", `Enter the monogram letters or remove the monogram. ${MONOGRAM_RULES.help}`);
  if (text.length > MONOGRAM_RULES.maxChars) {
    throw appError(
      "INVALID_INPUT",
      `A monogram is at most ${MONOGRAM_RULES.maxChars} characters. ${MONOGRAM_RULES.help}`,
      { max: MONOGRAM_RULES.maxChars },
    );
  }
  if (!MONOGRAM_RULES.pattern.test(text))
    throw appError(
      "INVALID_INPUT",
      `A monogram uses capital letters A to Z and full stops only. ${MONOGRAM_RULES.help}`,
    );
  return { ...monogram, text };
}

function stepsFor(
  spec: SuitSpec,
  facts: { occasionSet: boolean; previewDone: boolean; fitRouteSet: boolean },
): StudioStep[] {
  return completedStepsFor(spec, facts).filter(isStudioStep);
}

/** Which steps a draft has done, read from the draft itself and from its current preview job. */
export async function stepsForDraft(
  ctx: Ctx,
  draft: Pick<Draft, "spec" | "occasion" | "fitRoute" | "currentPreviewJobId">,
): Promise<StudioStep[]> {
  const job = draft.currentPreviewJobId ? await ctx.db.get(draft.currentPreviewJobId) : null;
  const previewDone = job !== null && job.status === "done" && job.specHash === specHash(draft.spec);
  return stepsFor(draft.spec, {
    occasionSet: draft.occasion !== undefined,
    previewDone,
    fitRouteSet: draft.fitRoute !== undefined,
  });
}

export function cloneSpec(spec: SuitSpec): SuitSpec {
  return {
    ...spec,
    jacket: { ...spec.jacket },
    trousers: { ...spec.trousers },
    waistcoat: spec.waistcoat ? { ...spec.waistcoat } : null,
    monogram: spec.monogram ? { ...spec.monogram } : null,
  };
}
